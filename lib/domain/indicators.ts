// Technical indicators shared by app/replay's chart overlay and
// lib/domain/rule-dsl.ts's backtest condition evaluator. Every function is
// pure and index-aligned to its input array: result[i] describes bar i,
// using only values at or before i — never a later bar (no look-ahead).

/**
 * Simple moving average over `period` values, aligned to the input array
 * (null where fewer than `period` values are available yet).
 */
export function calcSMA(values: number[], period: number): (number | null)[] {
  if (period <= 0) return values.map(() => null);

  const result: (number | null)[] = [];
  let windowSum = 0;

  for (let i = 0; i < values.length; i++) {
    windowSum += values[i];
    if (i >= period) windowSum -= values[i - period];
    result.push(i >= period - 1 ? windowSum / period : null);
  }

  return result;
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function calcEMA(values: number[], period: number): (number | null)[] {
  if (period <= 0) return values.map(() => null);

  const result: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (i === period - 1) {
      const seed = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
      prevEma = seed;
    } else if (prevEma !== null) {
      prevEma = values[i] * k + prevEma * (1 - k);
    }
    result[i] = prevEma;
  }

  return result;
}

/** Wilder's RSI (the standard smoothing used by most charting platforms). */
export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

/** Average True Range via Wilder smoothing. */
export function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): (number | null)[] {
  const n = closes.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return result;

  const trueRanges: number[] = new Array(n);
  trueRanges[0] = highs[0] - lows[0];
  for (let i = 1; i < n; i++) {
    trueRanges[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  if (n < period) return result;

  let atr = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result[period - 1] = atr;
  for (let i = period; i < n; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result[i] = atr;
  }

  return result;
}

export interface BollingerBands {
  upper: (number | null)[];
  mid: (number | null)[];
  lower: (number | null)[];
}

export function calcBollingerBands(
  closes: number[],
  period = 20,
  numStdDev = 2
): BollingerBands {
  const mid = calcSMA(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = mid[i] as number;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const stdev = Math.sqrt(variance);
    upper[i] = mean + numStdDev * stdev;
    lower[i] = mean - numStdDev * stdev;
  }

  return { upper, mid, lower };
}

/** Highest value over the trailing `period` bars, inclusive of the current bar. */
export function calcHighest(values: number[], period: number): (number | null)[] {
  return calcRolling(values, period, Math.max);
}

/** Lowest value over the trailing `period` bars, inclusive of the current bar. */
export function calcLowest(values: number[], period: number): (number | null)[] {
  return calcRolling(values, period, Math.min);
}

function calcRolling(
  values: number[],
  period: number,
  reducer: (...vals: number[]) => number
): (number | null)[] {
  if (period <= 0) return values.map(() => null);
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    result.push(reducer(...values.slice(i - period + 1, i + 1)));
  }
  return result;
}

/** Trailing cumulative sum over `period` bars — e.g. N-day foreign net-buy total. */
export function calcRollingSum(values: number[], period: number): (number | null)[] {
  if (period <= 0) return values.map(() => null);
  const result: (number | null)[] = [];
  let windowSum = 0;
  for (let i = 0; i < values.length; i++) {
    windowSum += values[i];
    if (i >= period) windowSum -= values[i - period];
    result.push(i >= period - 1 ? windowSum : null);
  }
  return result;
}
