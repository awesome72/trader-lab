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
