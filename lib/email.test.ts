import { describe, expect, it } from "vitest";
import { buildWeeklyDigestEmail } from "./email";

describe("buildWeeklyDigestEmail", () => {
  it("reports this/last week scores when trades were closed this week", () => {
    const result = buildWeeklyDigestEmail({
      thisWeekScore: 82,
      lastWeekScore: 65,
      dueCardCount: 0,
      experiment: null,
      siteUrl: "https://example.com",
    });
    expect(result.text).toContain("이번 주 평균 프로세스 점수: 82 (지난주 65)");
    expect(result.text).toContain("복습할 카드가 없습니다");
    expect(result.html).toContain("82");
  });

  it("falls back to a no-trades line when thisWeekScore is null", () => {
    const result = buildWeeklyDigestEmail({
      thisWeekScore: null,
      lastWeekScore: null,
      dueCardCount: 3,
      experiment: null,
      siteUrl: "https://example.com",
    });
    expect(result.text).toContain("이번 주 청산된 거래가 없습니다.");
    expect(result.text).toContain("복습 대기 카드 3장");
  });

  it("includes the ongoing experiment line when present", () => {
    const result = buildWeeklyDigestEmail({
      thisWeekScore: 70,
      lastWeekScore: 70,
      dueCardCount: 0,
      experiment: { rule: "손절가 이탈 시 반드시 청산", compliant: 7, total: 10 },
      siteUrl: "https://example.com",
    });
    expect(result.text).toContain('진행 중인 실험 "손절가 이탈 시 반드시 청산": 최근 10거래 중 7회 준수.');
  });

  it("always includes the site URL and opt-out note", () => {
    const result = buildWeeklyDigestEmail({
      thisWeekScore: null,
      lastWeekScore: null,
      dueCardCount: 0,
      experiment: null,
      siteUrl: "https://trader-lab-eight.vercel.app",
    });
    expect(result.text).toContain("https://trader-lab-eight.vercel.app");
    expect(result.text).toContain("설정 페이지에서 끌 수 있습니다");
  });
});
