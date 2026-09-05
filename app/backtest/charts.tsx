"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BacktestTradeLite {
  entryDate: string;
  r: number;
}

// Two independent cumulative-R curves, plotted on a shared bar-sequence axis
// (not calendar time) so IS and OOS are visually comparable side by side.
export function EquityCurveChart({ isTrades, oosTrades }: { isTrades: BacktestTradeLite[]; oosTrades: BacktestTradeLite[] }) {
  const maxLen = Math.max(isTrades.length, oosTrades.length);
  let isCum = 0;
  let oosCum = 0;
  const data = Array.from({ length: maxLen }, (_, i) => {
    if (i < isTrades.length) isCum += isTrades[i].r;
    if (i < oosTrades.length) oosCum += oosTrades[i].r;
    return {
      idx: i + 1,
      is: i < isTrades.length ? isCum : null,
      oos: i < oosTrades.length ? oosCum : null,
    };
  });

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">거래가 없습니다.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)}R`, name === "is" ? "In-sample" : "Out-of-sample"]} />
        <Legend formatter={(v) => (v === "is" ? "In-sample" : "Out-of-sample")} />
        <Line type="monotone" dataKey="is" stroke="#3b82f6" dot={false} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="oos" stroke="#f59e0b" dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
