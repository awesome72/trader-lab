"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProcessScoreBreakdown } from "@/lib/domain/process-score";
import type { Quadrant } from "@/lib/domain/types";

const QUADRANT_COLORS: Record<Quadrant, string> = {
  skill: "#22c55e",
  luck: "#ef4444",
  badluck: "#3b82f6",
  mistake: "#9ca3af",
};

const QUADRANT_BG: Record<Quadrant, string> = {
  skill: "#22c55e",
  luck: "#ef4444",
  badluck: "#3b82f6",
  mistake: "#9ca3af",
};

const BREAKDOWN_LABELS: Record<keyof ProcessScoreBreakdown, string> = {
  hasPlan: "사전 계획",
  invalidationQuality: "무효화 명시성",
  stopDiscipline: "손절 준수",
  sizing: "사이징 규율",
  noAveragingDown: "물타기 없음",
  horizonRespect: "지평 준수",
  emotion: "감정 상태",
};

export interface ScatterPoint {
  id: string;
  processScore: number;
  realizedR: number;
  quadrant: Quadrant;
}

export function ProcessScoreScatter({ points }: { points: ScatterPoint[] }) {
  const router = useRouter();
  const maxAbsR = Math.max(1, ...points.map((p) => Math.abs(p.realizedR)));
  const yBound = Math.ceil(maxAbsR * 1.1);

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="processScore"
            domain={[0, 100]}
            name="프로세스 점수"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="realizedR"
            domain={[-yBound, yBound]}
            name="실현 R"
            tick={{ fontSize: 11 }}
          />
          <ReferenceArea x1={70} x2={100} y1={0} y2={yBound} fill={QUADRANT_BG.skill} fillOpacity={0.08} />
          <ReferenceArea
            x1={0}
            x2={70}
            y1={0}
            y2={yBound}
            fill={QUADRANT_BG.luck}
            fillOpacity={0.08}
            stroke={QUADRANT_BG.luck}
            strokeOpacity={0.4}
            strokeWidth={2}
          />
          <ReferenceArea x1={70} x2={100} y1={-yBound} y2={0} fill={QUADRANT_BG.badluck} fillOpacity={0.08} />
          <ReferenceArea x1={0} x2={70} y1={-yBound} y2={0} fill={QUADRANT_BG.mistake} fillOpacity={0.08} />
          <ReferenceLine x={70} stroke="#999" strokeDasharray="4 4" />
          <ReferenceLine y={0} stroke="#999" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value, name) => [
              name === "realizedR" ? `${Number(value).toFixed(2)}R` : value,
              name === "realizedR" ? "실현 R" : "프로세스 점수",
            ]}
          />
          <Scatter
            data={points}
            onClick={(point) => {
              const p = point as unknown as ScatterPoint;
              if (p?.id) router.push(`/journal/${p.id}`);
            }}
            cursor="pointer"
          >
            {points.map((p) => (
              <Cell key={p.id} fill={QUADRANT_COLORS[p.quadrant]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        좌상단(<span style={{ color: QUADRANT_COLORS.luck }}>빨강 테두리</span>) =
        운이 좋았던 거래 — 반복되지 않습니다. 점을 클릭하면 저널로 이동합니다.
      </p>
    </div>
  );
}

export function QuadrantDonut({
  distribution,
}: {
  distribution: Record<Quadrant, number>;
}) {
  const data = (Object.keys(distribution) as Quadrant[])
    .map((q) => ({ name: q, value: distribution[q] }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={80}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={QUADRANT_COLORS[d.name]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${Number(value).toFixed(0)}%`} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BreakdownBarChart({
  average,
  weakestKey,
}: {
  average: ProcessScoreBreakdown;
  weakestKey: keyof ProcessScoreBreakdown;
}) {
  const maxByKey: Record<keyof ProcessScoreBreakdown, number> = {
    hasPlan: 20,
    invalidationQuality: 15,
    stopDiscipline: 25,
    sizing: 15,
    noAveragingDown: 10,
    horizonRespect: 10,
    emotion: 5,
  };

  const data = (Object.keys(average) as (keyof ProcessScoreBreakdown)[]).map(
    (key) => ({
      key,
      label: BREAKDOWN_LABELS[key],
      value: average[key],
      max: maxByKey[key],
      isWeakest: key === weakestKey,
    })
  );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={100} />
        <Tooltip
          formatter={(value, _name, item) => [
            `${Number(value).toFixed(1)} / ${item.payload.max}`,
            "평균",
          ]}
        />
        <Bar dataKey="value">
          {data.map((d) => (
            <Cell key={d.key} fill={d.isWeakest ? "#f59e0b" : "#3b82f6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
