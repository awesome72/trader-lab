import { describe, expect, it } from "vitest";
import { generateSampleTrades } from "./sample-data";

const asOf = new Date("2026-06-01T00:00:00.000Z");

describe("generateSampleTrades", () => {
  it("generates the requested count", () => {
    expect(generateSampleTrades(asOf, 40)).toHaveLength(40);
    expect(generateSampleTrades(asOf, 8)).toHaveLength(8);
  });

  it("is deterministic for the same asOf and count", () => {
    const a = generateSampleTrades(asOf, 20);
    const b = generateSampleTrades(asOf, 20);
    expect(a).toEqual(b);
  });

  it("covers all four quadrants", () => {
    const trades = generateSampleTrades(asOf, 40);
    const quadrants = new Set(trades.map((t) => t.quadrant));
    expect(quadrants).toEqual(new Set(["skill", "luck", "badluck", "mistake"]));
  });

  it("gives skill/luck trades a positive R and badluck/mistake a negative R", () => {
    const trades = generateSampleTrades(asOf, 40);
    for (const t of trades) {
      if (t.quadrant === "skill" || t.quadrant === "luck") {
        expect(t.realizedR!).toBeGreaterThan(0);
      } else {
        expect(t.realizedR!).toBeLessThan(0);
      }
    }
  });

  it("gives skill/badluck trades a high process score and luck/mistake a low one", () => {
    const trades = generateSampleTrades(asOf, 40);
    for (const t of trades) {
      if (t.quadrant === "skill" || t.quadrant === "badluck") {
        expect(t.processScore!).toBeGreaterThanOrEqual(75);
      } else {
        expect(t.processScore!).toBeLessThanOrEqual(55);
      }
    }
  });

  it("never dates a trade after asOf", () => {
    const trades = generateSampleTrades(asOf, 40);
    for (const t of trades) {
      expect(new Date(t.entryAt!).getTime()).toBeLessThanOrEqual(asOf.getTime());
      expect(new Date(t.exitAt!).getTime()).toBeLessThanOrEqual(asOf.getTime());
    }
  });

  it("orders trades chronologically by entryAt", () => {
    const trades = generateSampleTrades(asOf, 40);
    for (let i = 1; i < trades.length; i++) {
      expect(new Date(trades[i].entryAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(trades[i - 1].entryAt!).getTime()
      );
    }
  });
});
