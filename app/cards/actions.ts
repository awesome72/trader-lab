"use server";

import { redirect } from "next/navigation";
import { recordReview } from "@/lib/queries/srs";
import { createClient } from "@/lib/supabase/server";

export async function submitReview(
  cardId: string,
  grade: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const result = await recordReview(user.id, cardId, grade);
  if (!result) return { ok: false, error: "카드를 찾을 수 없습니다." };
  return { ok: true };
}
