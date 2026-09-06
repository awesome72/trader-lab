import { describe, expect, it } from "vitest";
import {
  buildRiskComparisonCaption,
  buildSyntheticRDistribution,
  calcLossStreakProbability,
  compareRiskLevels,
  simulate,
} from "./monte-carlo";

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

describe("buildSyntheticRDistribution", () => {
  it("builds a sample matching the given win rate proportions", () => {
    const dist = buildSyntheticRDistribution(0.4, 2, 1, 100);
    expect(dist.filter((r) => r > 0)).toHaveLength(40);
    expect(dist.filter((r) => r < 0)).toHaveLength(60);
  });

  it("uses the absolute magnitudes regardless of input sign", () => {
    const dist = buildSyntheticRDistribution(0.5, 2, -1, 10);
    expect(dist.every((r) => r === 2 || r === -1)).toBe(true);
  });

  it("clamps an out-of-range win rate instead of producing an invalid split", () => {
    const dist = buildSyntheticRDistribution(1.5, 2, 1, 10);
    expect(dist.filter((r) => r > 0)).toHaveLength(10);
  });
});

describe("compareRiskLevels", () => {
  it("runs the same distribution at each requested risk level", () => {
    const rDistribution = [2, -1, 1.5, -1, 3, -1];
    const results = compareRiskLevels(rDistribution, [0.5, 1, 2, 3, 5], {
      trials: 100,
      tradesPerTrial: 50,
      seed: 1,
    });
    expect(results.map((r) => r.riskPct)).toEqual([0.5, 1, 2, 3, 5]);
    expect(results.every((r) => r.result !== null)).toBe(true);
  });

  it("shows higher risk% generally producing higher ruin probability for a risky distribution", () => {
    const rDistribution = [1, -1, -1, -1];
    const results = compareRiskLevels(rDistribution, [1, 10], {
      trials: 300,
      tradesPerTrial: 100,
      seed: 5,
    });
    const [low, high] = results;
    expect((high.result?.ruinProbability ?? 0)).toBeGreaterThanOrEqual(low.result?.ruinProbability ?? 0);
  });
});

describe("buildRiskComparisonCaption", () => {
  it("names the lowest and highest ruin probabilities across risk levels", () => {
    const comparisons = [
      { riskPct: 0.5, result: { ruinProbability: 0.02 } as never },
      { riskPct: 5, result: { ruinProbability: 0.6 } as never },
    ];
    const caption = buildRiskComparisonCaption(comparisons);
    expect(caption).toContain("2%");
    expect(caption).toContain("60%");
  });

  it("returns null when fewer than 2 valid comparisons exist", () => {
    expect(buildRiskComparisonCaption([{ riskPct: 1, result: null }])).toBeNull();
  });
});

describe("calcLossStreakProbability", () => {
  it("computes the share of trials reaching at least N consecutive losses", () => {
    expect(calcLossStreakProbability([1, 3, 5, 2, 6], 5)).toBeCloseTo(0.4, 6);
  });

  it("returns 0 for an empty distribution (division-by-zero guard)", () => {
    expect(calcLossStreakProbability([], 5)).toBe(0);
  });
});
