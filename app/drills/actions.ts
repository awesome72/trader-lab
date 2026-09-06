"use server";

import { redirect } from "next/navigation";
import type { DrillCard, DrillOptionKey } from "@/lib/domain/drills";
import { getAllDrillCards, submitDrillResponse, type SubmitDrillResponseResult } from "@/lib/queries/drills";
import { createClient } from "@/lib/supabase/server";

export async function answerDrill(
  cardId: string,
  chosen: DrillOptionKey,
  confidence: number,
  rationale: string
): Promise<SubmitDrillResponseResult | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const cards = await getAllDrillCards();
  const card = cards.find((c: DrillCard) => c.id === cardId);
  if (!card) return { error: "카드를 찾을 수 없습니다." };

  const result = await submitDrillResponse(user.id, card, chosen, confidence, rationale);
  if (!result) return { error: "채점할 수 없습니다." };
  return result;
}
