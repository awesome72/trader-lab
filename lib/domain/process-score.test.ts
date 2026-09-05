import { describe, expect, it } from "vitest";
import { calcProcessScore, calcQuadrant } from "./process-score";
import type { ProfileSettings, Trade, TradeEvent } from "./types";

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    userId: "user-1",
    source: "live",
    ticker: "005930",
    maskedLabel: null,
    status: "closed",
    entryAt: "2026-01-10T09:30:00.000Z",
    entryPrice: 100,
    quantity: 100,
    direction: "long",
    thesis:
      "종가가 20일 이동평균선을 돌파했고 거래량이 평균 대비 크게 증가했습니다.",
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
    exitAt: "2026-01-13T09:30:00.000Z", // +3 days
    exitPrice: 130,
    exitReason: "target",
    realizedR: 3,
    realizedPnl: 300000,
    maeR: -0.3,
    mfeR: 3.2,
    processScore: null,
    processBreakdown: null,
    quadrant: null,
    journalLockedAt: "2026-01-10T09:45:00.000Z", // 15 min after entry
    createdAt: "2026-01-10T09:45:00.000Z",
    ...overrides,
  };
}

function makeSettings(overrides: Partial<ProfileSettings> = {}): ProfileSettings {
  return {
    id: "user-1",
    displayName: "Test User",
    accountSize: 10_000_000,
    defaultRiskPct: 1,
    maxRiskPct: 2,
    feeBps: 1.5,
    taxBps: 15,
    slippageBps: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
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

describe("calcProcessScore", () => {
  it("awards full marks for a disciplined, well-planned trade", () => {
    const result = calcProcessScore(makeTrade(), [], makeSettings());
    expect(result.total).toBe(100);
    expect(result.breakdown.hasPlan).toBe(20);
    expect(result.breakdown.invalidationQuality).toBe(15);
    expect(result.breakdown.stopDiscipline).toBe(25);
    expect(result.breakdown.sizing).toBe(15);
    expect(result.breakdown.noAveragingDown).toBe(10);
    expect(result.breakdown.horizonRespect).toBe(10);
    expect(result.breakdown.emotion).toBe(5);
  });

  it("zeroes hasPlan when journal was written more than 30 minutes after entry", () => {
    const trade = makeTrade({ journalLockedAt: "2026-01-10T10:15:00.000Z" }); // +45 min
    const result = calcProcessScore(trade, [], makeSettings());
    expect(result.breakdown.hasPlan).toBe(0);
  });

  it("gives partial credit for a 20+ char invalidation with no verifiable terms (boundary)", () => {
    const trade = makeTrade({
      invalidation: "느낌이 안 좋아지면 그냥 팔 생각입니다 손절",
    });
    const result = calcProcessScore(trade, [], makeSettings());
    expect(result.breakdown.invalidationQuality).toBe(8);
  });

  it("zeroes stopDiscipline when stop was breached but held past it", () => {
    const trade = makeTrade({ maeR: -1.5, exitReason: "discretionary" });
    const result = calcProcessScore(trade, [], makeSettings());
    expect(result.breakdown.stopDiscipline).toBe(0);
  });

  it("zeroes stopDiscipline when the stop was moved unfavorably (long)", () => {
    const trade = makeTrade();
    const events = [
      makeEvent({
        kind: "move_stop",
        payload: { from: 90, to: 80 },
      }),
    ];
    const result = calcProcessScore(trade, events, makeSettings());
    expect(result.breakdown.stopDiscipline).toBe(0);
  });

  it("zeroes sizing when risk % exceeds max (division-style threshold check)", () => {
    const trade = makeTrade({ plannedRiskPct: 5 });
    const result = calcProcessScore(trade, [], makeSettings({ maxRiskPct: 2 }));
    expect(result.breakdown.sizing).toBe(0);
  });

  it("zeroes noAveragingDown when a losing-side add_position event exists (short direction)", () => {
    const trade = makeTrade({ direction: "short", entryPrice: 100 });
    const events = [
      makeEvent({ kind: "add_position", payload: { price: 105 } }),
    ];
    const result = calcProcessScore(trade, events, makeSettings());
    expect(result.breakdown.noAveragingDown).toBe(0);
  });

  it("zeroes emotion when a fomo/revenge tag is present", () => {
    const trade = makeTrade({ emotionTags: ["fomo"] });
    const result = calcProcessScore(trade, [], makeSettings());
    expect(result.breakdown.emotion).toBe(0);
  });

  it("never throws on missing entry/exit timestamps (no plan yet)", () => {
    const trade = makeTrade({ entryAt: null, journalLockedAt: null, exitAt: null });
    expect(() => calcProcessScore(trade, [], makeSettings())).not.toThrow();
  });
});

describe("calcQuadrant", () => {
  it("classifies good process + good outcome as skill", () => {
    expect(calcQuadrant(80, 2)).toBe("skill");
  });

  it("classifies bad process + good outcome as luck", () => {
    expect(calcQuadrant(50, 2)).toBe("luck");
  });

  it("classifies good process + bad outcome as badluck", () => {
    expect(calcQuadrant(80, -1)).toBe("badluck");
  });

  it("classifies bad process + bad outcome as mistake", () => {
    expect(calcQuadrant(50, -1)).toBe("mistake");
  });

  it("treats the process score boundary (70) as good process", () => {
    expect(calcQuadrant(70, 1)).toBe("skill");
  });

  it("treats realizedR of exactly 0 as a bad outcome (boundary)", () => {
    expect(calcQuadrant(80, 0)).toBe("badluck");
  });
});
