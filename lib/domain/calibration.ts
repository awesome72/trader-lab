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
