import { describe, expect, it } from "vitest";
import { calcDrillConsistency, isLowScoreDrillResponse, scoreDrillResponse } from "./drills";
import type { DrillCard } from "./drills";

function makeCard(overrides: Partial<DrillCard> = {}): DrillCard {
  return {
    id: "card-1",
    code: "stop-loss-bounce",
    title: "손절직전반등",
    situation: {
      holdingState: "보유 중, 진입가 50,000원 / 손절가 47,000원",
      priceContext: "현재가 47,100원, 손절가에 근접",
      timing: "장중 14:30",
      marketContext: "코스피 보합",
    },
    options: [
      { key: "A", label: "계획대로 손절 실행" },
      { key: "B", label: "반등 기대하며 손절가를 46,000원으로 낮춤" },
      { key: "C", label: "절반만 손절" },
      { key: "D", label: "반등 기대하며 추가매수" },
    ],
    scoringRubric: {
      A: { score: 100, explanation: "사전에 선언한 손절 규칙을 예외 없이 지킵니다." },
      B: { score: 10, explanation: "손절가를 사후에 유리한 쪽으로 옮기는 것을 전제로 합니다." },
      C: { score: 40, explanation: "계획에 없던 절반 청산이라는 재량을 전제로 합니다." },
      D: { score: 0, explanation: "손실 중 리스크를 확대하는 물타기를 전제로 합니다." },
    },
    conceptTags: ["손실회피", "매몰비용"],
    ...overrides,
  };
}

describe("scoreDrillResponse", () => {
  it("returns the rubric entry for a valid choice", () => {
    const result = scoreDrillResponse(makeCard(), "A");
    expect(result?.score).toBe(100);
  });

  it("returns null for an unknown option key (defensive, should never happen)", () => {
    const card = makeCard();
    // @ts-expect-error deliberately invalid key for the guard test
    expect(scoreDrillResponse(card, "Z")).toBeNull();
  });
});

describe("calcDrillConsistency", () => {
  it("returns 100 when the same choice is repeated (fully consistent)", () => {
    expect(calcDrillConsistency(makeCard(), "A", "A")).toBe(100);
  });

  it("returns a high score when both choices scored similarly, even if different", () => {
    // A card where two options both score reasonably well
    const card = makeCard({
      scoringRubric: {
        A: { score: 100, explanation: "x" },
        B: { score: 90, explanation: "y" },
        C: { score: 40, explanation: "z" },
        D: { score: 0, explanation: "w" },
      },
    });
    expect(calcDrillConsistency(card, "A", "B")).toBe(90);
  });

  it("returns a low score when the two choices scored very differently", () => {
    expect(calcDrillConsistency(makeCard(), "A", "D")).toBe(0);
  });

  it("returns null when either choice is invalid", () => {
    const card = makeCard();
    // @ts-expect-error deliberately invalid key for the guard test
    expect(calcDrillConsistency(card, "A", "Z")).toBeNull();
  });
});

describe("isLowScoreDrillResponse", () => {
  it("flags scores below the threshold", () => {
    expect(isLowScoreDrillResponse(40)).toBe(true);
    expect(isLowScoreDrillResponse(50)).toBe(false);
    expect(isLowScoreDrillResponse(60)).toBe(false);
  });
});
