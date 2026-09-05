"use client";

import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Trade } from "@/lib/domain/types";

export function RevealChart({
  bars,
  trades,
}: {
  bars: { d: string; open: number; high: number; low: number; close: number }[];
  trades: Trade[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { textColor: "#374151", background: { color: "transparent" } },
      grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
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
        time: b.d as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    const markers: SeriesMarker<Time>[] = [];
    for (const t of trades) {
      if (t.entryAt) {
        markers.push({
          time: t.entryAt.slice(0, 10) as Time,
          position: "belowBar",
          color: "#22c55e",
          shape: "arrowUp",
          text: "매수",
        });
      }
      if (t.exitAt) {
        markers.push({
          time: t.exitAt.slice(0, 10) as Time,
          position: "aboveBar",
          color: (t.realizedR ?? 0) >= 0 ? "#ef4444" : "#3b82f6",
          shape: "arrowDown",
          text: `매도 ${t.realizedR?.toFixed(1)}R`,
        });
      }
    }
    markers.sort((a, b) => (a.time as string).localeCompare(b.time as string));
    createSeriesMarkers(series, markers);

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [bars, trades]);

  return <div ref={containerRef} style={{ height: 420, width: "100%" }} />;
}
