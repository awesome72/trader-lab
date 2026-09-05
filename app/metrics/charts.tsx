"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RHistogramBin } from "@/lib/domain/metrics";

const NEGATIVE_COLOR = "#ef4444"; // stop-discipline violation trace
const POSITIVE_COLOR = "#3b82f6";

export function RHistogramChart({ bins }: { bins: RHistogramBin[] }) {
  const data = bins.map((b) => ({
    label: `${b.binStart.toFixed(1)}R`,
    count: b.count,
    isViolation: b.binStart < -1,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count">
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isViolation ? NEGATIVE_COLOR : POSITIVE_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> -1R
        보다 왼쪽 막대 = 손절 규칙 미준수의 흔적
      </p>
    </div>
  );
}

export function CumulativeRChart({ curve }: { curve: number[] }) {
  const data = curve.map((cumulative, i) => ({ trade: i + 1, cumulative }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="trade" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <ReferenceLine y={0} stroke="#999" />
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke={POSITIVE_COLOR}
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function KellyGauge({
  fullKelly,
  quarterKelly,
  currentRiskPct,
}: {
  fullKelly: number | null;
  quarterKelly: number | null;
  currentRiskPct: number;
}) {
  const data = [
    { label: "Full Kelly", value: fullKelly !== null ? fullKelly * 100 : 0 },
    {
      label: "1/4 Kelly (권장)",
      value: quarterKelly !== null ? quarterKelly * 100 : 0,
    },
  ];

  if (fullKelly === null) {
    return (
      <p className="text-sm text-muted-foreground">
        평균 손실이 0이라 켈리 비중을 계산할 수 없습니다.
      </p>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
          <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={100} />
          <Tooltip />
          <ReferenceLine
            x={currentRiskPct}
            stroke="#f59e0b"
            label={{ value: `현재 ${currentRiskPct}%`, fontSize: 11, position: "top" }}
          />
          <Bar dataKey="value" fill={POSITIVE_COLOR} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        풀 켈리는 이론적 최대 성장률이지만 실무에서는 파산 위험이 큽니다. 1/4
        켈리가 일반적 권장치입니다.
      </p>
    </div>
  );
}
