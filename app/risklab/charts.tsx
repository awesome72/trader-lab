"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calcRHistogram } from "@/lib/domain/metrics";

function HistogramChart({ values, binSize }: { values: number[]; binSize: number }) {
  const bins = calcRHistogram(values, binSize);
  const data = bins.map((b) => ({ label: `${b.binStart.toFixed(0)}~${b.binEnd.toFixed(0)}%`, count: b.count }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.ceil(data.length / 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => [`${value}회`, "빈도"]} />
        <Bar dataKey="count" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FinalReturnHistogram({
  finalReturns,
  percentiles,
}: {
  finalReturns: number[];
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
}) {
  return (
    <div>
      <HistogramChart values={finalReturns} binSize={5} />
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-xs text-muted-foreground">
        <div>p5<br /><span className="font-medium text-foreground">{percentiles.p5.toFixed(0)}%</span></div>
        <div>p25<br /><span className="font-medium text-foreground">{percentiles.p25.toFixed(0)}%</span></div>
        <div>p50<br /><span className="font-medium text-foreground">{percentiles.p50.toFixed(0)}%</span></div>
        <div>p75<br /><span className="font-medium text-foreground">{percentiles.p75.toFixed(0)}%</span></div>
        <div>p95<br /><span className="font-medium text-foreground">{percentiles.p95.toFixed(0)}%</span></div>
      </div>
    </div>
  );
}

export function DrawdownHistogram({ maxDrawdowns }: { maxDrawdowns: number[] }) {
  const sorted = [...maxDrawdowns].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95Worst = sorted[Math.floor(sorted.length * 0.05)] ?? 0; // worst 5% tail

  return (
    <div>
      <HistogramChart values={maxDrawdowns} binSize={5} />
      <div className="mt-2 grid grid-cols-2 gap-1 text-center text-xs text-muted-foreground">
        <div>중앙값<br /><span className="font-medium text-foreground">{median.toFixed(0)}%</span></div>
        <div>최악 5%<br /><span className="font-medium text-foreground">{p95Worst.toFixed(0)}%</span></div>
      </div>
    </div>
  );
}
