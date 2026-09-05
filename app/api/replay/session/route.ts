import { NextResponse } from "next/server";
import { createReplaySession } from "@/lib/queries/replay";
import { createClient } from "@/lib/supabase/server";

interface CreateSessionBody {
  market?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  level?: number;
  seed?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateSessionBody;
  const level = Math.min(5, Math.max(1, Math.floor(body.level ?? 1)));
  const seed = Number.isFinite(body.seed) ? Math.floor(body.seed as number) : Date.now();

  const result = await createReplaySession(user.id, {
    market: body.market,
    minMarketCap: body.minMarketCap,
    maxMarketCap: body.maxMarketCap,
    level,
    seed,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result);
}
