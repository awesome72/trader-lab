import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbTradeToDomain } from "@/lib/db/mappers";
import { ohlcvDaily, profiles, replaySessions, tickerMaster, trades } from "@/lib/db/schema";
import { applyCosts, calcRealizedR, inferExitReason } from "@/lib/domain/r-multiple";
import { calcProcessScore, calcQuadrant } from "@/lib/domain/process-score";
import { selectReplayStart, type ReplayCandidate } from "@/lib/domain/replay";
import type { ProfileSettings, Trade } from "@/lib/domain/types";

// The only shape ever sent to the client before a session is revealed. No
// ticker, no real calendar date, no ticker/company name — see docs/SPEC.md
// Phase 6-1. `idx` is the bar's position in the session, not a timestamp.
export interface ReplayBarDTO {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  idx: number;
}

interface OhlcvRow {
  d: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

function toBarDTO(row: OhlcvRow, idx: number): ReplayBarDTO {
  return {
    o: row.open ?? 0,
    h: row.high ?? 0,
    l: row.low ?? 0,
    c: row.close ?? 0,
    v: row.volume ?? 0,
    idx,
  };
}

export interface ReplayFilters {
  market?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
}

async function findReplayCandidates(
  filters: ReplayFilters,
  minBars: number
): Promise<{ candidates: ReplayCandidate[]; datesByTicker: Map<string, string[]> }> {
  // Only the tracked set (scripts/collector/select_universe.py) ever has
  // ohlcv_daily rows — skips an empty per-ticker query for every untracked
  // ticker_master row otherwise.
  const conditions = [eq(tickerMaster.isTracked, true)];
  if (filters.market) conditions.push(eq(tickerMaster.market, filters.market));
  if (filters.minMarketCap !== undefined) {
    conditions.push(gte(tickerMaster.marketCap, filters.minMarketCap));
  }
  if (filters.maxMarketCap !== undefined) {
    conditions.push(lte(tickerMaster.marketCap, filters.maxMarketCap));
  }

  const tickers = await db
    .select({ ticker: tickerMaster.ticker })
    .from(tickerMaster)
    .where(and(...conditions));
  if (tickers.length === 0) return { candidates: [], datesByTicker: new Map() };

  const tickerCodes = tickers.map((t) => t.ticker);

  // One query instead of one per ticker (previously up to ~325 round
  // trips for the tracked universe) — grouped by ticker in JS below.
  const allDates = await db
    .select({ ticker: ohlcvDaily.ticker, d: ohlcvDaily.d })
    .from(ohlcvDaily)
    .where(inArray(ohlcvDaily.ticker, tickerCodes))
    .orderBy(asc(ohlcvDaily.ticker), asc(ohlcvDaily.d));

  const datesByTicker = new Map<string, string[]>();
  for (const row of allDates) {
    const list = datesByTicker.get(row.ticker);
    if (list) list.push(row.d);
    else datesByTicker.set(row.ticker, [row.d]);
  }

  const candidates: ReplayCandidate[] = [];
  for (const { ticker } of tickers) {
    const dates = datesByTicker.get(ticker) ?? [];
    for (let i = 0; i < dates.length; i++) {
      const availableBars = dates.length - i;
      if (availableBars >= minBars) {
        candidates.push({ ticker, startDate: dates[i], availableBars });
      }
    }
  }

  return { candidates, datesByTicker };
}

export async function createReplaySession(
  userId: string,
  opts: ReplayFilters & { level: number; seed: number }
): Promise<{ sessionId: string; initialBars: ReplayBarDTO[]; level: number } | { error: string }> {
  const minBars = 250;
  const { candidates } = await findReplayCandidates(opts, minBars);
  const chosen = selectReplayStart(candidates, opts.seed, minBars);

  if (!chosen) {
    return { error: "조건에 맞는 종목/구간을 찾을 수 없습니다. 필터를 조정해보세요." };
  }

  const initialCount = 120;
  const initialRows = await db
    .select()
    .from(ohlcvDaily)
    .where(and(eq(ohlcvDaily.ticker, chosen.ticker), gte(ohlcvDaily.d, chosen.startDate)))
    .orderBy(asc(ohlcvDaily.d))
    .limit(initialCount);

  const [session] = await db
    .insert(replaySessions)
    .values({
      userId,
      ticker: chosen.ticker,
      startDate: chosen.startDate,
      level: opts.level,
      seed: String(opts.seed),
      currentIndex: initialRows.length - 1,
      revealed: false,
    })
    .returning({ id: replaySessions.id });

  return {
    sessionId: session.id,
    initialBars: initialRows.map((row, i) => toBarDTO(row, i)),
    level: opts.level,
  };
}

export interface ReplaySessionRow {
  id: string;
  userId: string;
  ticker: string;
  startDate: string;
  currentIndex: number;
  level: number;
  seed: string | null;
  revealed: boolean;
}

export async function getReplaySessionForUser(
  sessionId: string,
  userId: string
): Promise<ReplaySessionRow | null> {
  const [row] = await db
    .select()
    .from(replaySessions)
    .where(and(eq(replaySessions.id, sessionId), eq(replaySessions.userId, userId)));
  return row ? { ...row, revealed: row.revealed ?? false } : null;
}

// Bars 0..currentIndex, already seen by this client — safe to resend on
// page refresh so the chart can be reconstructed without a running-state
// cache on the client.
export async function getRevealedBars(session: ReplaySessionRow): Promise<ReplayBarDTO[]> {
  const rows = await db
    .select()
    .from(ohlcvDaily)
    .where(and(eq(ohlcvDaily.ticker, session.ticker), gte(ohlcvDaily.d, session.startDate)))
    .orderBy(asc(ohlcvDaily.d))
    .limit(session.currentIndex + 1);

  return rows.map((row, i) => toBarDTO(row, i));
}

// The server is the only source of truth for progress: this always serves
// currentIndex + 1, never an index the client requests (docs/SPEC.md 6-6).
export async function advanceReplaySession(
  sessionId: string,
  userId: string
): Promise<{ bar: ReplayBarDTO } | { done: true } | { error: string }> {
  const session = await getReplaySessionForUser(sessionId, userId);
  if (!session) return { error: "세션을 찾을 수 없습니다." };
  if (session.revealed) return { error: "이미 종료된 세션입니다." };

  const nextIndex = session.currentIndex + 1;
  const [row] = await db
    .select()
    .from(ohlcvDaily)
    .where(and(eq(ohlcvDaily.ticker, session.ticker), gte(ohlcvDaily.d, session.startDate)))
    .orderBy(asc(ohlcvDaily.d))
    .limit(1)
    .offset(nextIndex);

  if (!row) return { done: true };

  await db
    .update(replaySessions)
    .set({ currentIndex: nextIndex })
    .where(
      and(
        eq(replaySessions.id, sessionId),
        eq(replaySessions.userId, userId),
        eq(replaySessions.currentIndex, session.currentIndex)
      )
    );

  return { bar: toBarDTO(row, nextIndex) };
}

async function getOpenReplayTrade(sessionId: string, userId: string) {
  const [row] = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.replaySessionId, sessionId),
        eq(trades.userId, userId),
        eq(trades.status, "open")
      )
    );
  return row ?? null;
}

// Public wrapper for pages restoring UI state on refresh (docs/SPEC.md
// 6-6: "새로고침해도 이어서 진행되어야 한다").
export async function getOpenPositionForSession(
  sessionId: string,
  userId: string
): Promise<Trade | null> {
  const row = await getOpenReplayTrade(sessionId, userId);
  return row ? dbTradeToDomain(row) : null;
}

async function getCurrentBarRow(session: ReplaySessionRow) {
  const [row] = await db
    .select()
    .from(ohlcvDaily)
    .where(and(eq(ohlcvDaily.ticker, session.ticker), gte(ohlcvDaily.d, session.startDate)))
    .orderBy(asc(ohlcvDaily.d))
    .limit(1)
    .offset(session.currentIndex);
  return row ?? null;
}

export interface OpenReplayTradeInput {
  thesis: string;
  invalidation: string;
  stopPrice: number;
  target1Price: number | null;
  confidence: number;
}

export async function openReplayTrade(
  sessionId: string,
  userId: string,
  input: OpenReplayTradeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getReplaySessionForUser(sessionId, userId);
  if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };
  if (session.revealed) return { ok: false, error: "이미 종료된 세션입니다." };

  const existingOpen = await getOpenReplayTrade(sessionId, userId);
  if (existingOpen) return { ok: false, error: "이미 보유 중인 포지션이 있습니다." };

  const bar = await getCurrentBarRow(session);
  if (!bar || bar.close === null) return { ok: false, error: "현재 봉 데이터를 찾을 수 없습니다." };

  const [settings] = await db.select().from(profiles).where(eq(profiles.id, userId));
  const riskPct = settings?.defaultRiskPct ?? 1;
  const accountSize = settings?.accountSize ?? 10_000_000;
  const riskPerShare = Math.abs(bar.close - input.stopPrice);
  const quantity = riskPerShare > 0 ? Math.floor((accountSize * (riskPct / 100)) / riskPerShare) : 0;

  await db.insert(trades).values({
    userId,
    source: "replay",
    ticker: null,
    maskedLabel: "종목 A",
    replaySessionId: sessionId,
    status: "open",
    entryAt: new Date(bar.d),
    entryPrice: bar.close,
    quantity: Math.max(1, quantity),
    direction: "long",
    thesis: input.thesis,
    setup: "other",
    horizon: "swing",
    invalidation: input.invalidation,
    stopPrice: input.stopPrice,
    stopBasis: "technical",
    target1Price: input.target1Price,
    confidence: input.confidence,
    plannedRiskPct: riskPct,
    emotionTags: [],
    journalLockedAt: new Date(),
  });

  return { ok: true };
}

export interface CloseReplayTradeResult {
  ok: true;
  realizedR: number;
  processScore: number;
  quadrant: string;
}

export async function closeReplayTrade(
  sessionId: string,
  userId: string
): Promise<CloseReplayTradeResult | { ok: false; error: string }> {
  const session = await getReplaySessionForUser(sessionId, userId);
  if (!session) return { ok: false, error: "세션을 찾을 수 없습니다." };

  const openTrade = await getOpenReplayTrade(sessionId, userId);
  if (!openTrade || openTrade.entryPrice === null || openTrade.entryAt === null) {
    return { ok: false, error: "청산할 포지션이 없습니다." };
  }

  const bar = await getCurrentBarRow(session);
  if (!bar || bar.close === null) return { ok: false, error: "현재 봉 데이터를 찾을 수 없습니다." };

  const direction = openTrade.direction === "short" ? "short" : "long";

  // Real historical extremes between entry and exit are available server-side
  // (unlike the manual-entry live journal), so MAE/MFE are computed exactly.
  const excursionRows = await db
    .select({ low: ohlcvDaily.low, high: ohlcvDaily.high })
    .from(ohlcvDaily)
    .where(
      and(
        eq(ohlcvDaily.ticker, session.ticker),
        gte(ohlcvDaily.d, openTrade.entryAt.toISOString().slice(0, 10)),
        lte(ohlcvDaily.d, bar.d)
      )
    );

  const lows = excursionRows.map((r) => r.low).filter((v): v is number => v !== null);
  const highs = excursionRows.map((r) => r.high).filter((v): v is number => v !== null);
  const worstPrice = direction === "long" ? Math.min(...lows, bar.close) : Math.max(...highs, bar.close);
  const bestPrice = direction === "long" ? Math.max(...highs, bar.close) : Math.min(...lows, bar.close);

  const grossR = calcRealizedR(openTrade.entryPrice, openTrade.stopPrice, bar.close, direction);
  if (grossR === null) return { ok: false, error: "손절가와 진입가가 같아 R을 계산할 수 없습니다." };
  const maeR = calcRealizedR(openTrade.entryPrice, openTrade.stopPrice, worstPrice, direction);
  const mfeR = calcRealizedR(openTrade.entryPrice, openTrade.stopPrice, bestPrice, direction);
  const exitReason = inferExitReason(direction, bar.close, openTrade.stopPrice, openTrade.target1Price);

  const [settingsRow] = await db.select().from(profiles).where(eq(profiles.id, userId));
  const profileSettings: ProfileSettings = settingsRow
    ? {
        id: settingsRow.id,
        displayName: settingsRow.displayName,
        accountSize: settingsRow.accountSize,
        defaultRiskPct: settingsRow.defaultRiskPct,
        maxRiskPct: settingsRow.maxRiskPct,
        feeBps: settingsRow.feeBps,
        taxBps: settingsRow.taxBps,
        slippageBps: settingsRow.slippageBps,
        createdAt: settingsRow.createdAt?.toISOString() ?? "",
      }
    : {
        id: userId,
        displayName: null,
        accountSize: 10_000_000,
        defaultRiskPct: 1,
        maxRiskPct: 2,
        feeBps: 1.5,
        taxBps: 15,
        slippageBps: 10,
        createdAt: new Date().toISOString(),
      };

  const netR =
    applyCosts(
      grossR,
      openTrade.entryPrice,
      openTrade.stopPrice,
      profileSettings.feeBps,
      profileSettings.taxBps,
      profileSettings.slippageBps
    ) ?? grossR;
  const realizedPnl = netR * (openTrade.quantity ?? 0) * Math.abs(openTrade.entryPrice - openTrade.stopPrice);

  const exitAt = new Date(bar.d);
  const domainTrade = dbTradeToDomain({ ...openTrade, exitAt, exitPrice: bar.close, exitReason, maeR, mfeR });
  const scoreResult = calcProcessScore(domainTrade, [], profileSettings);
  const quadrant = calcQuadrant(scoreResult.total, netR);

  await db
    .update(trades)
    .set({
      status: "closed",
      exitAt,
      exitPrice: bar.close,
      exitReason,
      realizedR: netR,
      realizedPnl,
      maeR,
      mfeR,
      processScore: scoreResult.total,
      processBreakdown: scoreResult.breakdown,
      quadrant,
    })
    .where(and(eq(trades.id, openTrade.id), eq(trades.userId, userId)));

  return { ok: true, realizedR: netR, processScore: scoreResult.total, quadrant };
}

export interface RevealResult {
  ticker: string;
  name: string;
  market: string | null;
  delistedAt: string | null;
  startDate: string;
  seed: string | null;
  level: number;
  bars: { d: string; open: number; high: number; low: number; close: number; volume: number }[];
  trades: Trade[];
}

// Read-only: assumes the session is already revealed (or doesn't care), and
// never mutates. Safe to call on every page load/refresh.
async function buildRevealSummary(session: ReplaySessionRow): Promise<RevealResult> {
  const [ticker] = await db
    .select()
    .from(tickerMaster)
    .where(eq(tickerMaster.ticker, session.ticker));

  const barRows = await db
    .select()
    .from(ohlcvDaily)
    .where(and(eq(ohlcvDaily.ticker, session.ticker), gte(ohlcvDaily.d, session.startDate)))
    .orderBy(asc(ohlcvDaily.d))
    .limit(session.currentIndex + 1);

  const tradeRows = await db
    .select()
    .from(trades)
    .where(
      and(eq(trades.replaySessionId, session.id), eq(trades.userId, session.userId), isNull(trades.ticker))
    );

  return {
    ticker: session.ticker,
    name: ticker?.name ?? session.ticker,
    market: ticker?.market ?? null,
    delistedAt: ticker?.delistedAt ?? null,
    startDate: session.startDate,
    seed: session.seed,
    level: session.level,
    bars: barRows.map((r) => ({
      d: r.d,
      open: r.open ?? 0,
      high: r.high ?? 0,
      low: r.low ?? 0,
      close: r.close ?? 0,
      volume: r.volume ?? 0,
    })),
    trades: tradeRows.map(dbTradeToDomain),
  };
}

// Ends the session: force-closes any open position at the current bar, then
// flips revealed=true so ticker/name/dates become visible for the first
// time. Idempotent-ish (safe to call again) but only the first call matters.
export async function revealReplaySession(
  sessionId: string,
  userId: string
): Promise<RevealResult | { error: string }> {
  const session = await getReplaySessionForUser(sessionId, userId);
  if (!session) return { error: "세션을 찾을 수 없습니다." };

  const openTrade = await getOpenReplayTrade(sessionId, userId);
  if (openTrade) {
    await closeReplayTrade(sessionId, userId);
  }

  await db
    .update(replaySessions)
    .set({ revealed: true })
    .where(and(eq(replaySessions.id, sessionId), eq(replaySessions.userId, userId)));

  return buildRevealSummary(session);
}

// For re-rendering the reveal screen on a page refresh, without re-running
// the end-of-session mutation.
export async function getRevealSummary(
  sessionId: string,
  userId: string
): Promise<RevealResult | { error: string }> {
  const session = await getReplaySessionForUser(sessionId, userId);
  if (!session) return { error: "세션을 찾을 수 없습니다." };
  if (!session.revealed) return { error: "아직 종료되지 않은 세션입니다." };
  return buildRevealSummary(session);
}
