import { NextResponse } from "next/server";
import { revealReplaySession } from "@/lib/queries/replay";
import { createClient } from "@/lib/supabase/server";

// Only endpoint allowed to return ticker/name/date — and only once the
// session is marked revealed (docs/SPEC.md Phase 6-1/6-5).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const result = await revealReplaySession(id, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json(result);
}
