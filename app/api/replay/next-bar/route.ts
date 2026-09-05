import { NextResponse } from "next/server";
import { advanceReplaySession } from "@/lib/queries/replay";
import { createClient } from "@/lib/supabase/server";

interface NextBarBody {
  sessionId?: string;
}

// docs/SPEC.md Phase 6-1: the server always serves currentIndex + 1. This
// route intentionally never reads an index from the request body — there is
// nothing here for a client to manipulate to jump ahead.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as NextBarBody;
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId가 필요합니다." }, { status: 400 });
  }

  const result = await advanceReplaySession(body.sessionId, user.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result);
}
