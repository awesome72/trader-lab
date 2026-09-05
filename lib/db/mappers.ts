import type { InferSelectModel } from "drizzle-orm";
import type { profiles, trades, tradeEvents } from "./schema";
import type { ProfileSettings, Trade, TradeEvent } from "@/lib/domain/types";

type TradeRow = InferSelectModel<typeof trades>;
type TradeEventRow = InferSelectModel<typeof tradeEvents>;
type ProfileRow = InferSelectModel<typeof profiles>;

// Adapts DB rows (Date objects, DB enum unions) into the plain, JSON-safe
// shape lib/domain/ functions expect (ISO date strings). Domain code must
// never import from lib/db/, so this conversion lives here instead.
export function dbTradeToDomain(row: TradeRow): Trade {
  return {
    id: row.id,
    userId: row.userId,
    source: row.source,
    ticker: row.ticker,
    maskedLabel: row.maskedLabel,
    status: row.status,
    entryAt: row.entryAt ? row.entryAt.toISOString() : null,
    entryPrice: row.entryPrice,
    quantity: row.quantity,
    direction: row.direction === "short" ? "short" : "long",
    thesis: row.thesis,
    setup: row.setup,
    horizon: row.horizon,
    invalidation: row.invalidation,
    stopPrice: row.stopPrice,
    stopBasis: row.stopBasis,
    target1Price: row.target1Price,
    target2Price: row.target2Price,
    confidence: row.confidence,
    plannedRiskPct: row.plannedRiskPct,
    plannedRMultiple: row.plannedRMultiple,
    emotionTags: row.emotionTags ?? [],
    prevTradePnlR: row.prevTradePnlR,
    conditionScore: row.conditionScore,
    exitAt: row.exitAt ? row.exitAt.toISOString() : null,
    exitPrice: row.exitPrice,
    exitReason:
      row.exitReason === "stop" ||
      row.exitReason === "target" ||
      row.exitReason === "discretionary" ||
      row.exitReason === "time"
        ? row.exitReason
        : null,
    realizedR: row.realizedR,
    realizedPnl: row.realizedPnl,
    maeR: row.maeR,
    mfeR: row.mfeR,
    processScore: row.processScore,
    processBreakdown:
      (row.processBreakdown as Record<string, number> | null) ?? null,
    quadrant:
      row.quadrant === "skill" ||
      row.quadrant === "luck" ||
      row.quadrant === "badluck" ||
      row.quadrant === "mistake"
        ? row.quadrant
        : null,
    journalLockedAt: row.journalLockedAt
      ? row.journalLockedAt.toISOString()
      : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : "",
  };
}

export function dbProfileToDomain(row: ProfileRow): ProfileSettings {
  return {
    id: row.id,
    displayName: row.displayName,
    accountSize: row.accountSize,
    defaultRiskPct: row.defaultRiskPct,
    maxRiskPct: row.maxRiskPct,
    feeBps: row.feeBps,
    taxBps: row.taxBps,
    slippageBps: row.slippageBps,
    createdAt: row.createdAt ? row.createdAt.toISOString() : "",
  };
}

export function dbTradeEventToDomain(row: TradeEventRow): TradeEvent {
  return {
    id: row.id,
    tradeId: row.tradeId,
    at: row.at ? row.at.toISOString() : "",
    kind: row.kind as TradeEvent["kind"],
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    note: row.note,
  };
}
