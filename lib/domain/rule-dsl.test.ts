import { describe, expect, it } from "vitest";
import {
  buildIndicatorSeries,
  evaluateCondition,
  ruleDefinitionSchema,
  type BarSeries,
  type RuleDefinition,
} from "./rule-dsl";

function makeBars(overrides: Partial<BarSeries> = {}): BarSeries {
  const n = 30;
  return {
    open: Array.from({ length: n }, (_, i) => 100 + i),
    high: Array.from({ length: n }, (_, i) => 101 + i),
    low: Array.from({ length: n }, (_, i) => 99 + i),
    close: Array.from({ length: n }, (_, i) => 100 + i),
    volume: Array.from({ length: n }, () => 1000),
    foreignNet: Array.from({ length: n }, () => 10),
    ...overrides,
  };
}

describe("ruleDefinitionSchema", () => {
  it("parses the spec's example rule JSON", () => {
    const rule = {
      entry: {
        op: "AND",
        conditions: [
          { lhs: { indicator: "close" }, cmp: ">", rhs: { indicator: "sma", period: 20 } },
          {
            lhs: { indicator: "volume" },
            cmp: ">",
            rhs: { indicator: "sma", source: "volume", period: 20, multiplier: 1.5 },
          },
          { lhs: { indicator: "rsi", period: 14 }, cmp: "<", rhs: { const: 70 } },
        ],
      },
      exclude: {
        op: "OR",
        conditions: [{ lhs: { field: "marketCap" }, cmp: "<", rhs: { const: 300000000000 } }],
      },
      exit: {
        stop: { type: "atr", period: 14, multiplier: 2 },
        target: { type: "pct", value: 8 },
        timeStop: { bars: 10 },
      },
      sizing: { riskPct: 1.0 },
      costs: { feeBps: 1.5, taxBps: 15, slippageBps: 10 },
    };
    expect(() => ruleDefinitionSchema.parse(rule)).not.toThrow();
  });

  it("rejects a malformed comparator", () => {
    const rule = {
      entry: { lhs: { indicator: "close" }, cmp: "gt", rhs: { const: 100 } },
      exit: { stop: { type: "pct", value: 5 } },
      sizing: { riskPct: 1 },
      costs: { feeBps: 0, taxBps: 0, slippageBps: 0 },
    };
    expect(() => ruleDefinitionSchema.parse(rule)).toThrow();
  });

  it("defaults maxConcurrentPositions when omitted", () => {
    const rule = ruleDefinitionSchema.parse({
      entry: { lhs: { indicator: "close" }, cmp: ">", rhs: { const: 100 } },
      exit: { stop: { type: "pct", value: 5 } },
      sizing: { riskPct: 1 },
      costs: { feeBps: 0, taxBps: 0, slippageBps: 0 },
    });
    expect(rule.maxConcurrentPositions).toBe(5);
  });
});

describe("buildIndicatorSeries", () => {
  it("computes only the series a rule actually references, keyed distinctly", () => {
    const bars = makeBars();
    const rule: RuleDefinition = ruleDefinitionSchema.parse({
      entry: {
        op: "AND",
        conditions: [
          { lhs: { indicator: "close" }, cmp: ">", rhs: { indicator: "sma", period: 5 } },
          { lhs: { indicator: "rsi", period: 14 }, cmp: "<", rhs: { const: 70 } },
        ],
      },
      exit: { stop: { type: "fixed", value: 5 } },
      sizing: { riskPct: 1 },
      costs: { feeBps: 0, taxBps: 0, slippageBps: 0 },
    });

    const series = buildIndicatorSeries(bars, rule);
    expect(Object.keys(series).some((k) => k.startsWith("sma:close:5"))).toBe(true);
    expect(Object.keys(series).some((k) => k.startsWith("rsi:"))).toBe(true);
  });

  it("also computes the exit stop's ATR series when stop type is atr", () => {
    const bars = makeBars();
    const rule: RuleDefinition = ruleDefinitionSchema.parse({
      entry: { lhs: { indicator: "close" }, cmp: ">", rhs: { const: 0 } },
      exit: { stop: { type: "atr", period: 14, multiplier: 2 } },
      sizing: { riskPct: 1 },
      costs: { feeBps: 0, taxBps: 0, slippageBps: 0 },
    });
    const series = buildIndicatorSeries(bars, rule);
    expect(Object.keys(series).some((k) => k.startsWith("atr:"))).toBe(true);
  });
});

describe("evaluateCondition", () => {
  it("evaluates a simple comparison against a constant", () => {
    const series = { "close:close::": [10, 20, 30] };
    const condition = { lhs: { indicator: "close" as const }, cmp: ">" as const, rhs: { const: 15 } };
    expect(evaluateCondition(condition, series, null, 0)).toBe(false);
    expect(evaluateCondition(condition, series, null, 1)).toBe(true);
  });

  it("evaluates nested AND/OR groups", () => {
    const series = { "close:close::": [10, 20, 30] };
    const rule = {
      op: "OR" as const,
      conditions: [
        {
          op: "AND" as const,
          conditions: [
            { lhs: { indicator: "close" as const }, cmp: ">" as const, rhs: { const: 100 } },
            { lhs: { indicator: "close" as const }, cmp: ">" as const, rhs: { const: 5 } },
          ],
        },
        { lhs: { indicator: "close" as const }, cmp: "<" as const, rhs: { const: 15 } },
      ],
    };
    // AND branch is false (close never > 100), OR branch true at index 0 (10 < 15)
    expect(evaluateCondition(rule, series, null, 0)).toBe(true);
    expect(evaluateCondition(rule, series, null, 2)).toBe(false);
  });

  it("applies a multiplier to the resolved operand value", () => {
    const series = { "sma:volume:20:": [100, null] };
    const condition = {
      lhs: { indicator: "volume" as const },
      cmp: ">" as const,
      rhs: { indicator: "sma" as const, source: "volume" as const, period: 20, multiplier: 1.5 },
    };
    const withVolume = { ...series, "volume:close::": [200, 200] };
    expect(evaluateCondition(condition, withVolume, null, 0)).toBe(true); // 200 > 150
  });

  it("resolves a marketCap field ref from the trade's own ticker data", () => {
    const condition = { lhs: { field: "marketCap" as const }, cmp: "<" as const, rhs: { const: 1000 } };
    expect(evaluateCondition(condition, {}, 500, 0)).toBe(true);
    expect(evaluateCondition(condition, {}, 5000, 0)).toBe(false);
  });

  it("returns false (never throws) when an operand is still in its warm-up period", () => {
    const series = { "sma:close:20:": [null, null] };
    const condition = { lhs: { indicator: "close" as const }, cmp: ">" as const, rhs: { indicator: "sma" as const, period: 20 } };
    expect(evaluateCondition(condition, series, null, 0)).toBe(false);
  });
});
