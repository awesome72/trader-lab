import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { srsCards } from "@/lib/db/schema";
import {
  calcDispositionEffect,
  findAveragingDownEvidence,
  findRevengeTradingEvidence,
  findStopDelayEvidence,
} from "@/lib/domain/bias-metrics";
import { DEFAULT_SRS_STATE, reviewCard, type SrsReviewResult } from "@/lib/domain/srs";
import type { Trade, TradeEvent } from "@/lib/domain/types";

export interface SrsCard {
  id: string;
  front: string;
  back: string;
  conceptTags: string[];
  ease: number;
  intervalDays: number;
  dueAt: string;
  reps: number;
}

function toSrsCard(row: typeof srsCards.$inferSelect): SrsCard {
  return {
    id: row.id,
    front: row.front ?? "",
    back: row.back ?? "",
    conceptTags: row.conceptTags ?? [],
    ease: row.ease ?? DEFAULT_SRS_STATE.ease,
    intervalDays: row.intervalDays ?? DEFAULT_SRS_STATE.intervalDays,
    dueAt: row.dueAt ? row.dueAt.toISOString() : new Date().toISOString(),
    reps: row.reps ?? 0,
  };
}

// Shared-deck templates (userId null) hold no per-user scheduling state —
// the first time a user opens the deck, clone each template into its own
// row so SM-2 progress (ease/interval/dueAt/reps) can evolve independently
// per learner. Safe to call on every page load (no-op once cloned).
export async function ensureDeckInitialized(userId: string): Promise<void> {
  const [existing] = await db.select({ id: srsCards.id }).from(srsCards).where(eq(srsCards.userId, userId)).limit(1);
  if (existing) return;

  const templates = await db.select().from(srsCards).where(isNull(srsCards.userId));
  if (templates.length === 0) return;

  await db.insert(srsCards).values(
    templates.map((t) => ({
      userId,
      front: t.front,
      back: t.back,
      conceptTags: t.conceptTags,
    }))
  );
}

export async function getDueCards(userId: string, limit = 30): Promise<SrsCard[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(srsCards)
    .where(and(eq(srsCards.userId, userId), lte(srsCards.dueAt, now)))
    .orderBy(asc(srsCards.dueAt))
    .limit(limit);
  return rows.map(toSrsCard);
}

export async function getDueCardCount(userId: string): Promise<number> {
  const now = new Date();
  const rows = await db
    .select({ id: srsCards.id })
    .from(srsCards)
    .where(and(eq(srsCards.userId, userId), lte(srsCards.dueAt, now)));
  return rows.length;
}

export async function recordReview(
  userId: string,
  cardId: string,
  grade: number
): Promise<SrsReviewResult | null> {
  const [row] = await db.select().from(srsCards).where(and(eq(srsCards.id, cardId), eq(srsCards.userId, userId)));
  if (!row) return null;

  const state = {
    ease: row.ease ?? DEFAULT_SRS_STATE.ease,
    intervalDays: row.intervalDays ?? DEFAULT_SRS_STATE.intervalDays,
    reps: row.reps ?? 0,
  };
  const result = reviewCard(state, grade, new Date());

  await db
    .update(srsCards)
    .set({ ease: result.ease, intervalDays: result.intervalDays, reps: result.reps, dueAt: new Date(result.dueAt) })
    .where(eq(srsCards.id, cardId));

  return result;
}

interface MistakeTrigger {
  tag: string;
  conceptTags: string[];
  buildFront: () => string | null;
  buildBack: (compliantAvgR: number | null, violatedAvgR: number) => string;
}

function fmtTrade(t: Trade): string {
  const label = t.ticker ?? t.maskedLabel ?? "거래";
  const date = t.exitAt?.slice(0, 10) ?? t.entryAt?.slice(0, 10) ?? "";
  return `${date} ${label} (${t.realizedR?.toFixed(2) ?? "?"}R)`;
}

function avgR(trades: Trade[]): number | null {
  const rs = trades.map((t) => t.realizedR).filter((r): r is number => r !== null);
  return rs.length > 0 ? rs.reduce((s, r) => s + r, 0) / rs.length : null;
}

// docs/SPEC.md Phase 9-C-3: personalized mistake cards, generated once each
// trigger crosses threshold. Front carries the trader's own dates/tickers/
// numbers; back explains the concept and compares compliant vs. violated R.
export async function generatePersonalMistakeCards(
  userId: string,
  trades: Trade[],
  events: TradeEvent[]
): Promise<number> {
  const existingTags = new Set(
    (await db.select({ conceptTags: srsCards.conceptTags }).from(srsCards).where(eq(srsCards.userId, userId)))
      .flatMap((r) => r.conceptTags ?? [])
  );

  const stopDelayEvidence = findStopDelayEvidence(trades, events);
  const disposition = calcDispositionEffect(trades);
  const revengeEvidence = findRevengeTradingEvidence(trades);
  const averagingDownEvidence = findAveragingDownEvidence(trades, events);

  const stopCompliant = trades.filter(
    (t) => t.maeR !== null && t.maeR <= -1 && t.exitReason === "stop" && t.realizedR !== null
  );

  const triggers: MistakeTrigger[] = [
    {
      tag: "personal:stop-delay",
      conceptTags: ["personal:stop-delay", "손실회피", "매몰비용"],
      buildFront: () =>
        stopDelayEvidence.trades.length >= 3
          ? `[개인 교훈] 손절 미준수가 ${stopDelayEvidence.trades.length}회 누적되었습니다.\n${stopDelayEvidence.trades.slice(0, 5).map(fmtTrade).join("\n")}`
          : null,
      buildBack: (compliant, violated) =>
        `손절가를 지키지 않고 보유를 연장하는 것은 매몰비용 오류와 손실회피 편향의 전형적 형태입니다.\n손절을 지킨 거래 평균: ${compliant !== null ? compliant.toFixed(2) : "—"}R / 지키지 않은 거래 평균: ${violated.toFixed(2)}R`,
    },
    {
      tag: "personal:disposition",
      conceptTags: ["personal:disposition", "처분효과"],
      buildFront: () =>
        disposition.index > 0.15
          ? `[개인 교훈] 처분효과 지수가 ${disposition.index.toFixed(2)}로 높습니다.\n이익 실현 비율 ${(disposition.pgr * 100).toFixed(0)}% / 손실 실현 비율 ${(disposition.plr * 100).toFixed(0)}%`
          : null,
      buildBack: () =>
        `이익은 너무 일찍 실현하고 손실은 너무 오래 들고 있는 비대칭적 습관입니다(Shefrin & Statman, 1985). 사전에 목표가·손절가를 선언하고 예외 없이 지키는 것이 처방입니다.`,
    },
    {
      tag: "personal:revenge",
      conceptTags: ["personal:revenge", "보복매매"],
      buildFront: () =>
        revengeEvidence.trades.length >= 3
          ? `[개인 교훈] 손실 직후 재진입(보복매매)이 ${revengeEvidence.trades.length}회 있었습니다.\n${revengeEvidence.trades.slice(0, 5).map(fmtTrade).join("\n")}`
          : null,
      buildBack: (_c, violated) =>
        `손실 직후 감정적으로 재진입하는 것은 통제력을 잃은 상태에서의 의사결정입니다. 보복매매로 이어진 거래의 평균 R은 ${violated.toFixed(2)}R이었습니다. 손실 후 최소 대기 시간을 규칙으로 정해보세요.`,
    },
    {
      tag: "personal:averaging-down",
      conceptTags: ["personal:averaging-down", "물타기", "리스크확대"],
      buildFront: () =>
        averagingDownEvidence.trades.length >= 2
          ? `[개인 교훈] 손실 중 물타기가 ${averagingDownEvidence.trades.length}회 있었습니다.\n${averagingDownEvidence.trades.slice(0, 5).map(fmtTrade).join("\n")}`
          : null,
      buildBack: (_c, violated) =>
        `손실 중인 포지션에 추가 매수하는 것은 계획된 리스크 한도를 사후에 무너뜨립니다. 물타기가 있었던 거래의 평균 R은 ${violated.toFixed(2)}R이었습니다.`,
    },
  ];

  let created = 0;
  for (const trigger of triggers) {
    if (existingTags.has(trigger.tag)) continue;
    const front = trigger.buildFront();
    if (!front) continue;

    const violatedSet =
      trigger.tag === "personal:stop-delay"
        ? stopDelayEvidence.trades
        : trigger.tag === "personal:revenge"
          ? revengeEvidence.trades
          : trigger.tag === "personal:averaging-down"
            ? averagingDownEvidence.trades
            : trades;
    const violatedAvg = avgR(violatedSet) ?? 0;
    const compliantAvg = trigger.tag === "personal:stop-delay" ? avgR(stopCompliant) : null;

    await db.insert(srsCards).values({
      userId,
      front,
      back: trigger.buildBack(compliantAvg, violatedAvg),
      conceptTags: trigger.conceptTags,
    });
    created += 1;
  }

  return created;
}
