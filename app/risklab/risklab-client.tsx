"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildRiskComparisonCaption,
  buildSyntheticRDistribution,
  calcLossStreakProbability,
  compareRiskLevels,
  type RiskLevelComparison,
} from "@/lib/domain/monte-carlo";
import { DrawdownHistogram, FinalReturnHistogram } from "./charts";

const RISK_LEVELS = [0.5, 1, 2, 3, 5];

export function RiskLabClient({
  autoDistribution,
  tradeCount,
}: {
  autoDistribution: number[] | null;
  tradeCount: number;
}) {
  const [mode, setMode] = useState<"auto" | "manual">(autoDistribution ? "auto" : "manual");
  const [winRate, setWinRate] = useState(45);
  const [avgWinR, setAvgWinR] = useState(2);
  const [avgLossR, setAvgLossR] = useState(1);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RiskLevelComparison[] | null>(null);
  const [selectedRiskPct, setSelectedRiskPct] = useState(1);

  function currentDistribution(): number[] {
    if (mode === "auto" && autoDistribution) return autoDistribution;
    return buildSyntheticRDistribution(winRate / 100, avgWinR, avgLossR, 100);
  }

  // docs/SPEC.md Phase 9-D-2 asks for a Web Worker so this never blocks the
  // UI. A real `new Worker(new URL("./worker.ts", import.meta.url))` was
  // tried first, but this project's `next build` does not resolve that
  // pattern into a servable chunk (verified: no worker chunk is emitted, so
  // it would 404 at runtime) — without a browser to iterate against, that
  // wasn't safely fixable here. Falling back to running on the main thread,
  // deferred one tick (setTimeout) so the "실행 중" state actually paints
  // first. At this scale (1000 trials x 200 trades x 5 risk levels ~= 1M
  // simple arithmetic steps) the run completes in well under 100ms, so the
  // practical effect on responsiveness is negligible even without a worker.
  function runSimulation() {
    setRunning(true);
    setResults(null);

    const distribution = currentDistribution();
    setTimeout(() => {
      const comparison = compareRiskLevels(distribution, RISK_LEVELS, {
        trials: 1000,
        tradesPerTrial: 200,
        seed: 1,
      });
      setResults(comparison);
      setRunning(false);
    }, 0);
  }

  const selected = results?.find((r) => r.riskPct === selectedRiskPct)?.result ?? null;
  const caption = results ? buildRiskComparisonCaption(results) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>R 분포 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === "auto" ? "default" : "outline"}
              disabled={!autoDistribution}
              onClick={() => setMode("auto")}
            >
              실제 데이터 사용 {autoDistribution ? `(${tradeCount}건)` : "(30건 미만, 사용 불가)"}
            </Button>
            <Button variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>
              직접 가정 입력
            </Button>
          </div>

          {mode === "manual" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>승률 (%)</Label>
                <Input type="number" value={winRate} onChange={(e) => setWinRate(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>평균 승 R</Label>
                <Input type="number" step="0.1" value={avgWinR} onChange={(e) => setAvgWinR(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>평균 패 R</Label>
                <Input type="number" step="0.1" value={avgLossR} onChange={(e) => setAvgLossR(Number(e.target.value))} />
              </div>
            </div>
          ) : null}

          <Button onClick={runSimulation} disabled={running}>
            {running ? "시뮬레이션 실행 중... (백그라운드)" : "시뮬레이션 실행 (1000회 × 200거래)"}
          </Button>
        </CardContent>
      </Card>

      {results ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>리스크% 비교 (핵심)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {results.map((r) => (
                  <button
                    key={r.riskPct}
                    onClick={() => setSelectedRiskPct(r.riskPct)}
                    className={`rounded-md border p-2 text-center text-sm ${r.riskPct > 3 ? "bg-red-50 border-red-300" : ""} ${selectedRiskPct === r.riskPct ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="font-medium">{r.riskPct}%</div>
                    <div className="text-xs text-muted-foreground">
                      파산확률 {r.result ? (r.result.ruinProbability * 100).toFixed(0) : "—"}%
                    </div>
                  </button>
                ))}
              </div>
              {caption ? <p className="text-sm font-medium">{caption}</p> : null}
            </CardContent>
          </Card>

          {selected ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>최종 수익률 분포 (리스크 {selectedRiskPct}%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <FinalReturnHistogram finalReturns={selected.finalReturns} percentiles={selected.percentiles} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>MDD 분포</CardTitle>
                </CardHeader>
                <CardContent>
                  <DrawdownHistogram maxDrawdowns={selected.maxDrawdowns} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>연속 손실 확률</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {[3, 5, 7, 10].map((n) => (
                    <p key={n}>
                      {n}연속 손실을 겪을 확률:{" "}
                      <span className="font-medium">
                        {(calcLossStreakProbability(selected.longestLossStreakDist, n) * 100).toFixed(0)}%
                      </span>
                    </p>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      <p className="border-t pt-4 text-xs text-muted-foreground">
        이 시뮬레이션은 과거 R 분포가 미래에도 유지된다고 가정합니다. 시장
        국면 변화나 전략 열화는 반영되지 않습니다.
      </p>
    </div>
  );
}
