import type { ProfileSettings, Quadrant, Trade, TradeEvent } from "./types";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const INDICATOR_KEYWORDS =
  /(이평|이동평균|RSI|거래량|지지|저항|%)/i;

export interface ProcessScoreBreakdown {
  hasPlan: number;
  invalidationQuality: number;
  stopDiscipline: number;
  sizing: number;
  noAveragingDown: number;
  horizonRespect: number;
  emotion: number;
}

export interface ProcessScoreResult {
  total: number;
  breakdown: ProcessScoreBreakdown;
}

function scoreHasPlan(trade: Trade): number {
  if (!trade.entryAt || !trade.journalLockedAt) return 0;
  const entryMs = new Date(trade.entryAt).getTime();
  const lockedMs = new Date(trade.journalLockedAt).getTime();
  const diffMinutes = (lockedMs - entryMs) / MS_PER_MINUTE;
  return diffMinutes >= 0 && diffMinutes <= 30 ? 20 : 0;
}

function scoreInvalidationQuality(trade: Trade): number {
  const text = trade.invalidation ?? "";
  const isVerifiable = INDICATOR_KEYWORDS.test(text) || /\d/.test(text);
  if (text.length >= 20 && isVerifiable) return 15;
  if (text.length >= 20) return 8;
  return 0;
}

function wasStopMovedUnfavorably(trade: Trade, events: TradeEvent[]): boolean {
  return events.some((e) => {
    if (e.kind !== "move_stop" || e.tradeId !== trade.id) return false;
    const from = e.payload?.from;
    const to = e.payload?.to;
    if (typeof from !== "number" || typeof to !== "number") return false;
    return trade.direction === "long" ? to < from : to > from;
  });
}

function scoreStopDiscipline(trade: Trade, events: TradeEvent[]): number {
  if (wasStopMovedUnfavorably(trade, events)) return 0;
  // We don't have a bar-by-bar OHLC feed here, so we use maeR (Maximum
  // Adverse Excursion, in R) as a proxy for "did price ever breach the
  // planned stop": maeR <= -1 means price moved at least 1R against the
  // plan at some point during the holding period.
  const stopBreached = trade.maeR !== null && trade.maeR <= -1;
  if (stopBreached && trade.exitReason !== "stop") return 0;
  return 25;
}

function scoreSizing(trade: Trade, settings: ProfileSettings): number {
  if (trade.plannedRiskPct === null) return 0;
  if (trade.plannedRiskPct <= settings.maxRiskPct) return 15;
  if (trade.plannedRiskPct <= settings.maxRiskPct * 1.5) return 7;
  return 0;
}

function scoreNoAveragingDown(trade: Trade, events: TradeEvent[]): number {
  const addedWhileLosing = events.some((e) => {
    if (e.kind !== "add_position" || e.tradeId !== trade.id) return false;
    const price = e.payload?.price;
    if (typeof price !== "number" || trade.entryPrice === null) return false;
    return trade.direction === "long"
      ? price < trade.entryPrice
      : price > trade.entryPrice;
  });
  return addedWhileLosing ? 0 : 10;
}

function scoreHorizonRespect(trade: Trade): number {
  if (!trade.entryAt || !trade.exitAt) return 0;
  const holdingDays =
    (new Date(trade.exitAt).getTime() - new Date(trade.entryAt).getTime()) /
    MS_PER_DAY;

  switch (trade.horizon) {
    case "scalp":
      return holdingDays < 1 ? 10 : 0;
    case "day":
      return holdingDays <= 1 ? 10 : 0;
    case "swing":
      return holdingDays >= 2 && holdingDays <= 10 ? 10 : 0;
    case "position":
      return holdingDays >= 10 ? 10 : 0;
    default:
      return 0;
  }
}

function scoreEmotion(trade: Trade): number {
  const hasRiskyTag = trade.emotionTags.some((tag) =>
    ["fomo", "revenge"].includes(tag.toLowerCase())
  );
  return hasRiskyTag ? 0 : 5;
}

export function calcProcessScore(
  trade: Trade,
  events: TradeEvent[],
  settings: ProfileSettings
): ProcessScoreResult {
  const breakdown: ProcessScoreBreakdown = {
    hasPlan: scoreHasPlan(trade),
    invalidationQuality: scoreInvalidationQuality(trade),
    stopDiscipline: scoreStopDiscipline(trade, events),
    sizing: scoreSizing(trade, settings),
    noAveragingDown: scoreNoAveragingDown(trade, events),
    horizonRespect: scoreHorizonRespect(trade),
    emotion: scoreEmotion(trade),
  };

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { total, breakdown };
}

export function calcQuadrant(
  processScore: number,
  realizedR: number
): Quadrant {
  const goodProcess = processScore >= 70;
  const goodOutcome = realizedR > 0;
  if (goodProcess && goodOutcome) return "skill";
  if (!goodProcess && goodOutcome) return "luck";
  if (goodProcess && !goodOutcome) return "badluck";
  return "mistake";
}

const QUADRANTS: readonly Quadrant[] = ["skill", "luck", "badluck", "mistake"];

// Percentage share of each quadrant (0-100), ignoring trades with no
// quadrant yet (still open). Returns all-zero if there are none.
export function calcQuadrantDistribution(
  quadrants: (Quadrant | null)[]
): Record<Quadrant, number> {
  const resolved = quadrants.filter((q): q is Quadrant => q !== null);
  const result = { skill: 0, luck: 0, badluck: 0, mistake: 0 };
  if (resolved.length === 0) return result;

  for (const q of QUADRANTS) {
    result[q] = (resolved.filter((r) => r === q).length / resolved.length) * 100;
  }
  return result;
}

// Per-item average across a set of process-score breakdowns (e.g. for "which
// component is weakest this month"). Returns null for an empty input.
export function calcAverageBreakdown(
  breakdowns: ProcessScoreBreakdown[]
): ProcessScoreBreakdown | null {
  if (breakdowns.length === 0) return null;

  const keys = Object.keys(breakdowns[0]) as (keyof ProcessScoreBreakdown)[];
  const result = {} as ProcessScoreBreakdown;
  for (const key of keys) {
    result[key] =
      breakdowns.reduce((sum, b) => sum + b[key], 0) / breakdowns.length;
  }
  return result;
}
