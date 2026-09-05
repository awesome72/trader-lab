import { describe, expect, it } from "vitest";
import { simulate } from "./monte-carlo";

describe("simulate", () => {
  it("produces the same result for the same seed (determinism)", () => {
    const rDistribution = [2, -1, 1.5, -1, 3, -1, 1, -0.5];
    const opts = { trials: 200, tradesPerTrial: 50, riskPct: 1, seed: 42 };
    const a = simulate(rDistribution, opts);
    const b = simulate(rDistribution, opts);
    expect(a).toEqual(b);
  });

  it("produces different results for different seeds", () => {
    const rDistribution = [2, -1, 1.5, -1, 3, -1, 1, -0.5];
    const a = simulate(rDistribution, { trials: 200, tradesPerTrial: 50, riskPct: 1, seed: 1 });
    const b = simulate(rDistribution, { trials: 200, tradesPerTrial: 50, riskPct: 1, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it("returns null for an empty R distribution (division-by-zero guard)", () => {
    expect(simulate([], { trials: 100, tradesPerTrial: 50, riskPct: 1, seed: 1 })).toBeNull();
  });

  it("returns null when trials or tradesPerTrial are 0 (boundary)", () => {
    const rDistribution = [1, -1];
    expect(simulate(rDistribution, { trials: 0, tradesPerTrial: 50, riskPct: 1, seed: 1 })).toBeNull();
    expect(simulate(rDistribution, { trials: 10, tradesPerTrial: 0, riskPct: 1, seed: 1 })).toBeNull();
  });

  it("reports high ruin probability under a large risk % with an all-loss distribution", () => {
    const rDistribution = [-1, -1, -1, -1];
    const result = simulate(rDistribution, {
      trials: 100,
      tradesPerTrial: 20,
      riskPct: 5,
      seed: 7,
    });
    expect(result).not.toBeNull();
    expect((result as NonNullable<typeof result>).ruinProbability).toBe(1);
  });

  it("reports zero ruin probability and only non-negative streaks with an all-win distribution", () => {
    const rDistribution = [1, 2, 3];
    const result = simulate(rDistribution, {
      trials: 50,
      tradesPerTrial: 20,
      riskPct: 2,
      seed: 3,
    });
    expect(result).not.toBeNull();
    const r = result as NonNullable<typeof result>;
    expect(r.ruinProbability).toBe(0);
    expect(r.longestLossStreakDist.every((s) => s === 0)).toBe(true);
    expect(r.percentiles.p50).toBeGreaterThan(0);
  });
});
