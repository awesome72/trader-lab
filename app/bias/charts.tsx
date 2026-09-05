"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { BiasRadar } from "@/lib/domain/bias-metrics";

const AXIS_LABELS: Record<keyof BiasRadar, string> = {
  disposition: "처분효과",
  revengeTrading: "보복매매",
  overtrading: "과잉거래",
  averagingDown: "물타기",
  stopDelay: "손절지연",
  fomo: "FOMO추격",
};

const AXIS_ORDER: (keyof BiasRadar)[] = [
  "disposition",
  "revengeTrading",
  "overtrading",
  "averagingDown",
  "stopDelay",
  "fomo",
];

export function BiasRadarChart({ radar }: { radar: BiasRadar }) {
  const data = AXIS_ORDER.map((key) => ({
    axis: AXIS_LABELS[key],
    value: Math.round(radar[key]),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar
            name="위험도"
            dataKey="value"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.35}
          />
          <Tooltip formatter={(value) => [`${value}`, "위험도"]} />
        </RadarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        중심(0) = 건강한 상태, 바깥쪽(100) = 위험한 상태
      </p>
    </div>
  );
}
