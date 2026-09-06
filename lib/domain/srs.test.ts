import { describe, expect, it } from "vitest";
import { DEFAULT_SRS_STATE, reviewCard } from "./srs";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("reviewCard", () => {
  it("follows the fixed 1/3/7/16/35-day schedule for consecutive passes", () => {
    let state = DEFAULT_SRS_STATE;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = reviewCard(state, 4, NOW);
      intervals.push(result.intervalDays);
      state = result;
    }
    expect(intervals).toEqual([1, 3, 7, 16, 35]);
  });

  it("resets reps and interval to 1 on a failing grade (< 3)", () => {
    let state = DEFAULT_SRS_STATE;
    state = reviewCard(state, 5, NOW); // rep 1 -> interval 1
    state = reviewCard(state, 5, NOW); // rep 2 -> interval 3
    const failed = reviewCard(state, 1, NOW);
    expect(failed.reps).toBe(0);
    expect(failed.intervalDays).toBe(1);
  });

  it("switches to interval*ease growth after the fixed schedule is exhausted", () => {
    let state = DEFAULT_SRS_STATE;
    for (let i = 0; i < 5; i++) {
      state = reviewCard(state, 4, NOW);
    }
    // state.intervalDays is now 35 (5th fixed step); the 6th pass should
    // grow by the *new* ease rather than following a 6th fixed step.
    const sixth = reviewCard(state, 4, NOW);
    expect(sixth.intervalDays).toBe(Math.round(state.intervalDays * sixth.ease));
    expect(sixth.intervalDays).toBeGreaterThan(35);
  });

  it("increases ease on a perfect grade (5) and decreases it on a marginal pass (3)", () => {
    const perfect = reviewCard(DEFAULT_SRS_STATE, 5, NOW);
    const marginal = reviewCard(DEFAULT_SRS_STATE, 3, NOW);
    expect(perfect.ease).toBeGreaterThan(DEFAULT_SRS_STATE.ease);
    expect(marginal.ease).toBeLessThan(DEFAULT_SRS_STATE.ease);
  });

  it("never lets ease drop below the 1.3 floor even after repeated failures", () => {
    let state = DEFAULT_SRS_STATE;
    for (let i = 0; i < 20; i++) {
      state = reviewCard(state, 0, NOW);
    }
    expect(state.ease).toBeGreaterThanOrEqual(1.3);
  });

  it("computes dueAt as now + intervalDays", () => {
    const result = reviewCard(DEFAULT_SRS_STATE, 4, NOW);
    expect(result.dueAt).toBe(new Date(NOW.getTime() + 86_400_000).toISOString());
  });

  it("clamps out-of-range grades instead of throwing", () => {
    expect(() => reviewCard(DEFAULT_SRS_STATE, 9, NOW)).not.toThrow();
    expect(() => reviewCard(DEFAULT_SRS_STATE, -3, NOW)).not.toThrow();
  });
});
