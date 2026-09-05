import { describe, expect, it } from "vitest";
import {
  buildMonthlyUserMessage,
  buildPostmortemUserMessage,
  buildPremortemUserMessage,
  buildWeeklyUserMessage,
  calcExperimentCompliance,
  parseCoachResponse,
  type CoachOutput,
} from "./coach";
import type { Trade } from "./types";

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    userId: "user-1",
    source: "live",
    ticker: "005930",
    maskedLabel: null,
    status: "closed",
    replaySessionId: null,
    entryAt: "2026-01-10T09:30:00.000Z",
    entryPrice: 100,
    quantity: 100,
    direction: "long",
    thesis: "종가가 20일 이동평균선을 돌파했습니다.",
    setup: "breakout",
    horizon: "swing",
    invalidation: "종가가 20일 이동평균선 아래로 마감하면 무효화됩니다.",
    stopPrice: 90,
    stopBasis: "technical",
    target1Price: 130,
    target2Price: null,
    confidence: 70,
    plannedRiskPct: 1,
    plannedRMultiple: 3,
    emotionTags: [],
    prevTradePnlR: null,
    conditionScore: 4,
    exitAt: "2026-01-13T09:30:00.000Z",
    exitPrice: 130,
    exitReason: "target",
    realizedR: 3,
    realizedPnl: 300000,
    maeR: -0.3,
    mfeR: 3.2,
    processScore: 80,
    processBreakdown: null,
    quadrant: "skill",
    journalLockedAt: "2026-01-10T09:45:00.000Z",
    createdAt: "2026-01-10T09:45:00.000Z",
    ...overrides,
  };
}

const validOutput: CoachOutput = {
  observations: [{ claim: "손절가를 옮겼습니다.", evidence: "move_stop 이벤트 1건" }],
  questions: ["왜 손절가를 옮겼습니까?"],
  concept: { name: "손실회피", explanation: "손실을 확정짓기 싫어하는 성향입니다." },
  experiment: { rule: "손절가 이동 금지", duration: "다음 10거래", successMetric: "위반 0건" },
};

describe("parseCoachResponse", () => {
  it("parses a clean JSON response", () => {
    expect(parseCoachResponse(JSON.stringify(validOutput))).toEqual(validOutput);
  });

  it("strips a markdown code fence and retries once", () => {
    const fenced = "```json\n" + JSON.stringify(validOutput) + "\n```";
    expect(parseCoachResponse(fenced)).toEqual(validOutput);
  });

  it("strips a fence with no language tag", () => {
    const fenced = "```\n" + JSON.stringify(validOutput) + "\n```";
    expect(parseCoachResponse(fenced)).toEqual(validOutput);
  });

  it("returns null for garbage that isn't JSON even after stripping", () => {
    expect(parseCoachResponse("이것은 그냥 텍스트입니다.")).toBeNull();
  });

  it("returns null when the JSON is valid but missing required keys", () => {
    expect(parseCoachResponse(JSON.stringify({ foo: "bar" }))).toBeNull();
  });
});

describe("buildPremortemUserMessage", () => {
  it("includes the plan's key fields", () => {
    const msg = buildPremortemUserMessage(makeTrade());
    expect(msg).toContain("돌파");
    expect(msg).toContain("종가가 20일 이동평균선을 돌파했습니다.");
    expect(msg).toContain("손절가: 90");
  });
});

describe("buildPostmortemUserMessage", () => {
  it("includes both plan and actual outcome fields", () => {
    const msg = buildPostmortemUserMessage(makeTrade());
    expect(msg).toContain("실현 R: 3.00R");
    expect(msg).toContain("프로세스 점수: 80");
    expect(msg).toContain("사분면: skill");
  });
});

describe("buildWeeklyUserMessage", () => {
  it("lists each closed trade and all six bias axes", () => {
    const radar = { disposition: 10, revengeTrading: 20, overtrading: 30, averagingDown: 0, stopDelay: 5, fomo: 15 };
    const msg = buildWeeklyUserMessage([makeTrade()], radar);
    expect(msg).toContain("3.00R");
    expect(msg).toContain("처분효과: 10");
    expect(msg).toContain("FOMO추격: 15");
  });
});

describe("buildMonthlyUserMessage", () => {
  it("includes this month, last month, and an ongoing experiment when present", () => {
    const thisMonth = { n: 20, winRate: 0.5, expectancy: 0.3, cumulativeR: 6, avgProcessScore: 75 };
    const lastMonth = { n: 18, winRate: 0.4, expectancy: 0.1, cumulativeR: 2, avgProcessScore: 60 };
    const msg = buildMonthlyUserMessage(thisMonth, lastMonth, { rule: "손절가 이동 금지", compliant: 7, total: 10 });
    expect(msg).toContain("거래수 20건");
    expect(msg).toContain("거래수 18건");
    expect(msg).toContain("7/10거래");
  });

  it("omits the experiment section when there is none", () => {
    const snap = { n: 0, winRate: 0, expectancy: 0, cumulativeR: 0, avgProcessScore: null };
    const msg = buildMonthlyUserMessage(snap, snap, null);
    expect(msg).not.toContain("진행 중인 실험");
  });
});

describe("calcExperimentCompliance", () => {
  it("counts trades with processScore >= 70 as compliant, capped at sampleSize", () => {
    const trades = [
      makeTrade({ id: "t1", processScore: 80 }),
      makeTrade({ id: "t2", processScore: 50 }),
      makeTrade({ id: "t3", processScore: 90 }),
    ];
    const result = calcExperimentCompliance(trades, 2);
    expect(result.total).toBe(2);
    expect(result.compliant).toBe(1); // only t1 within the first 2
    expect(result.rate).toBe(0.5);
  });

  it("ignores trades with no realized outcome or process score yet", () => {
    const trades = [makeTrade({ realizedR: null, processScore: null })];
    const result = calcExperimentCompliance(trades);
    expect(result.total).toBe(0);
    expect(result.rate).toBe(0);
  });

  it("returns zeros for an empty list (no throw)", () => {
    expect(calcExperimentCompliance([])).toEqual({ compliant: 0, total: 0, rate: 0 });
  });
});
