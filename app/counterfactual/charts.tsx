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
import type { CounterfactualResult, CounterfactualScenario } from "@/lib/domain/counterfactual";
import { COUNTERFACTUAL_SCENARIO_LABELS } from "@/lib/labels";

const SCENARIO_COLORS: Record<CounterfactualScenario, string> = {
  actual: "#000000",
  stopDiscipline: "#ef4444",
  targetDiscipline: "#3b82f6",
  noAveraging: "#f59e0b",
  processFilter70: "#22c55e",
  noFomo: "#a855f7",
  topHalfConfidence: "#14b8a6",
};

const SCENARIO_ORDER = Object.keys(COUNTERFACTUAL_SCENARIO_LABELS) as CounterfactualScenario[];

export function CounterfactualOverlayChart({ results }: { results: CounterfactualResult[] }) {
  const actual = results.find((r) => r.scenario === "actual");
  if (!actual || actual.points.length === 0) {
    return <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>;
  }

  // Align every scenario onto actual's chronological trade sequence: hold the
  // last cumulative value flat for any trade a scenario excludes, so lines
  // stay comparable point-for-point without implying a trade happened there.
  const data = actual.points.map((actualPoint, i) => {
    const row: Record<string, number | string> = {
      index: i + 1,
      at: actualPoint.at.slice(0, 10),
    };
    for (const result of results) {
      const upToHere = result.points.filter((p) => p.at <= actualPoint.at);
      row[result.scenario] =
        upToHere.length > 0 ? upToHere[upToHere.length - 1].cumulativeR : 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="index"
          tick={{ fontSize: 11 }}
          label={{ value: "거래 순번", position: "insideBottom", offset: -10, fontSize: 11 }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          label={{ value: "누적 R", angle: -90, position: "insideLeft", fontSize: 11 }}
        />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toFixed(2)}R`,
            COUNTERFACTUAL_SCENARIO_LABELS[name as CounterfactualScenario] ?? name,
          ]}
        />
        <Legend
          formatter={(value) => COUNTERFACTUAL_SCENARIO_LABELS[value as CounterfactualScenario] ?? value}
          wrapperStyle={{ fontSize: 11 }}
        />
        {SCENARIO_ORDER.map((scenario) => (
          <Line
            key={scenario}
            type="monotone"
            dataKey={scenario}
            stroke={SCENARIO_COLORS[scenario]}
            strokeWidth={scenario === "actual" ? 2.5 : 1.5}
            strokeOpacity={scenario === "actual" ? 1 : 0.55}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
