import { NextResponse } from "next/server";
import { openReplayTrade } from "@/lib/queries/replay";
import { createClient } from "@/lib/supabase/server";
import { replayEntrySchema } from "@/lib/validation/journal";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = replayEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." },
      { status: 400 }
    );
  }

  const result = await openReplayTrade(id, user.id, {
    thesis: parsed.data.thesis,
    invalidation: parsed.data.invalidation,
    stopPrice: parsed.data.stopPrice,
    target1Price: parsed.data.target1Price ?? null,
    confidence: parsed.data.confidence,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
