import { NextResponse } from "next/server";
import { calcWorstWindow, multipleTestingWarning, runWalkForwardBacktest } from "@/lib/domain/backtest";
import { ruleDefinitionSchema } from "@/lib/domain/rule-dsl";
import { getUniverseBars, recordRuleSetRun, saveBacktestRun } from "@/lib/queries/backtest";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const requestSchema = z.object({
  ruleSetId: z.string().uuid().optional(),
  name: z.string().min(1).default("이름 없는 규칙"),
  rule: ruleDefinitionSchema,
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "룰 정의가 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const { rule } = parsed.data;

  const universe = await getUniverseBars({
    market: rule.universe?.market,
    minMarketCap: rule.universe?.minMarketCap,
    maxMarketCap: rule.universe?.maxMarketCap,
  });

  if (universe.length === 0) {
    return NextResponse.json({ error: "조건에 맞는 종목 데이터가 없습니다." }, { status: 422 });
  }

  const accountSize = 10_000_000;
  const result = runWalkForwardBacktest(universe, rule, { accountSize });
  const allTrades = [...result.is.trades, ...result.oos.trades];
  const worstWindow = calcWorstWindow(allTrades, 183);

  const { ruleSetId, searchCount } = await recordRuleSetRun({
    userId: user.id,
    ruleSetId: parsed.data.ruleSetId,
    name: parsed.data.name,
    definition: rule,
  });

  const periodStart = universe.flatMap((u) => u.dates).sort()[0];
  const periodEnd = universe.flatMap((u) => u.dates).sort().slice(-1)[0];

  await saveBacktestRun(ruleSetId, periodStart, periodEnd, { is: result.is.metrics, oos: result.oos.metrics, worstWindow }, allTrades);

  return NextResponse.json({
    ruleSetId,
    searchCount,
    searchWarning: multipleTestingWarning(searchCount),
    splitDate: result.splitDate,
    is: result.is,
    oos: result.oos,
    overfitWarning: result.overfitWarning,
    worstWindow,
    tradeCount: allTrades.length,
  });
}
