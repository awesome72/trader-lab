// Deterministic PRNG. Math.random() is banned in lib/domain so simulations
// are reproducible from a stored seed (needed for the "replay this run" UX).
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MonteCarloOptions {
  trials: number;
  tradesPerTrial: number;
  riskPct: number; // % of current equity risked per trade
  seed: number;
  ruinThresholdPct?: number; // default 50, i.e. ruin = equity falls to -50%
}

export interface MonteCarloResult {
  finalReturns: number[]; // % return per trial
  maxDrawdowns: number[]; // % max drawdown per trial (<= 0)
  ruinProbability: number;
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  longestLossStreakDist: number[];
}

export function simulate(
  rDistribution: number[],
  opts: MonteCarloOptions
): MonteCarloResult | null {
  if (
    rDistribution.length === 0 ||
    opts.trials <= 0 ||
    opts.tradesPerTrial <= 0
  ) {
    return null;
  }

  const rand = mulberry32(opts.seed);
  const ruinEquityFloor = 1 - (opts.ruinThresholdPct ?? 50) / 100;

  const finalReturns: number[] = [];
  const maxDrawdowns: number[] = [];
  const longestLossStreakDist: number[] = [];
  let ruinCount = 0;

  for (let trial = 0; trial < opts.trials; trial++) {
    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    let currentLossStreak = 0;
    let longestLossStreak = 0;
    let ruined = false;

    for (let i = 0; i < opts.tradesPerTrial; i++) {
      const r = rDistribution[Math.floor(rand() * rDistribution.length)];
      equity = Math.max(0, equity * (1 + (opts.riskPct / 100) * r));
      peak = Math.max(peak, equity);
      maxDrawdown = Math.min(maxDrawdown, (equity - peak) / peak);

      if (r < 0) {
        currentLossStreak += 1;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      } else {
        currentLossStreak = 0;
      }

      if (!ruined && equity <= ruinEquityFloor) {
        ruined = true;
      }
    }

    if (ruined) ruinCount += 1;
    finalReturns.push((equity - 1) * 100);
    maxDrawdowns.push(maxDrawdown * 100);
    longestLossStreakDist.push(longestLossStreak);
  }

  const sorted = [...finalReturns].sort((a, b) => a - b);
  const percentileAt = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

  return {
    finalReturns,
    maxDrawdowns,
    ruinProbability: ruinCount / opts.trials,
    percentiles: {
      p5: percentileAt(0.05),
      p25: percentileAt(0.25),
      p50: percentileAt(0.5),
      p75: percentileAt(0.75),
      p95: percentileAt(0.95),
    },
    longestLossStreakDist,
  };
}

// docs/SPEC.md Phase 9-D-1: when a trader hasn't logged 30+ trades yet, they
// can supply assumptions (win rate, avg win/loss R) instead of their real
// distribution. Builds a representative sample in the same proportions —
// deterministic, so the same assumptions always produce the same sample.
export function buildSyntheticRDistribution(
  winRate: number,
  avgWinR: number,
  avgLossR: number,
  sampleSize = 100
): number[] {
  const clampedWinRate = Math.max(0, Math.min(1, winRate));
  const winCount = Math.round(sampleSize * clampedWinRate);
  const lossCount = sampleSize - winCount;
  return [
    ...Array(winCount).fill(Math.abs(avgWinR)),
    ...Array(lossCount).fill(-Math.abs(avgLossR)),
  ];
}

export interface RiskLevelComparison {
  riskPct: number;
  result: MonteCarloResult | null;
}

// docs/SPEC.md Phase 9-D-4 (the core educational device): the same skill
// (same R distribution) simulated at several sizing levels side by side, so
// the only thing that varies between rows is riskPct.
export function compareRiskLevels(
  rDistribution: number[],
  riskLevels: number[],
  opts: Omit<MonteCarloOptions, "riskPct">
): RiskLevelComparison[] {
  return riskLevels.map((riskPct) => ({
    riskPct,
    result: simulate(rDistribution, { ...opts, riskPct }),
  }));
}

export function buildRiskComparisonCaption(comparisons: RiskLevelComparison[]): string | null {
  const valid = comparisons.filter(
    (c): c is { riskPct: number; result: MonteCarloResult } => c.result !== null
  );
  if (valid.length < 2) return null;

  const lowest = valid[0];
  const highest = valid[valid.length - 1];
  const a = (lowest.result.ruinProbability * 100).toFixed(0);
  const b = (highest.result.ruinProbability * 100).toFixed(0);
  return `동일한 실력(같은 R 분포)이라도 사이징만으로 파산 확률이 ${a}%에서 ${b}%로 변합니다.`;
}

// "N연속 손실을 겪을 확률 X%" — the share of trials whose longest losing
// streak reached at least `n`.
export function calcLossStreakProbability(longestLossStreakDist: number[], n: number): number {
  if (longestLossStreakDist.length === 0) return 0;
  return longestLossStreakDist.filter((streak) => streak >= n).length / longestLossStreakDist.length;
}
