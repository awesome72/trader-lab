import { describe, expect, it } from "vitest";
import { selectReplayStart } from "./replay";

describe("selectReplayStart", () => {
  it("only considers candidates with enough bars available", () => {
    const candidates = [
      { ticker: "a", startDate: "2024-01-01", availableBars: 100 },
      { ticker: "b", startDate: "2024-01-01", availableBars: 300 },
    ];
    const result = selectReplayStart(candidates, 1, 250);
    expect(result?.ticker).toBe("b");
  });

  it("returns null when no candidate has enough bars", () => {
    const candidates = [{ ticker: "a", startDate: "2024-01-01", availableBars: 100 }];
    expect(selectReplayStart(candidates, 1, 250)).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(selectReplayStart([], 1)).toBeNull();
  });

  it("is deterministic: the same seed always returns the same candidate", () => {
    const candidates = [
      { ticker: "a", startDate: "2024-01-01", availableBars: 300 },
      { ticker: "b", startDate: "2024-02-01", availableBars: 300 },
      { ticker: "c", startDate: "2024-03-01", availableBars: 300 },
    ];
    const first = selectReplayStart(candidates, 42);
    const second = selectReplayStart(candidates, 42);
    expect(first).toEqual(second);
  });

  it("different seeds can pick different candidates", () => {
    const candidates = [
      { ticker: "a", startDate: "2024-01-01", availableBars: 300 },
      { ticker: "b", startDate: "2024-02-01", availableBars: 300 },
      { ticker: "c", startDate: "2024-03-01", availableBars: 300 },
    ];
    const picks = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => selectReplayStart(candidates, seed)?.ticker)
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
