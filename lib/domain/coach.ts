import type { BiasRadar } from "./bias-metrics";
import type { SetupType, Trade } from "./types";

// Small local map instead of importing lib/labels.ts (UI-layer, not
// domain) — keeps this module independent of presentation code.
const SETUP_KO: Record<SetupType, string> = {
  breakout: "돌파",
  pullback: "눌림목",
  reversal: "역추세",
  earnings: "실적",
  flow: "수급",
  event: "이벤트",
  other: "기타",
};

export type CoachKind = "premortem" | "postmortem" | "weekly" | "monthly";

// docs/SPEC.md Phase 8-2, used verbatim — this is the only thing standing
// between the product and turning into a stock-tip bot, so don't paraphrase it.
export const COACH_SYSTEM_PROMPT = `당신은 트레이딩 코치입니다. 사용자의 매매 기록을 분석해 사고의 빈틈을 질문으로 드러냅니다.

[반드시 하는 것]
- 사용자가 선언한 계획과 실제 행동의 불일치를 구체적으로 지적한다
- 제공된 통계 수치를 인용해 패턴을 제시한다
- 행동재무학 개념(처분효과, 앵커링, 확증편향, 매몰비용, 손실회피)과 연결한다
- 다음 10거래에 적용할 검증 가능한 실험 1가지만 제안한다

[절대 하지 않는 것]
- 특정 종목의 매수/매도/보유 의견 제시
- 목표주가, 가격 예측, 상승/하락 전망
- "지금은 상승장/하락장입니다" 같은 시황 단정
- 근거 없는 위로나 격려
- 사용자가 제공하지 않은 수치를 지어내기

[톤]
단정하지 말고 질문하십시오. 판단은 사용자가 내립니다.
한국어로, 존댓말로, 간결하게 씁니다.

[출력 형식]
반드시 아래 JSON만 출력하십시오. 마크다운 코드펜스나 설명을 붙이지 마십시오.
{
  "observations": [{"claim": "...", "evidence": "..."}],
  "questions": ["...", "...", "..."],
  "concept": {"name": "...", "explanation": "..."},
  "experiment": {"rule": "...", "duration": "다음 10거래", "successMetric": "..."}
}`;

export interface CoachObservation {
  claim: string;
  evidence: string;
}
export interface CoachOutput {
  observations: CoachObservation[];
  questions: string[];
  concept: { name: string; explanation: string };
  experiment: { rule: string; duration: string; successMetric: string };
}

function isCoachOutput(value: unknown): value is CoachOutput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.observations) &&
    Array.isArray(v.questions) &&
    typeof v.concept === "object" &&
    v.concept !== null &&
    typeof v.experiment === "object" &&
    v.experiment !== null
  );
}

// docs/SPEC.md Phase 8-4: on parse failure, strip a markdown code fence and
// try once more; if that still fails, the caller shows an error UI (no
// second API call — this is a text-repair retry, not a re-prompt).
export function parseCoachResponse(raw: string): CoachOutput | null {
  try {
    const parsed = JSON.parse(raw);
    if (isCoachOutput(parsed)) return parsed;
  } catch {
    // fall through to the fence-stripped retry below
  }

  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped);
    if (isCoachOutput(parsed)) return parsed;
  } catch {
    // give up — caller shows an error UI
  }

  return null;
}

function fmtR(r: number | null): string {
  return r !== null ? `${r.toFixed(2)}R` : "미확정";
}

export function buildPremortemUserMessage(trade: Trade): string {
  return [
    "이 거래가 3주 후 최악의 손실이 되었다고 가정하십시오.",
    "가장 그럴듯한 실패 원인 3가지와, 지금 확인해야 할 질문을 제시하십시오.",
    "",
    "[거래 계획]",
    `- 셋업: ${SETUP_KO[trade.setup] ?? trade.setup}`,
    `- 논거: ${trade.thesis}`,
    `- 무효화 조건: ${trade.invalidation}`,
    `- 진입가: ${trade.entryPrice ?? "미정"} / 손절가: ${trade.stopPrice} / 목표가: ${trade.target1Price ?? "미정"}`,
    `- 계획 R: ${trade.plannedRMultiple ?? "미정"}`,
    `- 확신도: ${trade.confidence}%`,
    `- 감정 태그: ${trade.emotionTags.join(", ") || "없음"}`,
  ].join("\n");
}

export function buildPostmortemUserMessage(trade: Trade): string {
  return [
    "이 거래의 계획과 실제 행동을 대조해 분석하십시오.",
    "",
    "[계획]",
    `- 논거: ${trade.thesis}`,
    `- 무효화 조건: ${trade.invalidation}`,
    `- 손절가: ${trade.stopPrice} / 목표가: ${trade.target1Price ?? "미정"} / 계획 R: ${trade.plannedRMultiple ?? "미정"}`,
    "",
    "[실제]",
    `- 청산 사유: ${trade.exitReason ?? "미정"}`,
    `- 실현 R: ${fmtR(trade.realizedR)}`,
    `- MAE: ${fmtR(trade.maeR)} / MFE: ${fmtR(trade.mfeR)}`,
    `- 프로세스 점수: ${trade.processScore ?? "미정"} / 사분면: ${trade.quadrant ?? "미정"}`,
    `- 감정 태그: ${trade.emotionTags.join(", ") || "없음"}`,
  ].join("\n");
}

export function buildWeeklyUserMessage(recentTrades: Trade[], radar: BiasRadar): string {
  const closed = recentTrades.filter((t) => t.realizedR !== null);
  const lines = [
    "최근 7일간의 매매 기록과 편향 지표입니다. 패턴을 분석하십시오.",
    "",
    `[최근 7일 거래 ${closed.length}건]`,
    ...closed.map(
      (t, i) =>
        `${i + 1}. ${fmtR(t.realizedR)}, 프로세스 ${t.processScore ?? "—"}점, 사분면 ${t.quadrant ?? "—"}, 감정 태그 [${t.emotionTags.join(", ") || "없음"}]`
    ),
    "",
    "[행동 편향 레이더 (0=건강, 100=위험)]",
    `- 처분효과: ${radar.disposition.toFixed(0)}`,
    `- 보복매매: ${radar.revengeTrading.toFixed(0)}`,
    `- 과잉거래: ${radar.overtrading.toFixed(0)}`,
    `- 물타기: ${radar.averagingDown.toFixed(0)}`,
    `- 손절지연: ${radar.stopDelay.toFixed(0)}`,
    `- FOMO추격: ${radar.fomo.toFixed(0)}`,
  ];
  return lines.join("\n");
}

export interface MonthlySnapshot {
  n: number;
  winRate: number;
  expectancy: number;
  cumulativeR: number;
  avgProcessScore: number | null;
}

export interface ExperimentProgress {
  rule: string;
  compliant: number;
  total: number;
}

export function buildMonthlyUserMessage(
  thisMonth: MonthlySnapshot,
  lastMonth: MonthlySnapshot,
  ongoingExperiment: ExperimentProgress | null
): string {
  const lines = [
    "최근 30일 집계와 전월 대비 변화입니다. 패턴을 분석하십시오.",
    "",
    "[이번 달]",
    `- 거래수 ${thisMonth.n}건, 승률 ${(thisMonth.winRate * 100).toFixed(0)}%, 기대값 ${thisMonth.expectancy.toFixed(2)}R, 누적 ${thisMonth.cumulativeR.toFixed(2)}R`,
    `- 평균 프로세스 점수: ${thisMonth.avgProcessScore !== null ? thisMonth.avgProcessScore.toFixed(0) : "—"}`,
    "",
    "[전월]",
    `- 거래수 ${lastMonth.n}건, 승률 ${(lastMonth.winRate * 100).toFixed(0)}%, 기대값 ${lastMonth.expectancy.toFixed(2)}R, 누적 ${lastMonth.cumulativeR.toFixed(2)}R`,
  ];
  if (ongoingExperiment) {
    lines.push(
      "",
      "[진행 중인 실험]",
      `- 규칙: ${ongoingExperiment.rule}`,
      `- 준수: ${ongoingExperiment.compliant}/${ongoingExperiment.total}거래`
    );
  }
  return lines.join("\n");
}

// docs/SPEC.md Phase 8-4/8-5: "실험 준수율" needs a metric that works for any
// free-text experiment rule the model proposes. We don't parse that text —
// instead we use processScore >= 70 ("good process" per calcQuadrant's own
// threshold) on each of the next `sampleSize` closed trades since the
// experiment was proposed as a universal, always-available discipline proxy.
export function calcExperimentCompliance(
  tradesSinceExperiment: Trade[],
  sampleSize = 10
): { compliant: number; total: number; rate: number } {
  const sample = tradesSinceExperiment
    .filter((t) => t.realizedR !== null && t.processScore !== null)
    .slice(0, sampleSize);
  const compliant = sample.filter((t) => (t.processScore as number) >= 70).length;
  return {
    compliant,
    total: sample.length,
    rate: sample.length > 0 ? compliant / sample.length : 0,
  };
}
