import { describe, expect, it } from "vitest";
import {
  calcWorstWindow,
  multipleTestingWarning,
  runBacktest,
  runWalkForwardBacktest,
  type BacktestTrade,
  type TickerUniverseEntry,
} from "./backtest";
import { ruleDefinitionSchema, type RuleDefinition } from "./rule-dsl";

function dateAt(i: number): string {
  const d = new Date("2024-01-01T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
}

// Entry condition that's true from day 0 onward, so a position opens as soon
// as the engine can fill one — keeps each scenario isolated to one trade.
function alwaysEntryRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return ruleDefinitionSchema.parse({
    entry: { lhs: { indicator: "close" }, cmp: ">", rhs: { const: 0 } },
    exit: { stop: { type: "fixed", value: 5 } },
    sizing: { riskPct: 1 },
    costs: { feeBps: 0, taxBps: 0, slippageBps: 0 },
    maxConcurrentPositions: 1,
    ...overrides,
  });
}

function makeEntry(overrides: Partial<TickerUniverseEntry> = {}, n = 20): TickerUniverseEntry {
  return {
    ticker: "T1",
    marketCap: 500_000_000_000,
    delistedAt: null,
    dates: Array.from({ length: n }, (_, i) => dateAt(i)),
    open: Array.from({ length: n }, () => 100),
    high: Array.from({ length: n }, () => 102),
    low: Array.from({ length: n }, () => 98),
    close: Array.from({ length: n }, () => 100),
    volume: Array.from({ length: n }, () => 1000),
    foreignNet: Array.from({ length: n }, () => 0),
    ...overrides,
  };
}

describe("runBacktest — next-bar-open fill (look-ahead ban)", () => {
  it("fills the entry at the NEXT bar's open, never the signal bar's close or open", () => {
    const universe = [
      makeEntry({
        open: [100, 999, 100, 100, 100, 100, 100, 100, 100, 100],
        close: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
        high: [102, 1001, 102, 102, 102, 102, 102, 102, 102, 102],
        low: [98, 997, 98, 98, 98, 98, 98, 98, 98, 98],
      }, 10),
    ];
    const rule = alwaysEntryRule({ exit: { stop: { type: "fixed", value: 50 } } });
    const result = runBacktest(universe, rule, { accountSize: 10_000_000 });

    expect(result.trades.length).toBeGreaterThan(0);
    const first = result.trades[0];
    // Signal fires at bar 0's close (100). If look-ahead were present, the
    // engine might fill at bar 0's own open/close (100) — instead it must
    // fill at bar 1's open, which this fixture deliberately sets to 999.
    expect(first.entryPrice).toBe(999);
    expect(first.entryDate).toBe(dateAt(1));
  });
});

describe("runBacktest — exit rules", () => {
  it("exits at the stop price when a bar's low touches it", () => {
    const universe = [
      makeEntry({
        open: Array.from({ length: 10 }, () => 100),
        close: Array.from({ length: 10 }, () => 100),
        high: Array.from({ length: 10 }, () => 102),
        low: [98, 98, 98, 90, 98, 98, 98, 98, 98, 98], // low breaches on bar 3
      }, 10),
    ];
    // fixed stop distance 5 -> stopPrice = entryPrice(100) - 5 = 95
    const rule = alwaysEntryRule();
    const result = runBacktest(universe, rule, { accountSize: 10_000_000 });
    const first = result.trades[0];
    expect(first.exitReason).toBe("stop");
    expect(first.exitPrice).toBe(95);
  });

  it("exits at the target price when a bar's high reaches it", () => {
    const universe = [
      makeEntry({
        open: Array.from({ length: 10 }, () => 100),
        close: Array.from({ length: 10 }, () => 100),
        high: [102, 102, 102, 130, 102, 102, 102, 102, 102, 102],
        low: Array.from({ length: 10 }, () => 98),
      }, 10),
    ];
    const rule = alwaysEntryRule({
      exit: { stop: { type: "fixed", value: 50 }, target: { type: "pct", value: 8 } },
    });
    // entry 100, target = 100*1.08 = 108
    const result = runBacktest(universe, rule, { accountSize: 10_000_000 });
    const first = result.trades[0];
    expect(first.exitReason).toBe("target");
    expect(first.exitPrice).toBe(108);
  });

  it("force-exits at the close on a timeStop after N bars held", () => {
    const universe = [
      makeEntry({}, 10),
    ];
    const rule = alwaysEntryRule({
      exit: { stop: { type: "fixed", value: 50 }, timeStop: { bars: 3 } },
    });
    const result = runBacktest(universe, rule, { accountSize: 10_000_000 });
    const first = result.trades[0];
    expect(first.exitReason).toBe("time");
  });

  it("force-liquidates a delisted ticker exactly on its delisting date", () => {
    const n = 10;
    const universe = [
      makeEntry({ delistedAt: dateAt(4) }, n),
    ];
    const rule = alwaysEntryRule({ exit: { stop: { type: "fixed", value: 50 } } });
    const result = runBacktest(universe, rule, { accountSize: 10_000_000 });
    const first = result.trades[0];
    expect(first.exitReason).toBe("delisted");
    expect(first.exitDate).toBe(dateAt(4));
  });
});

describe("runBacktest — concurrency cap", () => {
  it("never opens more positions than maxConcurrentPositions across tickers", () => {
    const universe = [
      makeEntry({ ticker: "T1" }, 15),
      makeEntry({ ticker: "T2" }, 15),
      makeEntry({ ticker: "T3" }, 15),
    ];
    const rule = alwaysEntryRule({ maxConcurrentPositions: 1 });
    const result = runBacktest(universe, rule, { accountSize: 10_000_000 });

    // Reconstruct concurrency day-by-day from entry/exit dates.
    let maxOpen = 0;
    const openIntervals = result.trades.map((t: BacktestTrade) => [t.entryDate, t.exitDate]);
    for (const [start] of openIntervals) {
      const concurrent = openIntervals.filter(([s, e]) => s <= start && start <= e).length;
      maxOpen = Math.max(maxOpen, concurrent);
    }
    expect(maxOpen).toBeLessThanOrEqual(1);
  });
});

describe("runWalkForwardBacktest", () => {
  it("splits trades into in-sample (first 70%) and out-of-sample (last 30%) by date", () => {
    const universe = [makeEntry({}, 40)];
    const rule = alwaysEntryRule({ exit: { stop: { type: "fixed", value: 50 }, timeStop: { bars: 2 } } });
    const result = runWalkForwardBacktest(universe, rule, { accountSize: 10_000_000 });

    expect(result.is.trades.every((t) => t.entryDate <= result.splitDate)).toBe(true);
    expect(result.oos.trades.every((t) => t.entryDate > result.splitDate)).toBe(true);
    expect(result.is.trades.length + result.oos.trades.length).toBeGreaterThan(0);
  });

  it("flags overfitWarning when OOS expectancy is under half of a positive IS expectancy", () => {
    // Winning trades throughout IS (target hits), losing trades throughout OOS (stop hits).
    const n = 40;
    const splitBar = Math.floor(n * 0.7);
    const high = Array.from({ length: n }, (_, i) => (i < splitBar ? 130 : 102));
    const low = Array.from({ length: n }, (_, i) => (i < splitBar ? 98 : 90));
    const universe = [
      makeEntry({
        open: Array.from({ length: n }, () => 100),
        close: Array.from({ length: n }, () => 100),
        high,
        low,
      }, n),
    ];
    const rule = alwaysEntryRule({
      exit: { stop: { type: "fixed", value: 5 }, target: { type: "pct", value: 8 } },
    });
    const result = runWalkForwardBacktest(universe, rule, { accountSize: 10_000_000 });
    expect(result.is.metrics.expectancy).toBeGreaterThan(0);
    expect(result.overfitWarning).toBe(true);
  });
});

describe("calcWorstWindow", () => {
  it("returns null for an empty trade list", () => {
    expect(calcWorstWindow([])).toBeNull();
  });

  it("finds the window with the lowest cumulative R", () => {
    const trades: BacktestTrade[] = [
      { ticker: "T1", entryDate: "2024-01-01", entryPrice: 100, exitDate: "2024-01-02", exitPrice: 110, exitReason: "target", quantity: 10, r: 2 },
      { ticker: "T1", entryDate: "2024-02-01", entryPrice: 100, exitDate: "2024-02-02", exitPrice: 95, exitReason: "stop", quantity: 10, r: -1 },
      { ticker: "T1", entryDate: "2024-02-10", entryPrice: 100, exitDate: "2024-02-11", exitPrice: 95, exitReason: "stop", quantity: 10, r: -1 },
    ];
    const result = calcWorstWindow(trades, 30);
    expect(result).not.toBeNull();
    expect(result?.cumulativeR).toBeLessThanOrEqual(-1);
  });
});

describe("multipleTestingWarning", () => {
  it("returns null at or below the 20-search threshold", () => {
    expect(multipleTestingWarning(20)).toBeNull();
    expect(multipleTestingWarning(0)).toBeNull();
  });

  it("returns a warning message above the threshold", () => {
    expect(multipleTestingWarning(21)).toContain("21회");
  });
});
