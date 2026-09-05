import { describe, expect, it } from "vitest";
import { brierScore, bucketize, calibrationError } from "./calibration";
import type { CalibrationRecord } from "./calibration";

function makeRecord(
  predictedProb: number,
  outcome: boolean | null,
  overrides: Partial<CalibrationRecord> = {}
): CalibrationRecord {
  return {
    id: `rec-${Math.random()}`,
    userId: "user-1",
    tradeId: null,
    predictedProb,
    outcome,
    resolvedAt: outcome === null ? null : "2026-01-01T00:00:00.000Z",
    context: "trade",
    ...overrides,
  };
}

describe("bucketize", () => {
  it("groups records into 10% buckets and computes predicted/actual rates", () => {
    const records = [
      makeRecord(0.75, true),
      makeRecord(0.78, false),
      makeRecord(0.72, true),
    ];
    const buckets = bucketize(records, 10);
    const bucket70 = buckets.find((b) => b.bucketStart === 70);
    expect(bucket70?.count).toBe(3);
    expect(bucket70?.actual).toBeCloseTo((2 / 3) * 100, 6);
  });

  it("puts a boundary value (exactly 0.8) into the 80-90 bucket, not 70-80", () => {
    const records = [makeRecord(0.8, true)];
    const buckets = bucketize(records, 10);
    const bucket80 = buckets.find((b) => b.bucketStart === 80);
    expect(bucket80?.count).toBe(1);
  });

  it("excludes unresolved records (outcome === null)", () => {
    const records = [makeRecord(0.5, null), makeRecord(0.5, true)];
    const buckets = bucketize(records, 10);
    const bucket50 = buckets.find((b) => b.bucketStart === 50);
    expect(bucket50?.count).toBe(1);
  });

  it("returns all-empty buckets for an empty input array", () => {
    const buckets = bucketize([], 10);
    expect(buckets).toHaveLength(10);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("brierScore", () => {
  it("returns 0 for perfectly calibrated confident predictions", () => {
    const records = [makeRecord(1, true), makeRecord(0, false)];
    expect(brierScore(records)).toBe(0);
  });

  it("returns 0.25 for a coin-flip prediction that's wrong (boundary reference)", () => {
    const records = [makeRecord(0.5, true)];
    expect(brierScore(records)).toBe(0.25);
  });

  it("returns null for no resolved records (division-by-zero guard)", () => {
    expect(brierScore([makeRecord(0.5, null)])).toBeNull();
    expect(brierScore([])).toBeNull();
  });
});

describe("calibrationError", () => {
  it("returns 0 for perfect calibration across buckets", () => {
    // 10 records at 70% confidence, exactly 7 hit -> actual matches predicted
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord(0.7, i < 7)
    );
    expect(calibrationError(records)).toBeCloseTo(0, 6);
  });

  it("returns a positive gap for overconfidence", () => {
    // 10 records at 90% confidence, only 3 hit -> big gap
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord(0.9, i < 3)
    );
    const result = calibrationError(records);
    expect(result).not.toBeNull();
    expect(result as number).toBeGreaterThan(0.5);
  });

  it("returns null for an empty record set", () => {
    expect(calibrationError([])).toBeNull();
  });
});
