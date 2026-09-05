import { redirect } from "next/navigation";
import { FilterLink } from "@/components/filter-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  generateCounterfactualConclusion,
  runCounterfactualScenarios,
  summarizeCounterfactuals,
} from "@/lib/domain/counterfactual";
import type { SourceType } from "@/lib/domain/types";
import { COUNTERFACTUAL_SCENARIO_LABELS } from "@/lib/labels";
import { PERIOD_DAYS, getEventsForTrades, getFilteredTrades } from "@/lib/queries/trades";
import { createClient } from "@/lib/supabase/server";
import { CounterfactualOverlayChart } from "./charts";

export default async function CounterfactualPage({
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

  const source = (params.source as SourceType) ?? "live";
  const trades = await getFilteredTrades(user.id, { period: params.period, source });
  const events = await getEventsForTrades(
    user.id,
    trades.map((t) => t.id)
  );

  const results = runCounterfactualScenarios(trades, events);
  const summary = summarizeCounterfactuals(results);
  const conclusion = generateCounterfactualConclusion(summary);
  const actualCount = results.find((r) => r.scenario === "actual")?.tradeCount ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">반사실 시뮬레이터</h1>
      <p className="text-sm text-muted-foreground">
        &ldquo;더 나은 종목&rdquo;이 아니라 &ldquo;더 나은 규칙 준수&rdquo;가
        결과를 얼마나 바꿨을지, 진입 시점에 이미 선언되어 있던 규칙만으로
        재구성합니다. 미래 가격을 참조한 사후 최적화는 포함하지 않습니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">기간:</span>
        <FilterLink basePath="/counterfactual" searchParams={params} paramKey="period" value={undefined} label="전체" active={!params.period} />
        {Object.keys(PERIOD_DAYS).map((p) => (
          <FilterLink key={p} basePath="/counterfactual" searchParams={params} paramKey="period" value={p} label={p} active={params.period === p} />
        ))}
        <span className="ml-4 text-sm text-muted-foreground">데이터:</span>
        <FilterLink basePath="/counterfactual" searchParams={params} paramKey="source" value={undefined} label="실전" active={!params.source || params.source === "live"} />
        <FilterLink basePath="/counterfactual" searchParams={params} paramKey="source" value="replay" label="리플레이" active={params.source === "replay"} />
      </div>

      {actualCount === 0 ? (
        <div className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          청산된 거래가 없어 시뮬레이션할 데이터가 없습니다.
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>시나리오별 누적 R 곡선</CardTitle>
            </CardHeader>
            <CardContent>
              <CounterfactualOverlayChart results={results} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>결론</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-medium">{conclusion}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>시나리오 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시나리오</TableHead>
                    <TableHead className="text-right">누적 R</TableHead>
                    <TableHead className="text-right">MDD</TableHead>
                    <TableHead className="text-right">거래수</TableHead>
                    <TableHead className="text-right">actual 대비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((row) => (
                    <TableRow key={row.scenario}>
                      <TableCell className={row.scenario === "actual" ? "font-semibold" : ""}>
                        {COUNTERFACTUAL_SCENARIO_LABELS[row.scenario]}
                      </TableCell>
                      <TableCell className="text-right">{row.cumulativeR.toFixed(2)}R</TableCell>
                      <TableCell className="text-right">{row.maxDrawdownR.toFixed(2)}R</TableCell>
                      <TableCell className="text-right">{row.tradeCount}</TableCell>
                      <TableCell
                        className={`text-right ${
                          row.diffVsActual > 0
                            ? "text-emerald-600"
                            : row.diffVsActual < 0
                              ? "text-red-600"
                              : ""
                        }`}
                      >
                        {row.scenario === "actual"
                          ? "—"
                          : `${row.diffVsActual >= 0 ? "+" : ""}${row.diffVsActual.toFixed(2)}R`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
