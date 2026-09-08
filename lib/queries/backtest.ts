import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { backtestRuns, investorFlow, ohlcvDaily, ruleSets, tickerMaster } from "@/lib/db/schema";
import type { TickerUniverseEntry } from "@/lib/domain/backtest";
import type { RuleDefinition } from "@/lib/domain/rule-dsl";

export interface UniverseFilters {
  market?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  tickers?: string[];
}

export async function getUniverseBars(filters: UniverseFilters): Promise<TickerUniverseEntry[]> {
  // Only scripts/collector/backfill.py's tracked set (see
  // select_universe.py) ever has ohlcv_daily rows to begin with, so
  // filtering here up front avoids an empty round-trip query per
  // untracked ticker_master row (~2,400+ of them) on every backtest run.
  const conditions = [eq(tickerMaster.isTracked, true)];
  if (filters.market) conditions.push(eq(tickerMaster.market, filters.market));
  if (filters.minMarketCap !== undefined) conditions.push(gte(tickerMaster.marketCap, filters.minMarketCap));
  if (filters.maxMarketCap !== undefined) conditions.push(lte(tickerMaster.marketCap, filters.maxMarketCap));
  if (filters.tickers && filters.tickers.length > 0) {
    conditions.push(sql`${tickerMaster.ticker} = ANY(${filters.tickers})`);
  }

  const tickers = await db
    .select()
    .from(tickerMaster)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  if (tickers.length === 0) return [];

  const tickerCodes = tickers.map((t) => t.ticker);

  // Two queries total instead of two per ticker (previously up to ~325
  // round trips for the tracked universe) — grouped by ticker in JS below.
  const [allBars, allFlow] = await Promise.all([
    db
      .select()
      .from(ohlcvDaily)
      .where(inArray(ohlcvDaily.ticker, tickerCodes))
      .orderBy(asc(ohlcvDaily.ticker), asc(ohlcvDaily.d)),
    db
      .select()
      .from(investorFlow)
      .where(inArray(investorFlow.ticker, tickerCodes))
      .orderBy(asc(investorFlow.ticker), asc(investorFlow.d)),
  ]);

  const barsByTicker = new Map<string, typeof allBars>();
  for (const bar of allBars) {
    const list = barsByTicker.get(bar.ticker);
    if (list) list.push(bar);
    else barsByTicker.set(bar.ticker, [bar]);
  }

  const flowByTicker = new Map<string, Map<string, number>>();
  for (const flow of allFlow) {
    let byDate = flowByTicker.get(flow.ticker);
    if (!byDate) {
      byDate = new Map();
      flowByTicker.set(flow.ticker, byDate);
    }
    byDate.set(flow.d, flow.foreignNet ?? 0);
  }

  const entries: TickerUniverseEntry[] = [];
  for (const t of tickers) {
    const rows = barsByTicker.get(t.ticker);
    if (!rows || rows.length === 0) continue;
    const flowByDate = flowByTicker.get(t.ticker) ?? new Map<string, number>();

    entries.push({
      ticker: t.ticker,
      marketCap: t.marketCap,
      delistedAt: t.delistedAt,
      dates: rows.map((r) => r.d),
      open: rows.map((r) => r.open ?? 0),
      high: rows.map((r) => r.high ?? 0),
      low: rows.map((r) => r.low ?? 0),
      close: rows.map((r) => r.close ?? 0),
      volume: rows.map((r) => r.volume ?? 0),
      foreignNet: rows.map((r) => flowByDate.get(r.d) ?? 0),
    });
  }

  return entries;
}

export interface RunRecordInput {
  userId: string;
  ruleSetId?: string;
  name: string;
  definition: RuleDefinition;
}

export interface RuleSetRunInfo {
  ruleSetId: string;
  searchCount: number;
}

// Every *run* against a rule_set counts toward its search_count, per
// docs/SPEC.md Phase 7-4-2 (multiple-testing warning) — not just saves.
export async function recordRuleSetRun(input: RunRecordInput): Promise<RuleSetRunInfo> {
  if (input.ruleSetId) {
    const [existing] = await db
      .select()
      .from(ruleSets)
      .where(and(eq(ruleSets.id, input.ruleSetId), eq(ruleSets.userId, input.userId)));

    if (existing) {
      const nextCount = (existing.searchCount ?? 0) + 1;
      await db
        .update(ruleSets)
        .set({
          definition: input.definition,
          name: input.name,
          version: (existing.version ?? 1) + 1,
          searchCount: nextCount,
        })
        .where(eq(ruleSets.id, input.ruleSetId));
      return { ruleSetId: input.ruleSetId, searchCount: nextCount };
    }
  }

  const [created] = await db
    .insert(ruleSets)
    .values({
      userId: input.userId,
      name: input.name,
      definition: input.definition,
      version: 1,
      searchCount: 1,
    })
    .returning({ id: ruleSets.id });

  return { ruleSetId: created.id, searchCount: 1 };
}

export async function saveBacktestRun(
  ruleSetId: string,
  periodStart: string,
  periodEnd: string,
  metrics: unknown,
  equityCurve: unknown
): Promise<void> {
  await db.insert(backtestRuns).values({
    ruleSetId,
    periodStart,
    periodEnd,
    isOutOfSample: false,
    metrics,
    equityCurve,
  });
}
