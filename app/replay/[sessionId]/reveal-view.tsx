import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevealResult } from "@/lib/queries/replay";
import { RevealChart } from "./reveal-chart";
import { RetryButton } from "./retry-button";

export function RevealView({ result, sessionId }: { result: RevealResult; sessionId: string }) {
  const closedTrades = result.trades.filter((t) => t.realizedR !== null);
  const totalR = closedTrades.reduce((s, t) => s + (t.realizedR ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {result.name} ({result.ticker})
          {result.delistedAt ? <Badge variant="destructive" className="ml-2">상장폐지 {result.delistedAt}</Badge> : null}
        </h1>
        <p className="text-sm text-muted-foreground">
          {result.market ?? "—"} · 시작 {result.startDate} · {result.bars.length}봉 재생
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 구간 (진입/청산 마커 포함)</CardTitle>
        </CardHeader>
        <CardContent>
          <RevealChart bars={result.bars} trades={closedTrades} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>이번 세션 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>총 거래 {closedTrades.length}건 · 합산 {totalR.toFixed(2)}R</p>
          {closedTrades.map((t) => (
            <div key={t.id} className="flex justify-between border-b py-1 last:border-0">
              <span>
                {t.entryAt?.slice(0, 10)} → {t.exitAt?.slice(0, 10)}
              </span>
              <span>
                {t.realizedR?.toFixed(2)}R · 프로세스 {t.processScore}점 · {t.quadrant}
              </span>
            </div>
          ))}
          {closedTrades.length === 0 ? (
            <p className="text-muted-foreground">이번 세션에서는 거래를 하지 않았습니다.</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button render={<Link href="/replay" />}>새 세션</Button>
        <RetryButton seed={result.seed} level={result.level} />
        <Button variant="outline" render={<Link href={`/journal?source=replay`} />}>
          리플레이 저널 보기
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">세션 ID: {sessionId}</p>
    </div>
  );
}
