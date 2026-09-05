import { describe, expect, it } from "vitest";
import {
  calcCounterfactualCurve,
  generateCounterfactualConclusion,
  runCounterfactualScenarios,
  summarizeCounterfactuals,
} from "./counterfactual";
import type { Trade, TradeEvent } from "./types";

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    userId: "user-1",
    source: "live",
    ticker: "005930",
    maskedLabel: null,
    replaySessionId: null,
    status: "closed",
    entryAt: "2026-01-10T09:30:00.000Z",
    entryPrice: 100,
    quantity: 100,
    direction: "long",
    thesis: "종가가 20일 이동평균선을 돌파했습니다.",
    setup: "breakout",
    horizon: "swing",
    invalidation: "종가가 20일 이동평균선 아래로 마감하면 무효화됩니다.",
    stopPrice: 90,
    stopBasis: "technical",
    target1Price: 130,
    target2Price: null,
    confidence: 70,
    plannedRiskPct: 1,
    plannedRMultiple: 3,
    emotionTags: [],
    prevTradePnlR: null,
    conditionScore: 4,
    exitAt: "2026-01-13T09:30:00.000Z",
    exitPrice: 110,
    exitReason: "discretionary",
    realizedR: 1,
    realizedPnl: 100000,
    maeR: -0.3,
    mfeR: 1.2,
    processScore: 80,
    processBreakdown: null,
    quadrant: null,
    journalLockedAt: "2026-01-10T09:45:00.000Z",
    createdAt: "2026-01-10T09:45:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TradeEvent>): TradeEvent {
  return {
    id: "event-1",
    tradeId: "trade-1",
    at: "2026-01-11T00:00:00.000Z",
    kind: "note",
    payload: null,
    note: null,
    ...overrides,
  };
}

describe("calcCounterfactualCurve", () => {
  it("actual scenario just replays realizedR in chronological order", () => {
    const trades = [
      makeTrade({ id: "t1", exitAt: "2026-01-11T00:00:00Z", realizedR: 1 }),
      makeTrade({ id: "t2", exitAt: "2026-01-12T00:00:00Z", realizedR: -1 }),
    ];
    const result = calcCounterfactualCurve(trades, [], "actual");
    expect(result.tradeCount).toBe(2);
    expect(result.cumulativeR).toBe(0);
    expect(result.points.map((p) => p.tradeId)).toEqual(["t1", "t2"]);
  });

  it("stopDiscipline caps a trade at -1R when maeR breached the stop, regardless of actual result", () => {
    const trade = makeTrade({ maeR: -2.5, realizedR: 1.5, exitReason: "discretionary" });
    const result = calcCounterfactualCurve([trade], [], "stopDiscipline");
    expect(result.points[0].r).toBe(-1);
  });

  it("stopDiscipline leaves a trade untouched when the stop was never breached", () => {
    const trade = makeTrade({ maeR: -0.4, realizedR: 2 });
    const result = calcCounterfactualCurve([trade], [], "stopDiscipline");
    expect(result.points[0].r).toBe(2);
  });

  it("targetDiscipline takes profit at the pre-declared target when mfeR reached it", () => {
    // entry 100, stop 90 -> 1R = 10. target1Price 130 -> targetR = 3.
    const trade = makeTrade({ mfeR: 4, realizedR: 0.5, exitReason: "discretionary" });
    const result = calcCounterfactualCurve([trade], [], "targetDiscipline");
    expect(result.points[0].r).toBe(3);
  });

  it("targetDiscipline leaves a trade untouched when price never reached the target", () => {
    const trade = makeTrade({ mfeR: 1.2, realizedR: 1 });
    const result = calcCounterfactualCurve([trade], [], "targetDiscipline");
    expect(result.points[0].r).toBe(1);
  });

  it("noAveraging replaces the outcome with -1R when a losing add_position event exists", () => {
    const trade = makeTrade({ realizedR: -2.3 });
    const events = [makeEvent({ kind: "add_position", payload: { price: 95 } })];
    const result = calcCounterfactualCurve([trade], events, "noAveraging");
    expect(result.points[0].r).toBe(-1);
  });

  it("noAveraging leaves a trade untouched with no averaging-down event", () => {
    const trade = makeTrade({ realizedR: 1.5 });
    const result = calcCounterfactualCurve([trade], [], "noAveraging");
    expect(result.points[0].r).toBe(1.5);
  });

  it("processFilter70 excludes trades scoring below 70", () => {
    const trades = [
      makeTrade({ id: "t1", processScore: 80, realizedR: 1 }),
      makeTrade({ id: "t2", processScore: 40, realizedR: 5 }),
    ];
    const result = calcCounterfactualCurve(trades, [], "processFilter70");
    expect(result.tradeCount).toBe(1);
    expect(result.cumulativeR).toBe(1);
  });

  it("noFomo excludes trades tagged with the fomo emotion", () => {
    const trades = [
      makeTrade({ id: "t1", emotionTags: [], realizedR: 1 }),
      makeTrade({ id: "t2", emotionTags: ["fomo"], realizedR: 5 }),
    ];
    const result = calcCounterfactualCurve(trades, [], "noFomo");
    expect(result.tradeCount).toBe(1);
    expect(result.cumulativeR).toBe(1);
  });

  it("topHalfConfidence keeps only trades at or above the median declared confidence", () => {
    const trades = [
      makeTrade({ id: "t1", confidence: 90, realizedR: 1 }),
      makeTrade({ id: "t2", confidence: 30, realizedR: 5 }),
    ];
    const result = calcCounterfactualCurve(trades, [], "topHalfConfidence");
    expect(result.tradeCount).toBe(1);
    expect(result.points[0].tradeId).toBe("t1");
  });

  it("computes maxDrawdownR across the cumulative curve", () => {
    const trades = [
      makeTrade({ id: "t1", exitAt: "2026-01-11T00:00:00Z", realizedR: 2 }),
      makeTrade({ id: "t2", exitAt: "2026-01-12T00:00:00Z", realizedR: -3 }),
      makeTrade({ id: "t3", exitAt: "2026-01-13T00:00:00Z", realizedR: -1 }),
    ];
    const result = calcCounterfactualCurve(trades, [], "actual");
    // cumulative: 2, -1, -2 ; peak after t1 is 2 -> drawdown bottoms at 2-2=0 then -2-2=-4
    expect(result.maxDrawdownR).toBe(-4);
  });

  it("ignores trades with no realized outcome yet (still open)", () => {
    const trades = [makeTrade({ realizedR: null })];
    const result = calcCounterfactualCurve(trades, [], "actual");
    expect(result.tradeCount).toBe(0);
    expect(result.cumulativeR).toBe(0);
  });
});

describe("runCounterfactualScenarios / summarizeCounterfactuals", () => {
  it("runs all 7 scenarios and diffs each against actual", () => {
    const trade = makeTrade({ maeR: -2, realizedR: -2, exitReason: "discretionary" });
    const results = runCounterfactualScenarios([trade], []);
    expect(results).toHaveLength(7);

    const summary = summarizeCounterfactuals(results);
    const actualRow = summary.find((r) => r.scenario === "actual");
    const stopRow = summary.find((r) => r.scenario === "stopDiscipline");
    expect(actualRow?.diffVsActual).toBe(0);
    // Actual lost 2R by holding past a breached stop; disciplined exit caps it at -1R.
    expect(stopRow?.diffVsActual).toBe(1);
  });
});

describe("generateCounterfactualConclusion", () => {
  it("names the scenario with the largest improvement when it clears 1R", () => {
    const trade = makeTrade({ maeR: -3, realizedR: -3, exitReason: "discretionary" });
    const results = runCounterfactualScenarios([trade], []);
    const summary = summarizeCounterfactuals(results);
    const conclusion = generateCounterfactualConclusion(summary);
    expect(conclusion).toContain("당신에게 필요한 것은 더 나은 종목이 아니라");
    expect(conclusion).toContain("손절 규칙을 예외 없이 지키는 것");
  });

  it("falls back to a discipline-is-good message when no scenario improves by 1R or more", () => {
    const trade = makeTrade({ maeR: -0.2, realizedR: 1, mfeR: 1.2 });
    const results = runCounterfactualScenarios([trade], []);
    const summary = summarizeCounterfactuals(results);
    expect(generateCounterfactualConclusion(summary)).toBe("현재 규칙 준수도가 높습니다.");
  });
});
