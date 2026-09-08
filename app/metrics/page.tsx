import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FilterLink } from "@/components/filter-link";
import { PageGuide } from "@/components/page-guide";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import {
  bootstrapCI,
  calcCumulativeRCurve,
  calcImportedTradeSummary,
  calcMetrics,
  calcRHistogram,
  expectancyOf,
  winRateOf,
} from "@/lib/domain/metrics";
import { StatLabel } from "@/components/stat-label";
import { generateSampleTrades } from "@/lib/domain/sample-data";
import type { SourceType } from "@/lib/domain/types";
import { PERIOD_DAYS, getFilteredTrades } from "@/lib/queries/trades";
import { createClient } from "@/lib/supabase/server";
import { CumulativeRChart, KellyGauge, RHistogramChart } from "./charts";

function fmtR(v: number | null): string {
  return v !== null ? `${v.toFixed(2)}R` : "—";
}

export default async function MetricsPage({
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

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));

  const source = (params.source as SourceType) ?? "live";
  const trades = sampleMode
    ? generateSampleTrades(new Date())
    : await getFilteredTrades(user.id, { period: params.period, source });

  const metrics = calcMetrics(trades);
  const rs = trades
    .filter((t): t is typeof t & { realizedR: number } => t.realizedR !== null)
    .map((t) => t.realizedR);

  const winRateCI = bootstrapCI(rs, winRateOf, 1000, 0.05, 1);
  const expectancyCI = bootstrapCI(rs, expectancyOf, 1000, 0.05, 2);
  const histogram = calcRHistogram(rs, 0.5);
  const cumulativeCurve = calcCumulativeRCurve(trades);
  const importedSummary = calcImportedTradeSummary(trades);

  const currentRiskPct = profile?.defaultRiskPct ?? 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">R-멀티플 대시보드</h1>
      <PageGuide>
        <p>
          <b>R-multiple(R)</b>은 &quot;내가 감수하기로 한 손실 1번 분&quot;을
          기준 단위로 삼는 방법입니다. 예를 들어 손절가에서 -100만원을 잃기로
          정하고 실제로는 +200만원을 벌었다면 <b>+2R</b>입니다.
        </p>
        <p>
          금액으로만 보면 계좌 크기나 종목 가격이 달라서 비교가 어렵지만, R로
          바꾸면 &quot;나는 보통 얼마나 위험을 감수해서 얼마를 버는
          사람인가&quot;를 매매 습관 자체로 비교할 수 있습니다. 아래 지표들은
          모두 이 R을 기준으로 계산됩니다.
        </p>
      </PageGuide>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">기간:</span>
        <FilterLink basePath="/metrics" searchParams={params} paramKey="period" value={undefined} label="전체" active={!params.period} />
        {Object.keys(PERIOD_DAYS).map((p) => (
          <FilterLink key={p} basePath="/metrics" searchParams={params} paramKey="period" value={p} label={p} active={params.period === p} />
        ))}
        <span className="ml-4 text-sm text-muted-foreground">데이터:</span>
        <FilterLink basePath="/metrics" searchParams={params} paramKey="source" value={undefined} label="실전" active={!params.source || params.source === "live"} />
        <FilterLink basePath="/metrics" searchParams={params} paramKey="source" value="replay" label="리플레이" active={params.source === "replay"} />
        <FilterLink basePath="/metrics" searchParams={params} paramKey="sample" value={sampleMode ? undefined : "1"} label={sampleMode ? "실제 데이터로 돌아가기" : "샘플로 미리보기"} active={sampleMode} />
      </div>

      {sampleMode ? (
        <div className="rounded-md border border-blue-400 bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          샘플 데이터로 미리보고 있습니다. 실제 계정 데이터가 아니며, 화면이
          거래가 쌓였을 때 어떻게 보이는지 보여주기 위한 가상의 데이터입니다.
        </div>
      ) : null}

      {!sampleMode && metrics.insufficientSample ? (
        <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          표본 {metrics.n}건. 통계적 판단에는 최소 30건이 필요합니다. 아래
          수치는 참고용입니다.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">거래수</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{metrics.n}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">승률</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {(metrics.winRate * 100).toFixed(0)}%
            {winRateCI ? (
              <div className="text-xs font-normal text-muted-foreground">
                95% CI: {(winRateCI.lower * 100).toFixed(0)}%~
                {(winRateCI.upper * 100).toFixed(0)}%
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">평균승R</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{fmtR(metrics.avgWinR)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">평균패R</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">-{fmtR(metrics.avgLossR)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              <StatLabel label="기대값" explain="거래 1건당 평균적으로 기대되는 손익(R 단위). 양수면 이 방식을 계속했을 때 장기적으로 수익이 난다는 뜻입니다." />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {fmtR(metrics.expectancy)}
            {expectancyCI ? (
              <div className="text-xs font-normal text-muted-foreground">
                95% CI: {expectancyCI.lower.toFixed(2)}~{expectancyCI.upper.toFixed(2)}R
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              <StatLabel label="Profit Factor" explain="총 수익 ÷ 총 손실. 1보다 크면 벌어들인 돈이 잃은 돈보다 많다는 뜻입니다. 2 이상이면 안정적인 수준으로 봅니다." />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {metrics.profitFactor !== null ? metrics.profitFactor.toFixed(2) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              <StatLabel label="SQN" explain="시스템 퀄리티 넘버. 수익의 크기와 일관성(편차)을 함께 반영한 점수입니다. 대략 2 미만은 평범, 2~3은 양호, 3 이상은 우수한 편으로 봅니다." />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {metrics.sqn !== null ? metrics.sqn.toFixed(2) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">최대 연속 손실</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{metrics.maxConsecutiveLosses}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>R 분포 히스토그램</CardTitle>
        </CardHeader>
        <CardContent>
          <RHistogramChart bins={histogram} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>누적 R 곡선</CardTitle>
        </CardHeader>
        <CardContent>
          <CumulativeRChart curve={cumulativeCurve} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <StatLabel label="켈리 게이지" explain="승률·손익비를 바탕으로 수학적으로 계산한 '이론상 최적 베팅 비율'입니다. 변동성이 커서 보통 이 값의 1/4(쿼터 켈리) 정도만 실제로 사용하길 권장합니다." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KellyGauge
            fullKelly={metrics.kellyFraction}
            quarterKelly={metrics.quarterKelly}
            currentRiskPct={currentRiskPct}
          />
        </CardContent>
      </Card>

      {importedSummary.n > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>CSV로 가져온 거래</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              사전 계획이 없어 위 R-multiple 지표에는 포함되지 않지만, 실현 손익만 별도로 집계합니다.
            </p>
            <p>
              {importedSummary.n}건 · 승률 {(importedSummary.winRate * 100).toFixed(0)}% · 총 손익{" "}
              <span className={importedSummary.totalPnl >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>
                {Math.round(importedSummary.totalPnl).toLocaleString()}원
              </span>{" "}
              · 건당 평균 {Math.round(importedSummary.avgPnl).toLocaleString()}원
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
