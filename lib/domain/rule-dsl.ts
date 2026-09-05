import { z } from "zod";
import {
  calcATR,
  calcEMA,
  calcHighest,
  calcLowest,
  calcRollingSum,
  calcRSI,
  calcSMA,
} from "./indicators";

// docs/SPEC.md Phase 7-1: a JSON rule that a no-code condition builder can
// produce and this module can both validate and evaluate. Every function
// here is pure: given precomputed indicator series + a bar index, decide
// true/false. The backtest engine (lib/domain/backtest.ts) owns *when* to
// ask (bar close only — never a future bar) and *how* to fill the resulting
// signal (next bar's open).

export const INDICATOR_NAMES = [
  "close",
  "open",
  "high",
  "low",
  "volume",
  "sma",
  "ema",
  "rsi",
  "atr",
  "bbands",
  "highest",
  "lowest",
  "foreignNetSum",
] as const;
export type IndicatorName = (typeof INDICATOR_NAMES)[number];

export const indicatorRefSchema = z.object({
  indicator: z.enum(INDICATOR_NAMES),
  period: z.number().int().positive().optional(),
  source: z.enum(["close", "volume"]).optional(),
  band: z.enum(["upper", "mid", "lower"]).optional(),
  multiplier: z.number().optional(),
});
export type IndicatorRef = z.infer<typeof indicatorRefSchema>;

export const constRefSchema = z.object({ const: z.number() });
export type ConstRef = z.infer<typeof constRefSchema>;

export const fieldRefSchema = z.object({ field: z.literal("marketCap") });
export type FieldRef = z.infer<typeof fieldRefSchema>;

export const operandSchema = z.union([indicatorRefSchema, constRefSchema, fieldRefSchema]);
export type Operand = z.infer<typeof operandSchema>;

export const comparatorSchema = z.enum([">", "<", ">=", "<=", "==", "!="]);
export type Comparator = z.infer<typeof comparatorSchema>;

export interface Condition {
  lhs: Operand;
  cmp: Comparator;
  rhs: Operand;
}
export interface ConditionGroup {
  op: "AND" | "OR";
  conditions: RuleCondition[];
}
export type RuleCondition = Condition | ConditionGroup;

const conditionSchema: z.ZodType<Condition> = z.object({
  lhs: operandSchema,
  cmp: comparatorSchema,
  rhs: operandSchema,
});

const ruleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.union([
    conditionSchema,
    z.object({
      op: z.enum(["AND", "OR"]),
      conditions: z.array(ruleConditionSchema).min(1),
    }),
  ])
);

export const stopRuleSchema = z.union([
  z.object({ type: z.literal("atr"), period: z.number().int().positive(), multiplier: z.number().positive() }),
  z.object({ type: z.literal("pct"), value: z.number().positive() }),
  z.object({ type: z.literal("fixed"), value: z.number().positive() }),
]);
export type StopRule = z.infer<typeof stopRuleSchema>;

export const targetRuleSchema = z.object({ type: z.literal("pct"), value: z.number().positive() });
export type TargetRule = z.infer<typeof targetRuleSchema>;

export const ruleDefinitionSchema = z.object({
  entry: ruleConditionSchema,
  exclude: ruleConditionSchema.optional(),
  exit: z.object({
    stop: stopRuleSchema,
    target: targetRuleSchema.optional(),
    timeStop: z.object({ bars: z.number().int().positive() }).optional(),
  }),
  sizing: z.object({ riskPct: z.number().positive() }),
  costs: z.object({
    feeBps: z.number().min(0),
    taxBps: z.number().min(0),
    slippageBps: z.number().min(0),
  }),
  universe: z
    .object({
      market: z.enum(["KOSPI", "KOSDAQ"]).optional(),
      minMarketCap: z.number().nonnegative().optional(),
      maxMarketCap: z.number().nonnegative().optional(),
    })
    .optional(),
  maxConcurrentPositions: z.number().int().positive().default(5),
});
export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;

// One indicator series per bar array, keyed by a canonical string so the
// same underlying computation (e.g. sma of close, period 20) is shared by
// every condition that references it instead of being recomputed per check.
export type IndicatorSeriesMap = Record<string, (number | null)[]>;

export interface BarSeries {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  foreignNet: number[];
}

function seriesKey(ref: IndicatorRef): string {
  return [ref.indicator, ref.source ?? "close", ref.period ?? "", ref.band ?? ""].join(":");
}

function sourceValues(bars: BarSeries, source: "close" | "volume" | undefined): number[] {
  return source === "volume" ? bars.volume : bars.close;
}

// Scans a rule tree and computes every indicator series it references, once.
export function buildIndicatorSeries(bars: BarSeries, rule: RuleDefinition): IndicatorSeriesMap {
  const map: IndicatorSeriesMap = {};

  function visitOperand(op: Operand) {
    if (!("indicator" in op)) return;
    const key = seriesKey(op);
    if (map[key]) return;

    switch (op.indicator) {
      case "close":
        map[key] = bars.close;
        break;
      case "open":
        map[key] = bars.open;
        break;
      case "high":
        map[key] = bars.high;
        break;
      case "low":
        map[key] = bars.low;
        break;
      case "volume":
        map[key] = bars.volume;
        break;
      case "sma":
        map[key] = calcSMA(sourceValues(bars, op.source), op.period ?? 20);
        break;
      case "ema":
        map[key] = calcEMA(sourceValues(bars, op.source), op.period ?? 20);
        break;
      case "rsi":
        map[key] = calcRSI(bars.close, op.period ?? 14);
        break;
      case "atr":
        map[key] = calcATR(bars.high, bars.low, bars.close, op.period ?? 14);
        break;
      case "bbands": {
        // Only the requested band is stored; re-deriving it from calcSMA
        // (already O(n)) rather than pulling in the full bbands struct here.
        const period = op.period ?? 20;
        const mult = op.multiplier ?? 2;
        const mid = calcSMA(bars.close, period);
        map[key] = mid.map((m, i) => {
          if (m === null) return null;
          if (op.band === "mid" || !op.band) return m;
          const window = bars.close.slice(Math.max(0, i - period + 1), i + 1);
          const variance = window.reduce((s, v) => s + (v - m) ** 2, 0) / period;
          const stdev = Math.sqrt(variance);
          return op.band === "upper" ? m + mult * stdev : m - mult * stdev;
        });
        break;
      }
      case "highest":
        map[key] = calcHighest(bars.high, op.period ?? 20);
        break;
      case "lowest":
        map[key] = calcLowest(bars.low, op.period ?? 20);
        break;
      case "foreignNetSum":
        map[key] = calcRollingSum(bars.foreignNet, op.period ?? 20);
        break;
    }
  }

  function visitCondition(c: RuleCondition) {
    if ("op" in c) {
      c.conditions.forEach(visitCondition);
    } else {
      visitOperand(c.lhs);
      visitOperand(c.rhs);
    }
  }

  visitCondition(rule.entry);
  if (rule.exclude) visitCondition(rule.exclude);
  if (rule.exit.stop.type === "atr") {
    visitOperand({ indicator: "atr", period: rule.exit.stop.period });
  }

  return map;
}

function resolveOperand(
  op: Operand,
  series: IndicatorSeriesMap,
  marketCap: number | null,
  index: number
): number | null {
  if ("const" in op) return op.const;
  if ("field" in op) return marketCap;

  const value = series[seriesKey(op)]?.[index] ?? null;
  if (value === null) return null;
  return op.multiplier !== undefined ? value * op.multiplier : value;
}

function compare(lhs: number, cmp: Comparator, rhs: number): boolean {
  switch (cmp) {
    case ">":
      return lhs > rhs;
    case "<":
      return lhs < rhs;
    case ">=":
      return lhs >= rhs;
    case "<=":
      return lhs <= rhs;
    case "==":
      return lhs === rhs;
    case "!=":
      return lhs !== rhs;
  }
}

// Evaluates a (possibly nested) condition tree at one bar index. Returns
// false — never throws — when an operand isn't available yet (indicator
// warm-up period), so a strategy simply can't fire until its inputs exist.
export function evaluateCondition(
  condition: RuleCondition,
  series: IndicatorSeriesMap,
  marketCap: number | null,
  index: number
): boolean {
  if ("op" in condition) {
    const results = condition.conditions.map((c) => evaluateCondition(c, series, marketCap, index));
    return condition.op === "AND" ? results.every(Boolean) : results.some(Boolean);
  }

  const lhs = resolveOperand(condition.lhs, series, marketCap, index);
  const rhs = resolveOperand(condition.rhs, series, marketCap, index);
  if (lhs === null || rhs === null) return false;
  return compare(lhs, condition.cmp, rhs);
}
