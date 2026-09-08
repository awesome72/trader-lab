import { redirect } from "next/navigation";
import { FilterLink } from "@/components/filter-link";
import { PageGuide } from "@/components/page-guide";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calcAverageBreakdown,
  calcQuadrantDistribution,
  type ProcessScoreBreakdown,
} from "@/lib/domain/process-score";
import { StatLabel } from "@/components/stat-label";
import { pearsonCorrelation } from "@/lib/domain/metrics";
import { generateSampleTrades } from "@/lib/domain/sample-data";
import type { Quadrant, SourceType } from "@/lib/domain/types";
import { QUADRANT_LABELS } from "@/lib/labels";
import { PERIOD_DAYS, getFilteredTrades, getTradesBetween } from "@/lib/queries/trades";
import { createClient } from "@/lib/supabase/server";
import { BreakdownBarChart, ProcessScoreScatter, QuadrantDonut } from "./charts";

const BREAKDOWN_KEYS: (keyof ProcessScoreBreakdown)[] = [
  "hasPlan",
  "invalidationQuality",
  "stopDiscipline",
  "sizing",
  "noAveragingDown",
  "horizonRespect",
  "emotion",
];

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; source?: string; sample?: string }>;
}) {
  const params = await searchParams;
  const sampleMode = params.sample === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const source = (params.source as SourceType) ?? "live";
  const now = new Date();
  const trades = sampleMode
    ? generateSampleTrades(now)
    : await getFilteredTrades(user.id, { period: params.period, source });
  const scored = trades.filter(
    (t): t is typeof t & { processScore: number; realizedR: number; quadrant: Quadrant } =>
      t.processScore !== null && t.realizedR !== null && t.quadrant !== null
  );

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [thisMonthTrades, lastMonthTrades] = sampleMode
    ? [
        trades.filter((t) => new Date(t.entryAt!) >= startOfThisMonth),
        trades.filter((t) => new Date(t.entryAt!) >= startOfLastMonth && new Date(t.entryAt!) < startOfThisMonth),
      ]
    : await Promise.all([
        getTradesBetween(user.id, source, startOfThisMonth, now),
        getTradesBetween(user.id, source, startOfLastMonth, startOfThisMonth),
      ]);

  const thisMonthDist = calcQuadrantDistribution(thisMonthTrades.map((t) => t.quadrant));
  const lastMonthDist = calcQuadrantDistribution(lastMonthTrades.map((t) => t.quadrant));

  const breakdowns = trades
    .map((t) => t.processBreakdown)
    .filter((b) => b !== null) as unknown as ProcessScoreBreakdown[];
  const avgBreakdown = calcAverageBreakdown(breakdowns);

  let weakestKey: keyof ProcessScoreBreakdown = "hasPlan";
  if (avgBreakdown) {
    const maxByKey: Record<keyof ProcessScoreBreakdown, number> = {
      hasPlan: 20,
      invalidationQuality: 15,
      stopDiscipline: 25,
      sizing: 15,
      noAveragingDown: 10,
      horizonRespect: 10,
      emotion: 5,
    };
    weakestKey = BREAKDOWN_KEYS.reduce((worst, key) =>
      avgBreakdown[key] / maxByKey[key] < avgBreakdown[worst] / maxByKey[worst]
        ? key
        : worst
    );
  }

  const correlation = pearsonCorrelation(
    scored.map((t) => t.processScore),
    scored.map((t) => t.realizedR)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">프로세스 스코어카드</h1>
      <PageGuide>
        <p>
          이 화면의 핵심은 <b>&quot;결과가 좋았나&quot;가 아니라 &quot;과정이
          좋았나&quot;</b>를 따로 채점하는 것입니다. 예를 들어 계획도 없이
          충동적으로 샀는데 운 좋게 올랐다면 <b>&quot;행운&quot;</b>, 반대로
          계획을 잘 지켰는데도 시장 상황 때문에 손실이 났다면{" "}
          <b>&quot;불운&quot;</b>으로 분류합니다.
        </p>
        <p>
          장기적으로 꾸준히 돈을 버는 사람은 결과가 아니라{" "}
          <b>&quot;실력&quot;</b>(계획도 잘 지키고 결과도 좋은) 칸의 비중이
          높은 사람입니다. 아래 산점도의 점을 클릭하면 그 거래의 저널로 바로
          이동합니다.
        </p>
      </PageGuide>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">기간:</span>
        <FilterLink basePath="/scorecard" searchParams={params} paramKey="period" value={undefined} label="전체" active={!params.period} />
        {Object.keys(PERIOD_DAYS).map((p) => (
          <FilterLink key={p} basePath="/scorecard" searchParams={params} paramKey="period" value={p} label={p} active={params.period === p} />
        ))}
        <span className="ml-4 text-sm text-muted-foreground">데이터:</span>
        <FilterLink basePath="/scorecard" searchParams={params} paramKey="source" value={undefined} label="실전" active={!params.source || params.source === "live"} />
        <FilterLink basePath="/scorecard" searchParams={params} paramKey="source" value="replay" label="리플레이" active={params.source === "replay"} />
        <FilterLink basePath="/scorecard" searchParams={params} paramKey="sample" value={sampleMode ? undefined : "1"} label={sampleMode ? "실제 데이터로 돌아가기" : "샘플로 미리보기"} active={sampleMode} />
      </div>

      {sampleMode ? (
        <div className="rounded-md border border-blue-400 bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          샘플 데이터로 미리보고 있습니다. 실제 계정 데이터가 아니며, 거래가
          쌓였을 때 화면이 어떻게 보이는지 보여주기 위한 가상의 데이터입니다.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>프로세스 vs 결과</CardTitle>
        </CardHeader>
        <CardContent>
          <ProcessScoreScatter
            points={scored.map((t) => ({
              id: t.id,
              processScore: t.processScore,
              realizedR: t.realizedR,
              quadrant: t.quadrant,
            }))}
            disableClick={sampleMode}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>사분면 비중 (이번 달)</CardTitle>
          </CardHeader>
          <CardContent>
            <QuadrantDonut distribution={thisMonthDist} />
            <div className="mt-2 space-y-1 text-xs">
              {(Object.keys(QUADRANT_LABELS) as Quadrant[]).map((q) => {
                const delta = thisMonthDist[q] - lastMonthDist[q];
                return (
                  <div key={q} className="flex justify-between">
                    <span>{QUADRANT_LABELS[q]}</span>
                    <span>
                      {thisMonthDist[q].toFixed(0)}%{" "}
                      <span className={delta > 0 ? "text-red-600" : delta < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                        ({delta >= 0 ? "+" : ""}
                        {delta.toFixed(0)}%p 전월 대비)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <StatLabel label="상관 분석" explain="프로세스 점수(과정)와 실현 R(결과)이 실제로 함께 움직이는지를 -1~1 사이 숫자로 나타냅니다. 1에 가까울수록 '프로세스를 잘 지킨 거래가 실제로도 좋은 결과로 이어졌다'는 뜻이고, 0에 가까우면 아직 둘이 무관합니다." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              프로세스 점수와 실현 R의 상관계수:{" "}
              <span className="font-semibold">
                {correlation !== null ? correlation.toFixed(2) : "표본 부족"}
              </span>
            </p>
            {correlation !== null && correlation >= 0.3 ? (
              <p className="text-emerald-600">
                당신의 프로세스는 실제로 성과와 연결되어 있습니다.
              </p>
            ) : correlation !== null && correlation < 0.1 ? (
              <p className="text-amber-600">
                아직 프로세스 정의가 성과와 무관합니다. 채점 기준을 당신의
                전략에 맞게 조정할 필요가 있습니다.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            프로세스 점수 항목별 평균{" "}
            {avgBreakdown ? (
              <Badge variant="outline" className="ml-2 align-middle text-amber-600">
                이번 달 집중 개선 항목
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {avgBreakdown ? (
            <BreakdownBarChart average={avgBreakdown} weakestKey={weakestKey} />
          ) : (
            <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
