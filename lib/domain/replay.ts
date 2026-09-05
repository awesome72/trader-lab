// Deterministic PRNG (Math.random() is banned in lib/domain for reproducibility).
// Duplicated from metrics.ts on purpose: each module stays independently pure.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ReplayCandidate {
  ticker: string;
  startDate: string;
  availableBars: number;
}

/**
 * Deterministically picks one eligible replay start point from a candidate
 * list, using the same seed for the same result every time (docs/SPEC.md
 * Phase 6: "다시 하기(같은 시드)"). Only candidates with at least `minBars`
 * bars available forward from startDate are eligible, so a session never
 * runs out of data (or delists) mid-replay before minBars have played out.
 */
export function selectReplayStart(
  candidates: ReplayCandidate[],
  seed: number,
  minBars = 250
): ReplayCandidate | null {
  const eligible = candidates.filter((c) => c.availableBars >= minBars);
  if (eligible.length === 0) return null;

  const rand = mulberry32(seed);
  const index = Math.floor(rand() * eligible.length);
  return eligible[Math.min(index, eligible.length - 1)];
}
