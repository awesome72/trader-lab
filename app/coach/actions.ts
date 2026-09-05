"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { tradeEvents, trades } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { and, eq } from "drizzle-orm";

// Saves the trader's own written answer to one of the coach's questions —
// docs/SPEC.md Phase 8-5: "질문 각각에 사용자가 답변을 적을 수 있는 텍스트
// 영역 → trade_events에 저장". Only meaningful for premortem/postmortem,
// which are tied to one trade; weekly/monthly have no trade to attach to.
export async function saveQuestionAnswer(
  tradeId: string,
  question: string,
  answer: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  if (!answer.trim()) {
    return { ok: false, error: "답변을 입력해주세요." };
  }

  const [trade] = await db
    .select({ id: trades.id })
    .from(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, user.id)));
  if (!trade) {
    return { ok: false, error: "거래를 찾을 수 없습니다." };
  }

  await db.insert(tradeEvents).values({
    tradeId,
    kind: "note",
    note: `[AI 코치 질문] ${question}\n[답변] ${answer.trim()}`,
    payload: { source: "coach_question", question, answer: answer.trim() },
  });

  return { ok: true };
}
