import type { Trade } from "./types";

export interface MetricsResult {
  n: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number; // positive magnitude
  expectancy: number;
  profitFactor: number | null;
  maxConsecutiveLosses: number;
  maxDrawdownR: number; // <= 0
  sqn: number | null;
  cumulativeR: number;
  kellyFraction: number | null;
  quarterKelly: number | null;
  insufficientSample: boolean;
}

interface ClosedR {
  r: number;
  at: string;
}

function closedRs(trades: Trade[]): ClosedR[] {
  return trades
    .filter((t): t is Trade & { realizedR: number } => t.realizedR !== null)
    .map((t) => ({ r: t.realizedR, at: t.exitAt ?? t.entryAt ?? "" }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function calcMetrics(trades: Trade[]): MetricsResult {
  const closed = closedRs(trades);
  const rs = closed.map((c) => c.r);
  const n = rs.length;

  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);

  const winRate = n > 0 ? wins.length / n : 0;
  const lossRate = n > 0 ? losses.length / n : 0;
  const avgWinR =
    wins.length > 0 ? wins.reduce((s, r) => s + r, 0) / wins.length : 0;
  const avgLossR =
    losses.length > 0
      ? Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length)
      : 0;
  const expectancy = winRate * avgWinR - lossRate * avgLossR;

  const grossProfit = wins.reduce((s, r) => s + r, 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  let maxConsecutiveLosses = 0;
  let currentStreak = 0;
  for (const r of rs) {
    if (r < 0) {
      currentStreak += 1;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  let cumulative = 0;
  let peak = 0;
  let maxDrawdownR = 0;
  for (const r of rs) {
    cumulative += r;
    peak = Math.max(peak, cumulative);
    maxDrawdownR = Math.min(maxDrawdownR, cumulative - peak);
  }
  const cumulativeR = cumulative;

  const mean = n > 0 ? rs.reduce((s, r) => s + r, 0) / n : 0;
  const variance =
    n > 1 ? rs.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1) : 0;
  const stdev = Math.sqrt(variance);
  const sqn = n > 0 && stdev > 0 ? (Math.sqrt(n) * mean) / stdev : null;

  const b = avgLossR > 0 ? avgWinR / avgLossR : null;
  const q = 1 - winRate;
  const kellyFraction = b !== null && b > 0 ? (b * winRate - q) / b : null;
  const quarterKelly = kellyFraction !== null ? kellyFraction / 4 : null;

  return {
    n,
    winRate,
    avgWinR,
    avgLossR,
    expectancy,
    profitFactor,
    maxConsecutiveLosses,
    maxDrawdownR,
    sqn,
    cumulativeR,
    kellyFraction,
    quarterKelly,
    insufficientSample: n < 30,
  };
}

// Deterministic PRNG (Math.random() is banned in lib/domain for reproducibility).
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

export function bootstrapCI(
  values: number[],
  statFn: (sample: number[]) => number,
  iterations = 1000,
  alpha = 0.05,
  seed = 1
): { lower: number; upper: number } | null {
  if (values.length === 0) return null;
  const rand = mulberry32(seed);
  const stats: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const sample: number[] = new Array(values.length);
    for (let j = 0; j < values.length; j++) {
      sample[j] = values[Math.floor(rand() * values.length)];
    }
    stats.push(statFn(sample));
  }

  stats.sort((a, b) => a - b);
  const lowerIdx = Math.floor((alpha / 2) * iterations);
  const upperIdx = Math.min(
    iterations - 1,
    Math.ceil((1 - alpha / 2) * iterations) - 1
  );
  return { lower: stats[lowerIdx], upper: stats[upperIdx] };
}
