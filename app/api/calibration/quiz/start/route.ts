import { NextResponse } from "next/server";
import { createQuizSession } from "@/lib/queries/calibration";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Number.isInteger(body.count) && body.count > 0 && body.count <= 20 ? body.count : 20;

  const questions = await createQuizSession(user.id, count);
  if (questions.length === 0) {
    return NextResponse.json({ error: "퀴즈를 만들 데이터가 부족합니다." }, { status: 422 });
  }

  return NextResponse.json({ questions });
}
