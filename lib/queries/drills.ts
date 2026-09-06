import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drillCards, drillResponses, srsCards } from "@/lib/db/schema";
import {
  calcDrillConsistency,
  isLowScoreDrillResponse,
  scoreDrillResponse,
  type DrillCard,
  type DrillOptionKey,
} from "@/lib/domain/drills";

function toDrillCard(row: typeof drillCards.$inferSelect): DrillCard {
  return {
    id: row.id,
    code: row.code ?? row.id,
    title: row.title ?? "",
    situation: row.situation as DrillCard["situation"],
    options: row.options as DrillCard["options"],
    scoringRubric: row.scoringRubric as DrillCard["scoringRubric"],
    conceptTags: row.conceptTags ?? [],
  };
}

export async function getAllDrillCards(): Promise<DrillCard[]> {
  const rows = await db.select().from(drillCards);
  return rows.map(toDrillCard);
}

// A card is "due" if the user has never answered it, or last answered it
// 90+ days ago (docs/SPEC.md Phase 9-B-3: consistency re-test window).
export async function getDueDrillCards(userId: string, ninetyDaysMs = 90 * 86_400_000): Promise<DrillCard[]> {
  const [allCards, responses] = await Promise.all([
    getAllDrillCards(),
    db.select().from(drillResponses).where(eq(drillResponses.userId, userId)),
  ]);

  const latestByCard = new Map<string, Date>();
  for (const r of responses) {
    if (!r.cardId || !r.answeredAt) continue;
    const existing = latestByCard.get(r.cardId);
    if (!existing || r.answeredAt > existing) latestByCard.set(r.cardId, r.answeredAt);
  }

  const cutoff = new Date(Date.now() - ninetyDaysMs);
  return allCards.filter((c) => {
    const latest = latestByCard.get(c.id);
    return !latest || latest <= cutoff;
  });
}

export interface SubmitDrillResponseResult {
  score: number;
  explanation: string;
  consistencyScore: number | null;
}

export async function submitDrillResponse(
  userId: string,
  card: DrillCard,
  chosen: DrillOptionKey,
  confidence: number,
  rationale: string
): Promise<SubmitDrillResponseResult | null> {
  const graded = scoreDrillResponse(card, chosen);
  if (!graded) return null;

  const [priorResponse] = await db
    .select()
    .from(drillResponses)
    .where(and(eq(drillResponses.userId, userId), eq(drillResponses.cardId, card.id)))
    .orderBy(desc(drillResponses.answeredAt))
    .limit(1);

  const consistencyScore = priorResponse?.chosen
    ? calcDrillConsistency(card, priorResponse.chosen as DrillOptionKey, chosen)
    : null;

  await db.insert(drillResponses).values({
    userId,
    cardId: card.id,
    chosen,
    confidence,
    rationale,
    consistencyScore,
  });

  // docs/SPEC.md Phase 9-B-4: a low-consistency choice auto-feeds the SRS
  // queue. Inserted with the schema's own scheduling defaults (ease 2.5,
  // interval 1 day, due now) — lib/domain/srs.ts's SM-2 algorithm only
  // needs to run starting from the *next* review, not this first card.
  if (isLowScoreDrillResponse(graded.score)) {
    const chosenLabel = card.options.find((o) => o.key === chosen)?.label ?? chosen;
    await db.insert(srsCards).values({
      userId,
      front: `[드릴] ${card.title}\n${card.situation.holdingState}\n${card.situation.priceContext}\n당신의 선택: ${chosenLabel}`,
      back: `이 선택은 "${graded.explanation}"는 전제를 깔고 있습니다 (정합성 점수 ${graded.score}/100).\n관련 개념: ${card.conceptTags.join(", ")}`,
      conceptTags: card.conceptTags,
    });
  }

  return { score: graded.score, explanation: graded.explanation, consistencyScore };
}

export interface DrillConsistencyEntry {
  card: DrillCard;
  firstChoice: DrillOptionKey;
  firstAnsweredAt: string;
  latestChoice: DrillOptionKey;
  latestAnsweredAt: string;
  consistencyScore: number | null;
}

export async function getDrillConsistencyHistory(userId: string): Promise<DrillConsistencyEntry[]> {
  const [allCards, responses] = await Promise.all([
    getAllDrillCards(),
    db
      .select()
      .from(drillResponses)
      .where(eq(drillResponses.userId, userId))
      .orderBy(desc(drillResponses.answeredAt)),
  ]);
  const cardById = new Map(allCards.map((c) => [c.id, c]));

  const byCard = new Map<string, typeof responses>();
  for (const r of responses) {
    if (!r.cardId) continue;
    const bucket = byCard.get(r.cardId) ?? [];
    bucket.push(r);
    byCard.set(r.cardId, bucket);
  }

  const entries: DrillConsistencyEntry[] = [];
  for (const [cardId, list] of byCard) {
    if (list.length < 2) continue;
    const card = cardById.get(cardId);
    if (!card) continue;
    const latest = list[0]; // already sorted desc
    const first = list[list.length - 1];
    entries.push({
      card,
      firstChoice: first.chosen as DrillOptionKey,
      firstAnsweredAt: first.answeredAt?.toISOString() ?? "",
      latestChoice: latest.chosen as DrillOptionKey,
      latestAnsweredAt: latest.answeredAt?.toISOString() ?? "",
      consistencyScore: latest.consistencyScore,
    });
  }
  return entries;
}
