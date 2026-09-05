import { and, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbTradeToDomain } from "@/lib/db/mappers";
import { coachSessions, trades } from "@/lib/db/schema";
import { calcExperimentCompliance, type CoachKind, type ExperimentProgress, type MonthlySnapshot } from "@/lib/domain/coach";
import { calcMetrics } from "@/lib/domain/metrics";
import type { Trade } from "@/lib/domain/types";

export async function getTradeForCoach(userId: string, tradeId: string): Promise<Trade | null> {
  const [row] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)));
  return row ? dbTradeToDomain(row) : null;
}

export async function getRecentTrades(userId: string, sinceDate: Date): Promise<Trade[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.source, "live"), gte(trades.entryAt, sinceDate)));
  return rows.map(dbTradeToDomain);
}

export async function getMonthlySnapshot(userId: string, from: Date, to: Date): Promise<MonthlySnapshot> {
  const rows = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.source, "live"),
        gte(trades.entryAt, from),
        lt(trades.entryAt, to)
      )
    );
  const domainTrades = rows.map(dbTradeToDomain);
  const metrics = calcMetrics(domainTrades);
  const scored = domainTrades.filter((t) => t.processScore !== null);
  const avgProcessScore =
    scored.length > 0
      ? scored.reduce((s, t) => s + (t.processScore as number), 0) / scored.length
      : null;

  return {
    n: metrics.n,
    winRate: metrics.winRate,
    expectancy: metrics.expectancy,
    cumulativeR: metrics.cumulativeR,
    avgProcessScore,
  };
}

// Most recent coach session that proposed an experiment, with compliance
// computed from live trades closed since that session (docs/SPEC.md 8-4/8-5).
export async function getOngoingExperiment(userId: string): Promise<ExperimentProgress | null> {
  const [session] = await db
    .select()
    .from(coachSessions)
    .where(and(eq(coachSessions.userId, userId), isNotNull(coachSessions.experimentSuggested)))
    .orderBy(desc(coachSessions.createdAt))
    .limit(1);

  if (!session || !session.experimentSuggested || !session.createdAt) return null;

  const closedSince = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.source, "live"), gte(trades.exitAt, session.createdAt)));

  const domainTrades = closedSince
    .map(dbTradeToDomain)
    .filter((t) => t.exitAt !== null)
    .sort((a, b) => (a.exitAt as string).localeCompare(b.exitAt as string));

  const compliance = calcExperimentCompliance(domainTrades, 10);
  return { rule: session.experimentSuggested, compliant: compliance.compliant, total: compliance.total };
}

export async function countCallsToday(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ id: coachSessions.id })
    .from(coachSessions)
    .where(and(eq(coachSessions.userId, userId), gte(coachSessions.createdAt, startOfDay)));
  return rows.length;
}

// weekly/monthly are cached: a request for the same kind within the current
// week/month returns the prior result instead of calling the API again.
export async function getCachedSession(
  userId: string,
  kind: CoachKind,
  sinceDate: Date
): Promise<{ id: string; output: unknown } | null> {
  const [row] = await db
    .select()
    .from(coachSessions)
    .where(and(eq(coachSessions.userId, userId), eq(coachSessions.kind, kind), gte(coachSessions.createdAt, sinceDate)))
    .orderBy(desc(coachSessions.createdAt))
    .limit(1);
  return row ? { id: row.id, output: row.output } : null;
}

export async function saveCoachSession(
  userId: string,
  kind: CoachKind,
  inputContext: unknown,
  output: unknown,
  experimentSuggested: string | null
): Promise<void> {
  await db.insert(coachSessions).values({
    userId,
    kind,
    inputContext,
    output,
    experimentSuggested,
    experimentStatus: experimentSuggested ? "active" : null,
  });
}
