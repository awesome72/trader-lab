import { calcRealizedR } from "./r-multiple";
import type { Trade, TradeEvent } from "./types";

export type CounterfactualScenario =
  | "actual"
  | "stopDiscipline"
  | "targetDiscipline"
  | "noAveraging"
  | "processFilter70"
  | "noFomo"
  | "topHalfConfidence";

export const COUNTERFACTUAL_SCENARIOS: CounterfactualScenario[] = [
  "actual",
  "stopDiscipline",
  "targetDiscipline",
  "noAveraging",
  "processFilter70",
  "noFomo",
  "topHalfConfidence",
];

interface ClosedTrade extends Trade {
  realizedR: number;
}

function closedChrono(trades: Trade[]): ClosedTrade[] {
  return trades
    .filter((t): t is ClosedTrade => t.realizedR !== null)
    .sort((a, b) => (a.exitAt ?? a.entryAt ?? "").localeCompare(b.exitAt ?? b.entryAt ?? ""));
}

// True when a trade has at least one add_position event filled at a worse
// price than entry (i.e. averaging into a loser). Declared at add-time from
// that same trade's own history — no reference to later trades or prices.
function wasAveragedDownWhileLosing(trade: Trade, events: TradeEvent[]): boolean {
  return events.some((e) => {
    if (e.kind !== "add_position" || e.tradeId !== trade.id) return false;
    const price = e.payload?.price;
    if (typeof price !== "number" || trade.entryPrice === null) return false;
    return trade.direction === "long"
      ? price < trade.entryPrice
      : price > trade.entryPrice;
  });
}

/**
 * Applies one counterfactual scenario to a trade's realized R. Every rule
 * here only uses facts already fixed by the end of that trade's own life
 * (its own maeR/mfeR excursions, its own pre-declared stop/target/confidence,
 * its own events) — never another trade's outcome or a price seen after the
 * trade closed. `null` means "exclude this trade from the scenario" (the
 * trader would not have taken or counted it), as opposed to a replacement R.
 */
function applyScenario(
  trade: ClosedTrade,
  events: TradeEvent[],
  scenario: CounterfactualScenario,
  medianConfidence: number
): number | null {
  switch (scenario) {
    case "actual":
      return trade.realizedR;

    case "stopDiscipline": {
      // If price ever breached the pre-declared stop (maeR <= -1R), the
      // disciplined outcome is exactly a stop fill at -1R — never whatever
      // actually happened afterward (holding, hoping, exiting later/worse).
      if (trade.maeR !== null && trade.maeR <= -1) return -1;
      return trade.realizedR;
    }

    case "targetDiscipline": {
      if (trade.entryPrice === null || trade.target1Price === null) {
        return trade.realizedR;
      }
      const targetR = calcRealizedR(
        trade.entryPrice,
        trade.stopPrice,
        trade.target1Price,
        trade.direction
      );
      if (targetR === null || trade.mfeR === null) return trade.realizedR;
      // Price reached the pre-declared target at some point; disciplined
      // exit takes it there instead of whatever happened afterward.
      if (trade.mfeR >= targetR) return targetR;
      return trade.realizedR;
    }

    case "noAveraging": {
      // Without the add, the trade plays out as a plain stop-out at -1R
      // instead of whatever the enlarged, averaged-down position returned.
      if (wasAveragedDownWhileLosing(trade, events)) return -1;
      return trade.realizedR;
    }

    case "processFilter70":
      return trade.processScore !== null && trade.processScore >= 70
        ? trade.realizedR
        : null;

    case "noFomo":
      return trade.emotionTags.includes("fomo") ? null : trade.realizedR;

    case "topHalfConfidence":
      return trade.confidence >= medianConfidence ? trade.realizedR : null;

    default:
      return trade.realizedR;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface CounterfactualPoint {
  tradeId: string;
  at: string;
  r: number;
  cumulativeR: number;
}

export interface CounterfactualResult {
  scenario: CounterfactualScenario;
  points: CounterfactualPoint[];
  cumulativeR: number;
  maxDrawdownR: number;
  tradeCount: number;
}

export function calcCounterfactualCurve(
  trades: Trade[],
  events: TradeEvent[],
  scenario: CounterfactualScenario
): CounterfactualResult {
  const closed = closedChrono(trades);
  const medianConfidence = median(closed.map((t) => t.confidence));

  const points: CounterfactualPoint[] = [];
  let cumulative = 0;
  let peak = 0;
  let maxDrawdownR = 0;

  for (const t of closed) {
    const r = applyScenario(t, events, scenario, medianConfidence);
    if (r === null) continue;
    cumulative += r;
    peak = Math.max(peak, cumulative);
    maxDrawdownR = Math.min(maxDrawdownR, cumulative - peak);
    points.push({
      tradeId: t.id,
      at: t.exitAt ?? t.entryAt ?? "",
      r,
      cumulativeR: cumulative,
    });
  }

  return {
    scenario,
    points,
    cumulativeR: cumulative,
    maxDrawdownR,
    tradeCount: points.length,
  };
}

export function runCounterfactualScenarios(
  trades: Trade[],
  events: TradeEvent[]
): CounterfactualResult[] {
  return COUNTERFACTUAL_SCENARIOS.map((scenario) =>
    calcCounterfactualCurve(trades, events, scenario)
  );
}

export interface CounterfactualSummaryRow {
  scenario: CounterfactualScenario;
  cumulativeR: number;
  maxDrawdownR: number;
  tradeCount: number;
  diffVsActual: number;
}

export function summarizeCounterfactuals(
  results: CounterfactualResult[]
): CounterfactualSummaryRow[] {
  const actualCumR =
    results.find((r) => r.scenario === "actual")?.cumulativeR ?? 0;
  return results.map((r) => ({
    scenario: r.scenario,
    cumulativeR: r.cumulativeR,
    maxDrawdownR: r.maxDrawdownR,
    tradeCount: r.tradeCount,
    diffVsActual: r.cumulativeR - actualCumR,
  }));
}

const SCENARIO_BEHAVIOR_LABELS: Record<
  Exclude<CounterfactualScenario, "actual">,
  string
> = {
  stopDiscipline: "손절 규칙을 예외 없이 지키는 것",
  targetDiscipline: "목표가에 도달했을 때 익절 규칙을 지키는 것",
  noAveraging: "손실 중인 포지션에 물타기하지 않는 것",
  processFilter70: "프로세스 점수 70점 미만인 거래를 거르는 것",
  noFomo: "FOMO 추격 매매를 하지 않는 것",
  topHalfConfidence: "확신도 상위 절반의 거래에만 집중하는 것",
};

// Picks the scenario with the largest improvement over actual and phrases it
// as the spec-mandated conclusion sentence. Falls back to a "you're already
// disciplined" message when no scenario clears the 1R bar.
export function generateCounterfactualConclusion(
  rows: CounterfactualSummaryRow[]
): string {
  const candidates = rows.filter(
    (r): r is CounterfactualSummaryRow & { scenario: Exclude<CounterfactualScenario, "actual"> } =>
      r.scenario !== "actual"
  );
  if (candidates.length === 0) return "현재 규칙 준수도가 높습니다.";

  const best = candidates.reduce((a, b) => (b.diffVsActual > a.diffVsActual ? b : a));
  if (best.diffVsActual < 1) return "현재 규칙 준수도가 높습니다.";

  const behavior = SCENARIO_BEHAVIOR_LABELS[best.scenario];
  return `당신에게 필요한 것은 더 나은 종목이 아니라 ${behavior}입니다. (+${best.diffVsActual.toFixed(1)}R)`;
}
