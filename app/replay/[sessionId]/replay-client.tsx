"use client";

import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calcSMA } from "@/lib/domain/indicators";
import { calcRealizedR } from "@/lib/domain/r-multiple";
import type { Direction } from "@/lib/domain/types";
import type { ReplayEntryInput } from "@/lib/validation/journal";
import { BuyModal } from "./buy-modal";

interface ReplayBarDTO {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  idx: number;
}

interface PositionView {
  entryPrice: number;
  stopPrice: number;
  target1Price: number | null;
  direction: Direction;
  quantity: number | null;
}

function toChartTime(idx: number): UTCTimestamp {
  // Synthetic day index, never the real trading date (docs/SPEC.md 6-1: no
  // actual dates may leave the server before reveal).
  return (idx * 86400) as UTCTimestamp;
}

export function ReplayClient({
  sessionId,
  level,
  initialBars,
  initialPosition,
}: {
  sessionId: string;
  level: number;
  initialBars: ReplayBarDTO[];
  initialPosition: PositionView | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ma5SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [bars, setBars] = useState<ReplayBarDTO[]>(initialBars);
  const [position, setPosition] = useState<PositionView | null>(initialPosition);
  const [done, setDone] = useState(false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastClose, setLastClose] = useState<{
    realizedR: number;
    processScore: number;
    quadrant: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chart setup — created once.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { textColor: "#374151", background: { color: "transparent" } },
      grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
      timeScale: { timeVisible: false, secondsVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderVisible: false,
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
    });
    candleSeriesRef.current = candleSeries;

    const ma5 = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      visible: false,
    });
    ma5SeriesRef.current = ma5;

    const ma20 = chart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 1,
      visible: false,
    });
    ma20SeriesRef.current = ma20;

    const volume = chart.addSeries(
      HistogramSeries,
      { color: "#9ca3af", priceFormat: { type: "volume" } },
      1
    );
    volumeSeriesRef.current = volume;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Data updates whenever bars/level change.
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(
      bars.map((b) => ({ time: toChartTime(b.idx), open: b.o, high: b.h, low: b.l, close: b.c }))
    );

    const closes = bars.map((b) => b.c);
    const showMA = level >= 2;
    const showVolume = level >= 3;

    if (ma5SeriesRef.current) {
      ma5SeriesRef.current.applyOptions({ visible: showMA });
      if (showMA) {
        const ma5 = calcSMA(closes, 5);
        ma5SeriesRef.current.setData(
          bars
            .map((b, i) => (ma5[i] !== null ? { time: toChartTime(b.idx), value: ma5[i] as number } : null))
            .filter((p): p is { time: UTCTimestamp; value: number } => p !== null)
        );
      }
    }
    if (ma20SeriesRef.current) {
      ma20SeriesRef.current.applyOptions({ visible: showMA });
      if (showMA) {
        const ma20 = calcSMA(closes, 20);
        ma20SeriesRef.current.setData(
          bars
            .map((b, i) => (ma20[i] !== null ? { time: toChartTime(b.idx), value: ma20[i] as number } : null))
            .filter((p): p is { time: UTCTimestamp; value: number } => p !== null)
        );
      }
    }
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: showVolume });
      if (showVolume) {
        volumeSeriesRef.current.setData(
          bars.map((b) => ({ time: toChartTime(b.idx), value: b.v }))
        );
      }
    }

    chartRef.current?.timeScale().fitContent();
  }, [bars, level]);

  const currentBar = bars[bars.length - 1];

  const advance = useCallback(async () => {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/replay/next-bar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "다음 봉을 불러올 수 없습니다.");
        return;
      }
      if (data.done) {
        setDone(true);
        return;
      }
      setBars((prev) => [...prev, data.bar]);
    } finally {
      setBusy(false);
    }
  }, [sessionId, busy, done]);

  // Spacebar advances one bar, unless a modal/input has focus.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (buyModalOpen) return;
      e.preventDefault();
      void advance();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, buyModalOpen]);

  async function advanceMany(n: number) {
    for (let i = 0; i < n; i++) {
      if (done) break;
      await advance();
    }
  }

  async function handleBuySubmit(input: ReplayEntryInput) {
    setBusy(true);
    setBuyError(null);
    try {
      const res = await fetch(`/api/replay/session/${sessionId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        setBuyError(data.error ?? "진입할 수 없습니다.");
        return;
      }
      setPosition({
        entryPrice: currentBar.c,
        stopPrice: input.stopPrice,
        target1Price: input.target1Price ?? null,
        direction: "long",
        quantity: null,
      });
      setLastClose(null);
      setBuyModalOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleSell() {
    if (busy || !position) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/replay/session/${sessionId}/sell`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "청산할 수 없습니다.");
        return;
      }
      setLastClose({
        realizedR: data.realizedR,
        processScore: data.processScore,
        quadrant: data.quadrant,
      });
      setPosition(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleEndSession() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/replay/session/${sessionId}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "세션을 종료할 수 없습니다.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const unrealizedR = position
    ? calcRealizedR(position.entryPrice, position.stopPrice, currentBar.c, position.direction)
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader>
          <CardTitle>종목 A</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={containerRef} style={{ height: 420, width: "100%" }} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">컨트롤</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">진행 봉 수: {bars.length}</p>

            {position ? (
              <div className="rounded-md border p-2 text-sm">
                <p>보유 중 (진입 {position.entryPrice.toLocaleString()})</p>
                <p className={unrealizedR !== null && unrealizedR < 0 ? "text-red-600" : "text-emerald-600"}>
                  미실현 {unrealizedR !== null ? `${unrealizedR.toFixed(2)}R` : "—"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">보유 포지션 없음</p>
            )}

            {lastClose ? (
              <div className="rounded-md border bg-muted p-2 text-sm">
                <p>직전 청산: {lastClose.realizedR.toFixed(2)}R</p>
                <p>프로세스 {lastClose.processScore}점 · {lastClose.quadrant}</p>
              </div>
            ) : null}

            {done ? (
              <p className="text-sm text-amber-600">데이터가 종료 지점에 도달했습니다. 세션을 종료하세요.</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => void advance()} disabled={busy || done}>
                다음 봉 ▶
              </Button>
              <Button variant="outline" onClick={() => void advanceMany(10)} disabled={busy || done}>
                10봉 진행
              </Button>
              <Button
                onClick={() => setBuyModalOpen(true)}
                disabled={busy || !!position || done}
              >
                매수
              </Button>
              <Button variant="secondary" onClick={() => void handleSell()} disabled={busy || !position}>
                매도
              </Button>
            </div>

            <Button variant="destructive" className="w-full" onClick={() => void handleEndSession()} disabled={busy}>
              세션 종료
            </Button>
          </CardContent>
        </Card>

        {level >= 4 ? (
          <p className="text-xs text-muted-foreground">
            60분봉 전환(L4)·코스피 오버레이(L5)는 실시간/지수 데이터 파이프라인이
            준비되는 대로 제공됩니다 (docs/SPEC.md Phase 10).
          </p>
        ) : null}
      </div>

      <BuyModal
        open={buyModalOpen}
        onOpenChange={setBuyModalOpen}
        currentPrice={currentBar?.c ?? 0}
        onSubmit={(input) => void handleBuySubmit(input)}
        submitting={busy}
        error={buyError}
      />
    </div>
  );
}
