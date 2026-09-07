import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  backtestRuns,
  calibrationRecords,
  coachSessions,
  drillResponses,
  profiles,
  replaySessions,
  ruleSets,
  srsCards,
  tradeEvents,
  trades,
} from "@/lib/db/schema";
import { dbTradeToDomain } from "@/lib/db/mappers";
import { toCsv } from "@/lib/csv";

// docs/SPEC.md Phase 10-4: "전체 데이터 JSON 내보내기 (사용자 소유권 보장)" —
// every table that stores something the user created or declared, scoped to
// their own userId (or, for trade_events/backtest_runs, to their own
// trades/rule_sets, since those tables have no userId column of their own).
export async function exportAllUserData(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  const tradeRows = await db.select().from(trades).where(eq(trades.userId, userId));
  const tradeIds = tradeRows.map((t) => t.id);
  const eventRows =
    tradeIds.length > 0
      ? await db.select().from(tradeEvents).where(inArray(tradeEvents.tradeId, tradeIds))
      : [];

  const calibrationRows = await db.select().from(calibrationRecords).where(eq(calibrationRecords.userId, userId));
  const drillResponseRows = await db.select().from(drillResponses).where(eq(drillResponses.userId, userId));
  const srsCardRows = await db.select().from(srsCards).where(eq(srsCards.userId, userId));
  const coachSessionRows = await db.select().from(coachSessions).where(eq(coachSessions.userId, userId));
  const ruleSetRows = await db.select().from(ruleSets).where(eq(ruleSets.userId, userId));
  const ruleSetIds = ruleSetRows.map((r) => r.id);
  const backtestRunRows =
    ruleSetIds.length > 0
      ? await db.select().from(backtestRuns).where(inArray(backtestRuns.ruleSetId, ruleSetIds))
      : [];
  const replaySessionRows = await db.select().from(replaySessions).where(eq(replaySessions.userId, userId));

  return {
    exportedAt: new Date().toISOString(),
    profile,
    trades: tradeRows,
    tradeEvents: eventRows,
    calibrationRecords: calibrationRows,
    drillResponses: drillResponseRows,
    srsCards: srsCardRows,
    coachSessions: coachSessionRows,
    ruleSets: ruleSetRows,
    backtestRuns: backtestRunRows,
    replaySessions: replaySessionRows,
  };
}

const TRADE_CSV_HEADERS = [
  "id", "source", "ticker", "status", "direction",
  "entryAt", "entryPrice", "quantity",
  "thesis", "setup", "horizon", "invalidation", "stopPrice", "stopBasis",
  "target1Price", "target2Price", "confidence", "plannedRiskPct",
  "exitAt", "exitPrice", "exitReason",
  "realizedR", "realizedPnl", "maeR", "mfeR",
  "processScore", "quadrant", "emotionTags",
];

// Spreadsheet-friendly counterpart to exportAllUserData's JSON dump — just
// the trades table (the one most people actually want to pivot/chart in
// Excel/Sheets), flattened to one row per trade.
export async function exportTradesAsCsv(userId: string): Promise<string> {
  const tradeRows = (await db.select().from(trades).where(eq(trades.userId, userId))).map(dbTradeToDomain);

  const rows = tradeRows.map((t) => [
    t.id, t.source, t.ticker, t.status, t.direction,
    t.entryAt, t.entryPrice, t.quantity,
    t.thesis, t.setup, t.horizon, t.invalidation, t.stopPrice, t.stopBasis,
    t.target1Price, t.target2Price, t.confidence, t.plannedRiskPct,
    t.exitAt, t.exitPrice, t.exitReason,
    t.realizedR, t.realizedPnl, t.maeR, t.mfeR,
    t.processScore, t.quadrant, t.emotionTags.join("|"),
  ]);

  return toCsv(TRADE_CSV_HEADERS, rows);
}
