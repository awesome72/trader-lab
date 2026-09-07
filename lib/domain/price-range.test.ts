import { describe, expect, it } from "vitest";
import { calcPriceRangeInWindow, type DailyBar } from "./price-range";

const bars: DailyBar[] = [
  { d: "2026-01-05", low: 98, high: 102 },
  { d: "2026-01-06", low: 95, high: 101 },
  { d: "2026-01-07", low: 100, high: 108 },
  { d: "2026-01-08", low: 103, high: 106 },
];

describe("calcPriceRangeInWindow", () => {
  it("returns the min low and max high within an inclusive date window", () => {
    expect(calcPriceRangeInWindow(bars, "2026-01-05", "2026-01-07")).toEqual({
      low: 95,
      high: 108,
    });
  });

  it("includes both boundary dates", () => {
    expect(calcPriceRangeInWindow(bars, "2026-01-06", "2026-01-08")).toEqual({
      low: 95,
      high: 108,
    });
  });

  it("returns null when no bar falls in the window", () => {
    expect(calcPriceRangeInWindow(bars, "2026-02-01", "2026-02-05")).toBeNull();
  });

  it("returns null for an empty bar list", () => {
    expect(calcPriceRangeInWindow([], "2026-01-01", "2026-01-31")).toBeNull();
  });

  it("handles a single-day window", () => {
    expect(calcPriceRangeInWindow(bars, "2026-01-07", "2026-01-07")).toEqual({
      low: 100,
      high: 108,
    });
  });
});
