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

// Exported so bootstrapCI can resample raw R arrays with the same
// definitions calcMetrics uses (see app/metrics for winRate/expectancy CIs).
export function winRateOf(rs: number[]): number {
  return rs.length > 0 ? rs.filter((r) => r > 0).length / rs.length : 0;
}

export function expectancyOf(rs: number[]): number {
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);
  const winRate = rs.length > 0 ? wins.length / rs.length : 0;
  const lossRate = rs.length > 0 ? losses.length / rs.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, r) => s + r, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length)
      : 0;
  return winRate * avgWin - lossRate * avgLoss;
}

export function calcMetrics(trades: Trade[]): MetricsResult {
  const closed = closedRs(trades);
  const rs = closed.map((c) => c.r);
  const n = rs.length;

  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);

  const winRate = winRateOf(rs);
  const avgWinR =
    wins.length > 0 ? wins.reduce((s, r) => s + r, 0) / wins.length : 0;
  const avgLossR =
    losses.length > 0
      ? Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length)
      : 0;
  const expectancy = expectancyOf(rs);

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

export interface RHistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

// Fixed-width bins over the R distribution, e.g. for a histogram chart.
// Bins are anchored to multiples of binSize so -1R always lands on a bin
// boundary (important: the UI colors bins left of -1R differently, as the
// visible trace of un-honored stops).
export function calcRHistogram(rs: number[], binSize = 0.5): RHistogramBin[] {
  if (rs.length === 0) return [];
  const minBin = Math.floor(Math.min(...rs) / binSize) * binSize;
  const maxBin = Math.floor(Math.max(...rs) / binSize) * binSize;
  const numBins = Math.round((maxBin - minBin) / binSize) + 1;

  const counts = new Array(numBins).fill(0);
  for (const r of rs) {
    const idx = Math.min(
      numBins - 1,
      Math.floor((r - minBin) / binSize)
    );
    counts[idx] += 1;
  }

  return counts.map((count, i) => ({
    binStart: minBin + i * binSize,
    binEnd: minBin + (i + 1) * binSize,
    count,
  }));
}

// Running total after each trade, in chronological order — for an equity
// curve expressed in R rather than currency (see docs/SPEC.md M3).
export function calcCumulativeRCurve(trades: Trade[]): number[] {
  const rs = closedRs(trades).map((c) => c.r);
  const curve: number[] = [];
  let cumulative = 0;
  for (const r of rs) {
    cumulative += r;
    curve.push(cumulative);
  }
  return curve;
}

// Pearson correlation coefficient. Returns null when undefined (fewer than
// 2 points, or one series has zero variance).
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;

  const xMean = xs.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const yMean = ys.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    covariance += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }

  if (xVariance === 0 || yVariance === 0) return null;
  return covariance / Math.sqrt(xVariance * yVariance);
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
