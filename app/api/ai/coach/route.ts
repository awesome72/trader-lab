import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deriveFomoPriceContextFromTags, calcBiasRadar } from "@/lib/domain/bias-metrics";
import {
  buildMonthlyUserMessage,
  buildPostmortemUserMessage,
  buildPremortemUserMessage,
  buildWeeklyUserMessage,
  COACH_SYSTEM_PROMPT,
  parseCoachResponse,
  type CoachKind,
} from "@/lib/domain/coach";
import {
  countCallsToday,
  getCachedSession,
  getMonthlySnapshot,
  getOngoingExperiment,
  getRecentTrades,
  getTradeForCoach,
  saveCoachSession,
} from "@/lib/queries/coach";
import { getEventsForTrades } from "@/lib/queries/trades";
import { createClient } from "@/lib/supabase/server";

// docs/SPEC.md Phase 8-1 names "claude-sonnet-4-6", which predates this
// codebase's current model lineup — using the latest recommended model
// (Claude 5 family) instead, per this project's own operating instructions.
const MODEL = "claude-sonnet-5";
const DAILY_CALL_LIMIT = 20;

const requestSchema = z.object({
  kind: z.enum(["premortem", "postmortem", "weekly", "monthly"]),
  tradeId: z.string().uuid().optional(),
});

function startOfWeek(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

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
  const { kind, tradeId } = parsed.data;

  const now = new Date();

  // weekly/monthly are cached per period — a repeat request in the same
  // week/month returns the prior result without calling the API again.
  if (kind === "weekly" || kind === "monthly") {
    const sinceDate = kind === "weekly" ? startOfWeek(now) : startOfMonth(now);
    const cached = await getCachedSession(user.id, kind, sinceDate);
    if (cached) {
      return NextResponse.json({ output: cached.output, cached: true });
    }
  }

  const callsToday = await countCallsToday(user.id);
  if (callsToday >= DAILY_CALL_LIMIT) {
    return NextResponse.json(
      { error: `오늘의 AI 코치 호출 한도(${DAILY_CALL_LIMIT}회)를 모두 사용했습니다.` },
      { status: 429 }
    );
  }

  let userMessage: string;
  let inputContext: Record<string, unknown>;

  if (kind === "premortem" || kind === "postmortem") {
    if (!tradeId) {
      return NextResponse.json({ error: "tradeId가 필요합니다." }, { status: 400 });
    }
    // Never trust a client-sent trade snapshot — always re-fetch server-side.
    const trade = await getTradeForCoach(user.id, tradeId);
    if (!trade) {
      return NextResponse.json({ error: "거래를 찾을 수 없습니다." }, { status: 404 });
    }
    if (kind === "postmortem" && trade.status !== "closed") {
      return NextResponse.json({ error: "청산된 거래만 포스트모템할 수 있습니다." }, { status: 422 });
    }
    userMessage = kind === "premortem" ? buildPremortemUserMessage(trade) : buildPostmortemUserMessage(trade);
    inputContext = { tradeId };
  } else if (kind === "weekly") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const recentTrades = await getRecentTrades(user.id, sevenDaysAgo);
    const events = await getEventsForTrades(user.id, recentTrades.map((t) => t.id));
    const priceContext = deriveFomoPriceContextFromTags(recentTrades);
    const radar = calcBiasRadar(recentTrades, events, priceContext);
    userMessage = buildWeeklyUserMessage(recentTrades, radar);
    inputContext = { sevenDaysAgo: sevenDaysAgo.toISOString(), tradeCount: recentTrades.length };
  } else {
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1);
    const [thisMonth, lastMonth, experiment] = await Promise.all([
      getMonthlySnapshot(user.id, thisMonthStart, now),
      getMonthlySnapshot(user.id, lastMonthStart, thisMonthStart),
      getOngoingExperiment(user.id),
    ]);
    userMessage = buildMonthlyUserMessage(thisMonth, lastMonth, experiment);
    inputContext = { thisMonth, lastMonth, experiment };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI 코치가 설정되지 않았습니다." }, { status: 503 });
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    // Extended thinking is on by default for this model and can consume the
    // entire max_tokens budget before any text is produced (observed while
    // verifying this route) — disabled since this task needs one JSON reply,
    // not visible reasoning.
    thinking: { type: "disabled" },
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  const output = parseCoachResponse(raw);

  if (!output) {
    return NextResponse.json({ error: "AI 응답을 해석할 수 없습니다. 다시 시도해주세요." }, { status: 502 });
  }

  await saveCoachSession(user.id, kind as CoachKind, inputContext, output, output.experiment?.rule ?? null);

  return NextResponse.json({ output, cached: false });
}
