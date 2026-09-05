// Types mirror docs/SPEC.md PART D SQL schema 1:1. Field names are camelCase
// equivalents of the snake_case DB columns.

export type SourceType = "live" | "replay" | "drill";
export type TradeStatus = "planned" | "open" | "closed" | "cancelled";
export type SetupType =
  | "breakout"
  | "pullback"
  | "reversal"
  | "earnings"
  | "flow"
  | "event"
  | "other";
export type HorizonType = "scalp" | "day" | "swing" | "position";
export type StopBasis = "technical" | "atr" | "max_loss" | "time";
export type Direction = "long" | "short";
export type ExitReason = "stop" | "target" | "discretionary" | "time";
export type Quadrant = "skill" | "luck" | "badluck" | "mistake";

export interface Trade {
  id: string;
  userId: string;
  source: SourceType;
  ticker: string | null;
  maskedLabel: string | null;
  status: TradeStatus;
  replaySessionId: string | null;

  // Entry (append-only once journalLockedAt is set)
  entryAt: string | null;
  entryPrice: number | null;
  quantity: number | null;
  direction: Direction;

  // Pre-commitment
  thesis: string;
  setup: SetupType;
  horizon: HorizonType;
  invalidation: string;
  stopPrice: number;
  stopBasis: StopBasis;
  target1Price: number | null;
  target2Price: number | null;
  confidence: number; // 0-100
  plannedRiskPct: number | null;
  plannedRMultiple: number | null;

  // Psychological state
  emotionTags: string[];
  prevTradePnlR: number | null;
  conditionScore: number | null; // 1-5

  // Exit
  exitAt: string | null;
  exitPrice: number | null;
  exitReason: ExitReason | null;
  realizedR: number | null;
  realizedPnl: number | null;
  maeR: number | null; // Maximum Adverse Excursion, in R
  mfeR: number | null; // Maximum Favorable Excursion, in R

  // Scoring
  processScore: number | null;
  processBreakdown: Record<string, number> | null;
  quadrant: Quadrant | null;

  journalLockedAt: string | null;
  createdAt: string;
}

export type TradeEventKind =
  | "add_position"
  | "reduce"
  | "move_stop"
  | "note"
  | "emotion";

export interface TradeEvent {
  id: string;
  tradeId: string;
  at: string;
  kind: TradeEventKind;
  payload: Record<string, unknown> | null;
  note: string | null;
}

export interface ProfileSettings {
  id: string;
  displayName: string | null;
  accountSize: number;
  defaultRiskPct: number;
  maxRiskPct: number;
  feeBps: number;
  taxBps: number;
  slippageBps: number;
  createdAt: string;
}
