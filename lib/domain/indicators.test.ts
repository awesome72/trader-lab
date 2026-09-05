import { describe, expect, it } from "vitest";
import {
  calcATR,
  calcBollingerBands,
  calcEMA,
  calcHighest,
  calcLowest,
  calcRollingSum,
  calcRSI,
  calcSMA,
} from "./indicators";

describe("calcSMA", () => {
  it("returns null until enough values accumulate, then the rolling average", () => {
    expect(calcSMA([10, 20, 30, 40, 50], 3)).toEqual([null, null, 20, 30, 40]);
  });

  it("returns an empty array for empty input", () => {
    expect(calcSMA([], 5)).toEqual([]);
  });
});

describe("calcEMA", () => {
  it("seeds with the SMA of the first period, then applies exponential smoothing", () => {
    const result = calcEMA([10, 20, 30, 40, 50], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(20, 6); // SMA(10,20,30)
    // k = 2/4 = 0.5 -> ema3 = 40*0.5 + 20*0.5 = 30
    expect(result[3]).toBeCloseTo(30, 6);
  });
});

describe("calcRSI", () => {
  it("returns null before period+1 values exist", () => {
    const result = calcRSI([1, 2, 3], 14);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it("returns 100 when there are no losses in the window (boundary)", () => {
    const closes = Array.from({ length: 15 }, (_, i) => 100 + i); // strictly rising
    const result = calcRSI(closes, 14);
    expect(result[14]).toBe(100);
  });

  it("computes a mid-range RSI for a mixed up/down series", () => {
    const closes = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107];
    const result = calcRSI(closes, 14);
    expect(result[14]).not.toBeNull();
    expect(result[14] as number).toBeGreaterThan(0);
    expect(result[14] as number).toBeLessThan(100);
  });
});

describe("calcATR", () => {
  it("returns null before period bars exist", () => {
    const result = calcATR([10, 11], [9, 10], [9.5, 10.5], 14);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it("computes a positive ATR once enough bars exist", () => {
    const n = 20;
    const highs = Array.from({ length: n }, (_, i) => 110 + i);
    const lows = Array.from({ length: n }, (_, i) => 100 + i);
    const closes = Array.from({ length: n }, (_, i) => 105 + i);
    const result = calcATR(highs, lows, closes, 14);
    expect(result[13]).not.toBeNull();
    expect(result[13] as number).toBeGreaterThan(0);
  });
});

describe("calcBollingerBands", () => {
  it("centers the mid band on the SMA and spreads bands by stdev", () => {
    const closes = [10, 10, 10, 10, 20]; // last bar introduces spread
    const { upper, mid, lower } = calcBollingerBands(closes, 5, 2);
    expect(mid[4]).toBeCloseTo(12, 6);
    expect(upper[4] as number).toBeGreaterThan(mid[4] as number);
    expect(lower[4] as number).toBeLessThan(mid[4] as number);
  });
});

describe("calcHighest / calcLowest", () => {
  it("tracks the rolling max/min inclusive of the current bar", () => {
    const values = [5, 8, 3, 9, 2];
    expect(calcHighest(values, 3)).toEqual([null, null, 8, 9, 9]);
    expect(calcLowest(values, 3)).toEqual([null, null, 3, 3, 2]);
  });
});

describe("calcRollingSum", () => {
  it("sums the trailing window inclusive of the current bar", () => {
    expect(calcRollingSum([1, 2, 3, 4], 2)).toEqual([null, 3, 5, 7]);
  });

  it("returns an empty array for empty input", () => {
    expect(calcRollingSum([], 3)).toEqual([]);
  });
});
