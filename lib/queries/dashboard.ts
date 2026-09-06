import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbTradeToDomain } from "@/lib/db/mappers";
import { trades } from "@/lib/db/schema";
import type { Trade } from "@/lib/domain/types";

export async function getOpenPositions(userId: string): Promise<Trade[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.source, "live"), eq(trades.status, "open")));
  return rows.map(dbTradeToDomain);
}

export async function getRecentClosedTrades(userId: string, limit = 5): Promise<Trade[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.source, "live"), eq(trades.status, "closed")))
    .orderBy(desc(trades.exitAt))
    .limit(limit);
  return rows.map(dbTradeToDomain);
}

export interface WeeklyProcessScoreComparison {
  thisWeek: number | null;
  lastWeek: number | null;
}

function avgProcessScore(list: Trade[]): number | null {
  const scored = list.filter((t) => t.processScore !== null);
  if (scored.length === 0) return null;
  return scored.reduce((s, t) => s + (t.processScore as number), 0) / scored.length;
}

// docs/SPEC.md Phase 10-1-3: "이번 주 프로세스 점수 평균 (전주 대비)" — the
// biggest number on the home page must be this, never account P/L.
export async function getWeeklyProcessScoreComparison(userId: string): Promise<WeeklyProcessScoreComparison> {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const rows = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        eq(trades.source, "live"),
        eq(trades.status, "closed"),
        isNotNull(trades.exitAt)
      )
    );
  const domainTrades = rows.map(dbTradeToDomain);

  const thisWeek = domainTrades.filter(
    (t) => t.exitAt !== null && new Date(t.exitAt) >= startOfThisWeek
  );
  const lastWeek = domainTrades.filter(
    (t) => t.exitAt !== null && new Date(t.exitAt) >= startOfLastWeek && new Date(t.exitAt) < startOfThisWeek
  );

  return { thisWeek: avgProcessScore(thisWeek), lastWeek: avgProcessScore(lastWeek) };
}
