"use client";

import { CandlestickSeries, createChart, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

interface QuizBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  idx: number;
}

export function QuizChart({ bars }: { bars: QuizBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { textColor: "#374151", background: { color: "transparent" } },
      grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
      timeScale: { visible: false },
      rightPriceScale: { visible: true },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444",
      downColor: "#3b82f6",
      borderVisible: false,
      wickUpColor: "#ef4444",
      wickDownColor: "#3b82f6",
    });
    series.setData(
      bars.map((b) => ({
        time: (b.idx * 86400) as UTCTimestamp,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      }))
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);

  return <div ref={containerRef} style={{ height: 320, width: "100%" }} />;
}
