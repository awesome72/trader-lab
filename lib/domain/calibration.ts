// predictedProb is a 0-1 fraction (UI-level 0-100% sliders are converted to
// this range before reaching the domain layer).
export interface CalibrationRecord {
  id: string;
  userId: string;
  tradeId: string | null;
  predictedProb: number; // 0-1
  outcome: boolean | null;
  resolvedAt: string | null;
  context: "trade" | "quiz";
}

export interface CalibrationBucket {
  bucketStart: number; // 0, 10, 20 ... (percent)
  bucketEnd: number;
  predicted: number; // mean predicted %, within this bucket
  actual: number; // actual hit rate %, within this bucket
  count: number;
}

function resolvedOnly(records: CalibrationRecord[]): CalibrationRecord[] {
  return records.filter((r) => r.outcome !== null);
}

export function bucketize(
  records: CalibrationRecord[],
  bucketSize = 10
): CalibrationBucket[] {
  const resolved = resolvedOnly(records);
  const numBuckets = Math.max(1, Math.ceil(100 / bucketSize));
  const groups: CalibrationRecord[][] = Array.from(
    { length: numBuckets },
    () => []
  );

  for (const r of resolved) {
    const pct = r.predictedProb * 100;
    const idx = Math.min(
      numBuckets - 1,
      Math.max(0, Math.floor(pct / bucketSize))
    );
    groups[idx].push(r);
  }

  return groups.map((group, i) => {
    const bucketStart = i * bucketSize;
    const bucketEnd = Math.min(100, bucketStart + bucketSize);
    if (group.length === 0) {
      return { bucketStart, bucketEnd, predicted: 0, actual: 0, count: 0 };
    }
    const predicted =
      group.reduce((s, r) => s + r.predictedProb * 100, 0) / group.length;
    const actual =
      (group.filter((r) => r.outcome).length / group.length) * 100;
    return { bucketStart, bucketEnd, predicted, actual, count: group.length };
  });
}

export function brierScore(records: CalibrationRecord[]): number | null {
  const resolved = resolvedOnly(records);
  if (resolved.length === 0) return null;
  const sumSquaredError = resolved.reduce((sum, r) => {
    const outcomeValue = r.outcome ? 1 : 0;
    return sum + (r.predictedProb - outcomeValue) ** 2;
  }, 0);
  return sumSquaredError / resolved.length;
}

// Expected Calibration Error: weighted mean absolute gap between predicted
// and actual hit rate across buckets, as a 0-1 fraction.
export function calibrationError(
  records: CalibrationRecord[],
  bucketSize = 10
): number | null {
  const buckets = bucketize(records, bucketSize).filter((b) => b.count > 0);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return null;

  return buckets.reduce((sum, b) => {
    const weight = b.count / total;
    const gap = Math.abs(b.predicted - b.actual) / 100;
    return sum + gap * weight;
  }, 0);
}

// Brier score of a trader who always guesses 50% is exactly 0.25 regardless
// of outcomes ((0.5-0)^2 = (0.5-1)^2 = 0.25) — the "coin flip" reference line.
export const COIN_FLIP_BRIER_SCORE = 0.25;

export type CalibrationDiagnosis = "overconfident" | "underconfident" | "well_calibrated";

// docs/SPEC.md Phase 9-A-4: judged only on the high-confidence (70%+) bucket,
// since that's where overconfidence actually costs a trader money. Returns
// null in the 5-15pp gray zone (not enough signal to call it either way) or
// when there's no high-confidence data yet.
export function diagnoseCalibration(buckets: CalibrationBucket[]): CalibrationDiagnosis | null {
  const highConf = buckets.filter((b) => b.bucketStart >= 70 && b.count > 0);
  const total = highConf.reduce((s, b) => s + b.count, 0);
  if (total === 0) return null;

  const weightedPredicted = highConf.reduce((s, b) => s + b.predicted * b.count, 0) / total;
  const weightedActual = highConf.reduce((s, b) => s + b.actual * b.count, 0) / total;
  const gap = weightedPredicted - weightedActual; // positive = claimed more than delivered

  if (gap >= 15) return "overconfident";
  if (gap <= -15) return "underconfident";
  if (Math.abs(gap) <= 5) return "well_calibrated";
  return null;
}

export interface BrierTrendPoint {
  at: string;
  rollingBrier: number;
}

// Rolling Brier score over the last `windowSize` resolved predictions,
// chronologically — for the "시계열 추이" chart.
export function calcBrierTrend(
  records: CalibrationRecord[],
  windowSize = 10
): BrierTrendPoint[] {
  const resolved = resolvedOnly(records)
    .filter((r) => r.resolvedAt !== null)
    .sort((a, b) => (a.resolvedAt as string).localeCompare(b.resolvedAt as string));

  return resolved.map((_, i) => {
    const window = resolved.slice(Math.max(0, i - windowSize + 1), i + 1);
    return {
      at: resolved[i].resolvedAt as string,
      rollingBrier: brierScore(window) ?? 0,
    };
  });
}

// docs/SPEC.md Phase 9-A-6: awarded when the most recent 30 resolved
// predictions (any context) have a combined Brier score under 0.18. Never
// return-based — see CLAUDE.md anti-goals.
export function hasCalibrationBadge(records: CalibrationRecord[]): boolean {
  const resolved = resolvedOnly(records)
    .filter((r) => r.resolvedAt !== null)
    .sort((a, b) => (b.resolvedAt as string).localeCompare(a.resolvedAt as string))
    .slice(0, 30);
  if (resolved.length < 30) return false;
  return (brierScore(resolved) ?? 1) < 0.18;
}
