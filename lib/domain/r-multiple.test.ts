import { describe, expect, it } from "vitest";
import {
  applyCosts,
  calcPlannedR,
  calcPositionSize,
  calcRealizedR,
  calcRiskAmount,
} from "./r-multiple";

describe("calcPlannedR", () => {
  it("computes reward:risk for a normal long setup", () => {
    // entry 100, stop 90 (risk 10), target 130 (reward 30) -> 3R
    expect(calcPlannedR(100, 90, 130)).toBe(3);
  });

  it("computes reward:risk for a short setup", () => {
    // entry 100, stop 105 (short risk), target 85 -> 3R
    expect(calcPlannedR(100, 105, 85)).toBe(3);
  });

  it("returns null when entry equals stop (division by zero)", () => {
    expect(calcPlannedR(100, 100, 130)).toBeNull();
  });

  it("returns a negative R when target is below entry on a long", () => {
    expect(calcPlannedR(100, 90, 95)).toBe(-0.5);
  });
});

describe("calcRealizedR", () => {
  it("computes realized R for a winning long trade", () => {
    // entry 100, stop 90, exit 130 -> +3R
    expect(calcRealizedR(100, 90, 130, "long")).toBe(3);
  });

  it("computes realized R for a losing long trade", () => {
    expect(calcRealizedR(100, 90, 85, "long")).toBe(-1.5);
  });

  it("computes realized R for a winning short trade", () => {
    // entry 100, stop 105, exit 90 -> +2R
    expect(calcRealizedR(100, 105, 90, "short")).toBe(2);
  });

  it("returns null when entry equals stop (division by zero)", () => {
    expect(calcRealizedR(100, 100, 130, "long")).toBeNull();
  });
});

describe("calcRiskAmount", () => {
  it("computes the won amount at risk for a given risk %", () => {
    expect(calcRiskAmount(10_000_000, 2)).toBe(200_000);
  });

  it("returns 0 for a 0% risk setting (boundary)", () => {
    expect(calcRiskAmount(10_000_000, 0)).toBe(0);
  });
});

describe("calcPositionSize", () => {
  it("floors to whole shares for a normal case", () => {
    // risk amount 200,000 / risk-per-share 10 = 20,000 shares
    expect(calcPositionSize(10_000_000, 2, 100, 90)).toBe(20_000);
  });

  it("floors down when risk amount doesn't divide evenly", () => {
    // risk amount 150,000 / risk-per-share 7 = 21428.57.. -> floor 21428
    expect(calcPositionSize(10_000_000, 1.5, 100, 93)).toBe(21_428);
  });

  it("returns null when entry equals stop (division by zero)", () => {
    expect(calcPositionSize(10_000_000, 2, 100, 100)).toBeNull();
  });

  it("uses absolute distance so short setups (stop above entry) work too", () => {
    expect(calcPositionSize(10_000_000, 2, 100, 110)).toBe(20_000);
  });
});

describe("applyCosts", () => {
  it("deducts costs from a gross R value", () => {
    // entry 100, stop 90 -> 1R = 10 won/share
    // totalCostBps = 1.5*2 + 15 + 10*2 = 38 bps -> cost/share = 100*38/10000 = 0.38
    // costInR = 0.38/10 = 0.038
    const result = applyCosts(3, 100, 90, 1.5, 15, 10);
    expect(result).not.toBeNull();
    expect(result as number).toBeCloseTo(3 - 0.038, 6);
  });

  it("returns null when entry equals stop (division by zero)", () => {
    expect(applyCosts(3, 100, 100, 1.5, 15, 10)).toBeNull();
  });

  it("returns 0-ish net R when costs roughly equal a tiny gross R", () => {
    const result = applyCosts(0.038, 100, 90, 1.5, 15, 10);
    expect(result as number).toBeCloseTo(0, 6);
  });

  it("applies zero cost when all bps are 0 (boundary)", () => {
    expect(applyCosts(2, 100, 90, 0, 0, 0)).toBe(2);
  });
});
