import { describe, expect, it } from "vitest";
import { bootstrapCI, calcMetrics } from "./metrics";
import type { Trade } from "./types";

function makeClosedTrade(
  realizedR: number,
  exitAt: string,
  overrides: Partial<Trade> = {}
): Trade {
  return {
    id: `trade-${exitAt}`,
    userId: "user-1",
    source: "live",
    ticker: "005930",
    maskedLabel: null,
    status: "closed",
    entryAt: "2026-01-01T09:00:00.000Z",
    entryPrice: 100,
    quantity: 10,
    direction: "long",
    thesis: "테스트용 논거 텍스트입니다 최소 오십자 이상을 채우기 위한 문장을 추가로 작성합니다.",
    setup: "breakout",
    horizon: "swing",
    invalidation: "종가가 20일 이동평균선 아래로 마감하면 무효화됩니다.",
    stopPrice: 90,
    stopBasis: "technical",
    target1Price: 120,
    target2Price: null,
    confidence: 60,
    plannedRiskPct: 1,
    plannedRMultiple: 2,
    emotionTags: [],
    prevTradePnlR: null,
    conditionScore: 3,
    exitAt,
    exitPrice: 100 + realizedR * 10,
    exitReason: realizedR >= 0 ? "target" : "stop",
    realizedR,
    realizedPnl: realizedR * 10 * 10,
    maeR: -0.3,
    mfeR: Math.max(realizedR, 0.1),
    processScore: null,
    processBreakdown: null,
    quadrant: null,
    journalLockedAt: "2026-01-01T09:10:00.000Z",
    createdAt: "2026-01-01T09:10:00.000Z",
    ...overrides,
  };
}

describe("calcMetrics", () => {
  it("computes standard stats for a normal mixed win/loss set", () => {
    const trades = [
      makeClosedTrade(2, "2026-01-02T00:00:00.000Z"),
      makeClosedTrade(-1, "2026-01-03T00:00:00.000Z"),
      makeClosedTrade(3, "2026-01-04T00:00:00.000Z"),
      makeClosedTrade(-1, "2026-01-05T00:00:00.000Z"),
    ];
    const result = calcMetrics(trades);
    expect(result.n).toBe(4);
    expect(result.winRate).toBe(0.5);
    expect(result.avgWinR).toBe(2.5);
    expect(result.avgLossR).toBe(1);
    expect(result.expectancy).toBeCloseTo(0.5 * 2.5 - 0.5 * 1, 6);
    expect(result.profitFactor).toBeCloseTo(5 / 2, 6);
    expect(result.cumulativeR).toBe(3);
    expect(result.insufficientSample).toBe(true);
  });

  it("returns safe zeroed stats for an empty trade list (no throw)", () => {
    const result = calcMetrics([]);
    expect(result.n).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.expectancy).toBe(0);
    expect(result.profitFactor).toBeNull();
    expect(result.sqn).toBeNull();
    expect(result.kellyFraction).toBeNull();
    expect(result.insufficientSample).toBe(true);
  });

  it("flags insufficientSample as false once n reaches 30 (boundary)", () => {
    const trades = Array.from({ length: 30 }, (_, i) =>
      makeClosedTrade(i % 2 === 0 ? 1 : -1, `2026-02-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`)
    );
    const result = calcMetrics(trades);
    expect(result.n).toBe(30);
    expect(result.insufficientSample).toBe(false);
  });

  it("counts the longest consecutive-loss streak in chronological order", () => {
    const trades = [
      makeClosedTrade(1, "2026-01-01T01:00:00.000Z"),
      makeClosedTrade(-1, "2026-01-02T01:00:00.000Z"),
      makeClosedTrade(-1, "2026-01-03T01:00:00.000Z"),
      makeClosedTrade(-1, "2026-01-04T01:00:00.000Z"),
      makeClosedTrade(1, "2026-01-05T01:00:00.000Z"),
      makeClosedTrade(-1, "2026-01-06T01:00:00.000Z"),
    ];
    const result = calcMetrics(trades);
    expect(result.maxConsecutiveLosses).toBe(3);
  });

  it("avoids division by zero when there are no losing trades", () => {
    const trades = [
      makeClosedTrade(1, "2026-01-01T00:00:00.000Z"),
      makeClosedTrade(2, "2026-01-02T00:00:00.000Z"),
    ];
    const result = calcMetrics(trades);
    expect(result.avgLossR).toBe(0);
    expect(result.profitFactor).toBeNull();
    expect(result.kellyFraction).toBeNull();
  });

  it("includes short-direction trades using their already-signed realizedR", () => {
    const trades = [
      makeClosedTrade(2, "2026-01-01T00:00:00.000Z", { direction: "short" }),
      makeClosedTrade(-1, "2026-01-02T00:00:00.000Z", { direction: "short" }),
    ];
    const result = calcMetrics(trades);
    expect(result.n).toBe(2);
    expect(result.cumulativeR).toBe(1);
  });
});

describe("bootstrapCI", () => {
  const mean = (sample: number[]) =>
    sample.reduce((s, v) => s + v, 0) / sample.length;

  it("returns null for an empty values array", () => {
    expect(bootstrapCI([], mean)).toBeNull();
  });

  it("is deterministic for a given seed", () => {
    const values = [1, -1, 2, -1, 3, 1, -2, 2];
    const a = bootstrapCI(values, mean, 500, 0.05, 42);
    const b = bootstrapCI(values, mean, 500, 0.05, 42);
    expect(a).toEqual(b);
  });

  it("produces a lower bound <= upper bound bracketing the sample mean roughly", () => {
    const values = [1, 1, 1, 1, 1, -1, -1, -1, -1, -1];
    const ci = bootstrapCI(values, mean, 1000, 0.05, 7);
    expect(ci).not.toBeNull();
    expect((ci as { lower: number; upper: number }).lower).toBeLessThanOrEqual(
      (ci as { lower: number; upper: number }).upper
    );
  });

  it("produces different CIs for different seeds (not hardcoded)", () => {
    const values = [1, -1, 2, -2, 3, -3, 1, -1];
    const a = bootstrapCI(values, mean, 200, 0.05, 1);
    const b = bootstrapCI(values, mean, 200, 0.05, 2);
    expect(a).not.toEqual(b);
  });
});
