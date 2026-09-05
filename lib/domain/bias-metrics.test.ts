import { describe, expect, it } from "vitest";
import {
  calcAveragingDownRate,
  calcBiasRadar,
  calcDispositionEffect,
  calcFomoStats,
  calcOvertradingSlope,
  calcRevengeTradingRate,
  calcStopDelayHours,
  deriveFomoPriceContextFromTags,
  findAveragingDownEvidence,
  findDispositionEvidence,
  findFomoEvidence,
  findOvertradingEvidence,
  findRevengeTradingEvidence,
  findStopDelayEvidence,
} from "./bias-metrics";
import type { Trade, TradeEvent } from "./types";

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    userId: "user-1",
    source: "live",
    ticker: "005930",
    maskedLabel: null,
    status: "closed",
    entryAt: "2026-01-01T09:00:00.000Z",
    entryPrice: 100,
    quantity: 10,
    direction: "long",
    thesis: "테스트 논거".repeat(10),
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
    exitAt: "2026-01-02T09:00:00.000Z",
    exitPrice: 110,
    exitReason: "target",
    realizedR: 1,
    realizedPnl: 100,
    maeR: -0.2,
    mfeR: 1.2,
    processScore: null,
    processBreakdown: null,
    quadrant: null,
    journalLockedAt: "2026-01-01T09:10:00.000Z",
    createdAt: "2026-01-01T09:10:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<TradeEvent>): TradeEvent {
  return {
    id: "event-1",
    tradeId: "trade-1",
    at: "2026-01-01T09:05:00.000Z",
    kind: "note",
    payload: null,
    note: null,
    ...overrides,
  };
}

describe("calcDispositionEffect", () => {
  it("computes pgr/plr/index for a mixed sample", () => {
    const trades = [
      makeTrade({ id: "t1", mfeR: 1, maeR: -0.1, realizedR: 1 }), // gain realized
      makeTrade({ id: "t2", mfeR: 1, maeR: -0.1, realizedR: -0.5 }), // gain given back
      makeTrade({ id: "t3", mfeR: 0.1, maeR: -1, realizedR: -1 }), // loss realized
      makeTrade({ id: "t4", mfeR: 0.1, maeR: -1, realizedR: 0.2 }), // loss avoided (held through)
    ];
    const result = calcDispositionEffect(trades);
    expect(result.pgr).toBe(0.5); // 1 of 2 gain opportunities realized
    expect(result.plr).toBe(0.5); // 1 of 2 loss opportunities realized
    expect(result.index).toBeCloseTo(0, 6);
  });

  it("returns zeros for an empty trade list (no throw)", () => {
    expect(calcDispositionEffect([])).toEqual({ pgr: 0, plr: 0, index: 0 });
  });
});

describe("calcRevengeTradingRate", () => {
  it("flags a re-entry within the window after a loss", () => {
    const trades = [
      makeTrade({
        id: "t1",
        entryAt: "2026-01-01T09:00:00.000Z",
        exitAt: "2026-01-01T10:00:00.000Z",
        realizedR: -1,
      }),
      makeTrade({
        id: "t2",
        entryAt: "2026-01-01T10:20:00.000Z", // 20 min later
        exitAt: "2026-01-01T11:00:00.000Z",
        realizedR: 1,
      }),
    ];
    expect(calcRevengeTradingRate(trades, 60)).toBe(1);
  });

  it("does not flag a re-entry outside the window (boundary)", () => {
    const trades = [
      makeTrade({
        id: "t1",
        entryAt: "2026-01-01T09:00:00.000Z",
        exitAt: "2026-01-01T10:00:00.000Z",
        realizedR: -1,
      }),
      makeTrade({
        id: "t2",
        entryAt: "2026-01-01T11:01:00.000Z", // 61 min later
        exitAt: "2026-01-01T12:00:00.000Z",
        realizedR: 1,
      }),
    ];
    expect(calcRevengeTradingRate(trades, 60)).toBe(0);
  });

  it("returns 0 for a single trade or empty array (no prior trade to react to)", () => {
    expect(calcRevengeTradingRate([])).toBe(0);
    expect(calcRevengeTradingRate([makeTrade()])).toBe(0);
  });
});

describe("calcOvertradingSlope", () => {
  it("returns a negative slope when more trades correlate with worse monthly R", () => {
    const trades = [
      makeTrade({ id: "a1", entryAt: "2026-01-05T00:00:00.000Z", realizedR: 2 }),
      makeTrade({ id: "b1", entryAt: "2026-02-01T00:00:00.000Z", realizedR: 1 }),
      makeTrade({ id: "b2", entryAt: "2026-02-05T00:00:00.000Z", realizedR: -1 }),
      makeTrade({ id: "b3", entryAt: "2026-02-10T00:00:00.000Z", realizedR: -2 }),
      makeTrade({ id: "b4", entryAt: "2026-02-15T00:00:00.000Z", realizedR: -1 }),
    ];
    expect(calcOvertradingSlope(trades)).toBeLessThan(0);
  });

  it("returns 0 when fewer than 2 months of data exist (division-by-zero guard)", () => {
    const trades = [makeTrade({ entryAt: "2026-01-05T00:00:00.000Z" })];
    expect(calcOvertradingSlope(trades)).toBe(0);
  });
});

describe("calcAveragingDownRate", () => {
  it("returns 0 for an empty trade list", () => {
    expect(calcAveragingDownRate([], [])).toBe(0);
  });

  it("detects a losing add_position on a short trade (negative direction)", () => {
    const trade = makeTrade({ id: "t1", direction: "short", entryPrice: 100 });
    const events = [
      makeEvent({ tradeId: "t1", kind: "add_position", payload: { price: 105 } }),
    ];
    expect(calcAveragingDownRate([trade], events)).toBe(1);
  });

  it("does not flag an add_position that improves the position (long)", () => {
    const trade = makeTrade({ id: "t1", direction: "long", entryPrice: 100 });
    const events = [
      makeEvent({ tradeId: "t1", kind: "add_position", payload: { price: 105 } }),
    ];
    expect(calcAveragingDownRate([trade], events)).toBe(0);
  });
});

describe("calcStopDelayHours", () => {
  it("returns 0 when no trade breached its stop", () => {
    const trade = makeTrade({ maeR: -0.3 });
    expect(calcStopDelayHours([trade], [])).toBe(0);
  });

  it("computes average overheld hours for breached-and-not-stopped trades", () => {
    const trade = makeTrade({
      maeR: -1.5,
      exitReason: "discretionary",
      entryAt: "2026-01-01T00:00:00.000Z",
      exitAt: "2026-01-02T00:00:00.000Z", // 24h
    });
    expect(calcStopDelayHours([trade], [])).toBe(24);
  });
});

describe("calcFomoStats", () => {
  it("returns zeros for an empty trade list (division-by-zero guard)", () => {
    expect(calcFomoStats([], [])).toEqual({ rate: 0, winRate: 0, avgR: 0 });
  });

  it("computes rate/winRate/avgR for trades chasing a >=5% day move", () => {
    const trades = [
      makeTrade({ id: "t1", realizedR: -1 }),
      makeTrade({ id: "t2", realizedR: 2 }),
    ];
    const priceContext = [
      { tradeId: "t1", dayChangePctAtEntry: 6 },
      { tradeId: "t2", dayChangePctAtEntry: 1 },
    ];
    const result = calcFomoStats(trades, priceContext);
    expect(result.rate).toBe(0.5);
    expect(result.winRate).toBe(0);
    expect(result.avgR).toBe(-1);
  });
});

describe("findDispositionEvidence", () => {
  it("flags a gain given back and sums the R left on the table", () => {
    const trade = makeTrade({ id: "t1", mfeR: 2, realizedR: 0.5 });
    const result = findDispositionEvidence([trade]);
    expect(result.trades.map((t) => t.id)).toEqual(["t1"]);
    expect(result.estimatedLossR).toBeCloseTo(-1.5, 6);
  });

  it("flags a loss held past a disciplined -1R stop", () => {
    const trade = makeTrade({ id: "t1", maeR: -2, realizedR: -2, mfeR: -2 });
    const result = findDispositionEvidence([trade]);
    expect(result.trades.map((t) => t.id)).toEqual(["t1"]);
    expect(result.estimatedLossR).toBeCloseTo(-1, 6);
  });

  it("does not flag a clean trade", () => {
    const trade = makeTrade({ id: "t1", mfeR: 1.1, realizedR: 1, maeR: -0.2 });
    expect(findDispositionEvidence([trade])).toEqual({ trades: [], estimatedLossR: 0 });
  });
});

describe("findRevengeTradingEvidence", () => {
  it("flags the re-entry after a loss and sums its negative R", () => {
    const trades = [
      makeTrade({
        id: "t1",
        entryAt: "2026-01-01T09:00:00.000Z",
        exitAt: "2026-01-01T10:00:00.000Z",
        realizedR: -1,
      }),
      makeTrade({
        id: "t2",
        entryAt: "2026-01-01T10:20:00.000Z",
        exitAt: "2026-01-01T11:00:00.000Z",
        realizedR: -0.5,
      }),
    ];
    const result = findRevengeTradingEvidence(trades, 60);
    expect(result.trades.map((t) => t.id)).toEqual(["t2"]);
    expect(result.estimatedLossR).toBeCloseTo(-0.5, 6);
  });
});

describe("findOvertradingEvidence", () => {
  it("flags trades in a high-count, net-negative month", () => {
    const trades = [
      makeTrade({ id: "a1", entryAt: "2026-01-05T00:00:00.000Z", realizedR: 2 }),
      makeTrade({ id: "b1", entryAt: "2026-02-01T00:00:00.000Z", realizedR: 1 }),
      makeTrade({ id: "b2", entryAt: "2026-02-05T00:00:00.000Z", realizedR: -1 }),
      makeTrade({ id: "b3", entryAt: "2026-02-10T00:00:00.000Z", realizedR: -2 }),
      makeTrade({ id: "b4", entryAt: "2026-02-15T00:00:00.000Z", realizedR: -1 }),
    ];
    const result = findOvertradingEvidence(trades);
    expect(result.trades.map((t) => t.id).sort()).toEqual(["b1", "b2", "b3", "b4"]);
    expect(result.estimatedLossR).toBe(-4);
  });
});

describe("findAveragingDownEvidence", () => {
  it("flags a trade with a losing add and estimates loss beyond a disciplined -1R", () => {
    const trade = makeTrade({ id: "t1", direction: "long", entryPrice: 100, realizedR: -2.5 });
    const events = [makeEvent({ tradeId: "t1", kind: "add_position", payload: { price: 95 } })];
    const result = findAveragingDownEvidence([trade], events);
    expect(result.trades.map((t) => t.id)).toEqual(["t1"]);
    expect(result.estimatedLossR).toBeCloseTo(-1.5, 6);
  });
});

describe("findStopDelayEvidence", () => {
  it("flags a breached-and-held trade and estimates loss beyond a disciplined -1R", () => {
    const trade = makeTrade({ id: "t1", maeR: -1.5, exitReason: "discretionary", realizedR: -1.8 });
    const result = findStopDelayEvidence([trade], []);
    expect(result.trades.map((t) => t.id)).toEqual(["t1"]);
    expect(result.estimatedLossR).toBeCloseTo(-0.8, 6);
  });
});

describe("findFomoEvidence", () => {
  it("flags trades chasing a >=5% day move and sums their negative R", () => {
    const trades = [
      makeTrade({ id: "t1", realizedR: -1 }),
      makeTrade({ id: "t2", realizedR: 2 }),
    ];
    const priceContext = [
      { tradeId: "t1", dayChangePctAtEntry: 6 },
      { tradeId: "t2", dayChangePctAtEntry: 1 },
    ];
    const result = findFomoEvidence(trades, priceContext);
    expect(result.trades.map((t) => t.id)).toEqual(["t1"]);
    expect(result.estimatedLossR).toBe(-1);
  });
});

describe("deriveFomoPriceContextFromTags", () => {
  it("maps the self-declared fomo tag to a >=5% day-change proxy", () => {
    const trades = [
      makeTrade({ id: "t1", emotionTags: ["fomo"] }),
      makeTrade({ id: "t2", emotionTags: [] }),
    ];
    expect(deriveFomoPriceContextFromTags(trades)).toEqual([
      { tradeId: "t1", dayChangePctAtEntry: 5 },
      { tradeId: "t2", dayChangePctAtEntry: 0 },
    ]);
  });
});

describe("calcBiasRadar", () => {
  it("returns all six axes clamped to [0, 100] for an empty dataset", () => {
    const radar = calcBiasRadar([], []);
    for (const value of Object.values(radar)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("scores revenge/averaging-down/stop-delay at 0 for well-spaced, undisturbed trades", () => {
    const trades = [
      makeTrade({ id: "t1", entryAt: "2026-01-01T00:00:00.000Z", exitAt: "2026-01-02T00:00:00.000Z", realizedR: 1, maeR: -0.2 }),
      makeTrade({ id: "t2", entryAt: "2026-01-05T00:00:00.000Z", exitAt: "2026-01-06T00:00:00.000Z", realizedR: 1, maeR: -0.3 }),
    ];
    const radar = calcBiasRadar(trades, []);
    expect(radar.revengeTrading).toBe(0);
    expect(radar.averagingDown).toBe(0);
    expect(radar.stopDelay).toBe(0);
  });
});
