import { NextResponse } from "next/server";
import { z } from "zod";
import { COIN_FLIP_BRIER_SCORE, brierScore, type CalibrationRecord } from "@/lib/domain/calibration";
import { submitQuizAnswers } from "@/lib/queries/calibration";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  answers: z.array(z.object({ recordId: z.string().uuid(), predictedProb: z.number().min(0).max(1) })),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const results = await submitQuizAnswers(user.id, parsed.data.answers);

  const asRecords: CalibrationRecord[] = results.map((r) => ({
    id: r.recordId,
    userId: user.id,
    tradeId: null,
    predictedProb: r.predictedProb,
    outcome: r.outcome,
    resolvedAt: new Date().toISOString(),
    context: "quiz",
  }));

  const score = brierScore(asRecords);

  return NextResponse.json({
    results,
    brierScore: score,
    coinFlipBrierScore: COIN_FLIP_BRIER_SCORE,
  });
}
