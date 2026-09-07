import { and, asc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbTradeEventToDomain, dbTradeToDomain } from "@/lib/db/mappers";
import { ohlcvDaily, tradeEvents, trades } from "@/lib/db/schema";
import type { DailyBar } from "@/lib/domain/price-range";
import type { SourceType, Trade, TradeEvent } from "@/lib/domain/types";

export const PERIOD_DAYS: Record<string, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

export async function getFilteredTrades(
  userId: string,
  opts: { period?: string; source?: SourceType }
): Promise<Trade[]> {
  const conditions: SQL[] = [
    eq(trades.userId, userId),
    eq(trades.source, opts.source ?? "live"),
  ];

  if (opts.period && PERIOD_DAYS[opts.period]) {
    const since = new Date();
    since.setDate(since.getDate() - PERIOD_DAYS[opts.period]);
    conditions.push(gte(trades.entryAt, since));
  }

  const rows = await db
    .select()
    .from(trades)
    .where(and(...conditions));

  return rows.map(dbTradeToDomain);
}

export async function getTradesBetween(
  userId: string,
  source: SourceType,
  from: Date,
  to: Date
): Promise<Trade[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.source, source),
        gte(trades.entryAt, from)
      )
    );

  return rows
    .map(dbTradeToDomain)
    .filter((t) => t.entryAt !== null && new Date(t.entryAt) < to);
}

// Joins through trades to enforce ownership (tradeEvents has no userId column
// of its own; Drizzle bypasses RLS, so this join is the actual security
// boundary here — see lib/db/index.ts).
export async function getEventsForTrades(
  userId: string,
  tradeIds: string[]
): Promise<TradeEvent[]> {
  if (tradeIds.length === 0) return [];

  const rows = await db
    .select({ event: tradeEvents })
    .from(tradeEvents)
    .innerJoin(trades, eq(tradeEvents.tradeId, trades.id))
    .where(and(eq(trades.userId, userId), inArray(tradeEvents.tradeId, tradeIds)));

  return rows.map((r) => dbTradeEventToDomain(r.event));
}

// Market data has no userId column (it's shared, not user-owned), so no
// ownership filter is needed here — just the ticker. Used by the close-trade
// form (app/journal/[id]/close) to auto-fill MAE/MFE lows/highs when the
// collector has already backfilled this ticker; falls back to manual entry
// (via lib/domain/price-range.ts returning null) when it hasn't.
export async function getOhlcvBarsSince(ticker: string, fromDate: string): Promise<DailyBar[]> {
  const rows = await db
    .select({ d: ohlcvDaily.d, low: ohlcvDaily.low, high: ohlcvDaily.high })
    .from(ohlcvDaily)
    .where(and(eq(ohlcvDaily.ticker, ticker), gte(ohlcvDaily.d, fromDate)))
    .orderBy(asc(ohlcvDaily.d));

  return rows
    .filter((r): r is { d: string; low: number; high: number } => r.low !== null && r.high !== null)
    .map((r) => ({ d: r.d, low: r.low, high: r.high }));
}
