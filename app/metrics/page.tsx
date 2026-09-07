import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FilterLink } from "@/components/filter-link";
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
  searchParams: Promise<{ period?: string; source?: string }>;
}) {
  const params = await searchParams;

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
  const trades = await getFilteredTrades(user.id, { period: params.period, source });

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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">기간:</span>
        <FilterLink basePath="/metrics" searchParams={params} paramKey="period" value={undefined} label="전체" active={!params.period} />
        {Object.keys(PERIOD_DAYS).map((p) => (
          <FilterLink key={p} basePath="/metrics" searchParams={params} paramKey="period" value={p} label={p} active={params.period === p} />
        ))}
        <span className="ml-4 text-sm text-muted-foreground">데이터:</span>
        <FilterLink basePath="/metrics" searchParams={params} paramKey="source" value={undefined} label="실전" active={!params.source || params.source === "live"} />
        <FilterLink basePath="/metrics" searchParams={params} paramKey="source" value="replay" label="리플레이" active={params.source === "replay"} />
      </div>

      {metrics.insufficientSample ? (
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
            <CardTitle className="text-xs font-normal text-muted-foreground">기대값</CardTitle>
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
            <CardTitle className="text-xs font-normal text-muted-foreground">Profit Factor</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {metrics.profitFactor !== null ? metrics.profitFactor.toFixed(2) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">SQN</CardTitle>
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
          <CardTitle>켈리 게이지</CardTitle>
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
