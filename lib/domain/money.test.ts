import { describe, expect, it } from "vitest";
import { round } from "./money";

describe("round", () => {
  it("rounds to 2 decimals by default", () => {
    expect(round(1.005)).toBeCloseTo(1.01, 5);
  });

  it("fixes classic float drift (0.1 + 0.2)", () => {
    expect(round(0.1 + 0.2)).toBe(0.3);
  });

  it("supports custom decimal places", () => {
    expect(round(1.23456, 3)).toBe(1.235);
  });

  it("rounds to whole numbers when decimals=0", () => {
    expect(round(1234.6, 0)).toBe(1235);
  });

  it("handles negative numbers", () => {
    expect(round(-1.005)).toBeCloseTo(-1.0, 5);
  });

  it("handles zero", () => {
    expect(round(0)).toBe(0);
  });
});
