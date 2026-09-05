"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MetricsResult } from "@/lib/domain/metrics";
import { ConditionRow, makeConditionRow, rowToCondition, type ConditionRowState } from "./condition-row";
import { EquityCurveChart, type BacktestTradeLite } from "./charts";

interface RunResponse {
  ruleSetId: string;
  searchCount: number;
  searchWarning: string | null;
  splitDate: string;
  is: { trades: BacktestTradeLite[]; metrics: MetricsResult };
  oos: { trades: BacktestTradeLite[]; metrics: MetricsResult };
  overfitWarning: boolean;
  worstWindow: { startDate: string; endDate: string; cumulativeR: number; tradeCount: number } | null;
  tradeCount: number;
  error?: string;
}

function MetricsCard({ title, metrics }: { title: string; metrics: MetricsResult }) {
  return (
    <Card className="relative flex-1">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className={metrics.insufficientSample ? "space-y-1 text-sm blur-[2px]" : "space-y-1 text-sm"}>
        <p>거래수 {metrics.n}건</p>
        <p>승률 {(metrics.winRate * 100).toFixed(0)}%</p>
        <p>기대값 {metrics.expectancy.toFixed(2)}R</p>
        <p>누적 R {metrics.cumulativeR.toFixed(2)}R</p>
        <p>MDD {metrics.maxDrawdownR.toFixed(2)}R</p>
        <p>Profit Factor {metrics.profitFactor !== null ? metrics.profitFactor.toFixed(2) : "—"}</p>
      </CardContent>
      {metrics.insufficientSample ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/40">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            표본 부족 (n={metrics.n})
          </span>
        </div>
      ) : null}
    </Card>
  );
}

export function RuleBuilder() {
  const [entryRows, setEntryRows] = useState<ConditionRowState[]>([makeConditionRow()]);
  const [excludeRows, setExcludeRows] = useState<ConditionRowState[]>([]);
  const [stopType, setStopType] = useState<"atr" | "pct" | "fixed">("atr");
  const [stopAtrPeriod, setStopAtrPeriod] = useState(14);
  const [stopAtrMultiplier, setStopAtrMultiplier] = useState(2);
  const [stopPct, setStopPct] = useState(5);
  const [stopFixed, setStopFixed] = useState(1000);
  const [useTarget, setUseTarget] = useState(true);
  const [targetPct, setTargetPct] = useState(8);
  const [useTimeStop, setUseTimeStop] = useState(true);
  const [timeStopBars, setTimeStopBars] = useState(10);
  const [riskPct, setRiskPct] = useState(1);
  const [feeBps, setFeeBps] = useState(1.5);
  const [taxBps, setTaxBps] = useState(15);
  const [slippageBps, setSlippageBps] = useState(10);
  const [market, setMarket] = useState<string>("all");
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [ruleSetId, setRuleSetId] = useState<string | undefined>(undefined);
  const [name, setName] = useState("나의 룰 1");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  function buildRule() {
    const entry =
      entryRows.length === 1
        ? rowToCondition(entryRows[0])
        : { op: "AND" as const, conditions: entryRows.map(rowToCondition) };
    const exclude =
      excludeRows.length === 0
        ? undefined
        : excludeRows.length === 1
          ? rowToCondition(excludeRows[0])
          : { op: "OR" as const, conditions: excludeRows.map(rowToCondition) };

    const stop =
      stopType === "atr"
        ? { type: "atr" as const, period: stopAtrPeriod, multiplier: stopAtrMultiplier }
        : stopType === "pct"
          ? { type: "pct" as const, value: stopPct }
          : { type: "fixed" as const, value: stopFixed };

    return {
      entry,
      exclude,
      exit: {
        stop,
        target: useTarget ? { type: "pct" as const, value: targetPct } : undefined,
        timeStop: useTimeStop ? { bars: timeStopBars } : undefined,
      },
      sizing: { riskPct },
      costs: { feeBps, taxBps, slippageBps },
      universe: market === "all" ? undefined : { market },
      maxConcurrentPositions: maxConcurrent,
    };
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleSetId, name, rule: buildRule() }),
      });
      const data = (await res.json()) as RunResponse;
      if (!res.ok) {
        setError(data.error ?? "백테스트를 실행할 수 없습니다.");
        return;
      }
      setRuleSetId(data.ruleSetId);
      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>진입 조건 (모두 만족 시 AND)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {entryRows.map((row) => (
            <ConditionRow
              key={row.id}
              row={row}
              onChange={(next) => setEntryRows((rows) => rows.map((r) => (r.id === row.id ? next : r)))}
              onRemove={() => setEntryRows((rows) => rows.filter((r) => r.id !== row.id))}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => setEntryRows((rows) => [...rows, makeConditionRow()])}>
            조건 추가
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>제외 조건 (하나라도 만족 시 OR로 제외, 선택)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {excludeRows.map((row) => (
            <ConditionRow
              key={row.id}
              row={row}
              onChange={(next) => setExcludeRows((rows) => rows.map((r) => (r.id === row.id ? next : r)))}
              onRemove={() => setExcludeRows((rows) => rows.filter((r) => r.id !== row.id))}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => setExcludeRows((rows) => [...rows, makeConditionRow()])}>
            제외 조건 추가
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>청산 · 사이징 · 비용</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>손절</Label>
            <div className="flex gap-2">
              <Select value={stopType} onValueChange={(v) => v && setStopType(v as typeof stopType)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atr">ATR 배수</SelectItem>
                  <SelectItem value="pct">% 손절</SelectItem>
                  <SelectItem value="fixed">고정 금액</SelectItem>
                </SelectContent>
              </Select>
              {stopType === "atr" ? (
                <>
                  <Input type="number" className="w-20" value={stopAtrPeriod} onChange={(e) => setStopAtrPeriod(Number(e.target.value))} />
                  <Input type="number" step="0.1" className="w-20" value={stopAtrMultiplier} onChange={(e) => setStopAtrMultiplier(Number(e.target.value))} />
                </>
              ) : stopType === "pct" ? (
                <Input type="number" className="w-20" value={stopPct} onChange={(e) => setStopPct(Number(e.target.value))} />
              ) : (
                <Input type="number" className="w-24" value={stopFixed} onChange={(e) => setStopFixed(Number(e.target.value))} />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <input type="checkbox" checked={useTarget} onChange={(e) => setUseTarget(e.target.checked)} />
              목표가 (%)
            </Label>
            <Input type="number" className="w-24" value={targetPct} disabled={!useTarget} onChange={(e) => setTargetPct(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <input type="checkbox" checked={useTimeStop} onChange={(e) => setUseTimeStop(e.target.checked)} />
              시간 손절 (보유 봉수)
            </Label>
            <Input type="number" className="w-24" value={timeStopBars} disabled={!useTimeStop} onChange={(e) => setTimeStopBars(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>리스크 % (1건당)</Label>
            <Input type="number" step="0.1" className="w-24" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>동시 보유 종목 수</Label>
            <Input type="number" className="w-24" value={maxConcurrent} onChange={(e) => setMaxConcurrent(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>시장</Label>
            <Select value={market} onValueChange={(v) => v && setMarket(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="KOSPI">KOSPI</SelectItem>
                <SelectItem value="KOSDAQ">KOSDAQ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>수수료/세금/슬리피지 (bps)</Label>
            <div className="flex gap-2">
              <Input type="number" step="0.1" className="w-24" value={feeBps} onChange={(e) => setFeeBps(Number(e.target.value))} />
              <Input type="number" step="0.1" className="w-24" value={taxBps} onChange={(e) => setTaxBps(Number(e.target.value))} />
              <Input type="number" step="0.1" className="w-24" value={slippageBps} onChange={(e) => setSlippageBps(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Input className="w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="룰 이름" />
        <Button onClick={() => void handleRun()} disabled={running}>
          {running ? "실행 중..." : "실행"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-4">
          {result.searchWarning ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {result.searchWarning}
            </div>
          ) : null}
          {result.overfitWarning ? (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              과최적화 가능성이 높습니다. 이 규칙은 과거에만 작동했을 수 있습니다.
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>In-sample vs Out-of-sample (분할일: {result.splitDate})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              <MetricsCard title="In-sample (앞 70%)" metrics={result.is.metrics} />
              <MetricsCard title="Out-of-sample (뒤 30%)" metrics={result.oos.metrics} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>누적 R 곡선</CardTitle>
            </CardHeader>
            <CardContent>
              <EquityCurveChart isTrades={result.is.trades} oosTrades={result.oos.trades} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>최악의 연속 6개월 구간</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {result.worstWindow ? (
                <p>
                  {result.worstWindow.startDate} ~ {result.worstWindow.endDate}: {result.worstWindow.cumulativeR.toFixed(2)}R
                  ({result.worstWindow.tradeCount}건)
                </p>
              ) : (
                <p className="text-muted-foreground">거래가 없어 계산할 수 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
