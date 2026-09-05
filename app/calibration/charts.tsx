"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Line,
  LineChart,
} from "recharts";
import type { BrierTrendPoint, CalibrationBucket } from "@/lib/domain/calibration";

export function CalibrationCurveChart({ buckets }: { buckets: CalibrationBucket[] }) {
  const points = buckets.filter((b) => b.count > 0);
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 데이터가 없습니다.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="predicted" name="선언 확신도" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <YAxis type="number" dataKey="actual" name="실제 적중률" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <ZAxis type="number" dataKey="count" range={[40, 400]} name="표본 수" />
        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#999" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(value, name) => [name === "count" ? `${value}건` : `${Number(value).toFixed(0)}%`, name]}
        />
        <Scatter data={points} fill="#3b82f6" fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function BrierTrendChart({ trend }: { trend: BrierTrendPoint[] }) {
  if (trend.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 데이터가 없습니다.</p>;
  }
  const data = trend.map((p, i) => ({ idx: i + 1, rollingBrier: p.rollingBrier }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <ReferenceLine y={0.25} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "동전던지기 (0.25)", fontSize: 10, position: "insideTopRight" }} />
        <Tooltip formatter={(value) => [Number(value).toFixed(3), "Brier"]} />
        <Line type="monotone" dataKey="rollingBrier" stroke="#3b82f6" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
