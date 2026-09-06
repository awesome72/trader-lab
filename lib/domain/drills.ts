// docs/SPEC.md Phase 9-B. A drill card presents a situation with 4 options;
// scoring is process-consistency (did the choice honor a pre-declared rule?)
// — never right/wrong, and never about whether the outcome was good.

export type DrillOptionKey = "A" | "B" | "C" | "D";

export interface DrillSituation {
  holdingState: string; // 보유상태
  priceContext: string; // 가격
  timing: string; // 시각
  marketContext: string; // 시장상황
}

export interface DrillOption {
  key: DrillOptionKey;
  label: string;
}

export interface DrillRubricEntry {
  score: number; // 0-100, process-consistency — not outcome quality
  explanation: string; // what pre-declared rule this choice presupposes
}

export interface DrillCard {
  id: string;
  code: string;
  title: string;
  situation: DrillSituation;
  options: DrillOption[];
  scoringRubric: Record<DrillOptionKey, DrillRubricEntry>;
  conceptTags: string[];
}

export function scoreDrillResponse(
  card: DrillCard,
  chosen: DrillOptionKey
): DrillRubricEntry | null {
  return card.scoringRubric[chosen] ?? null;
}

// docs/SPEC.md Phase 9-B-3: the same card is re-shown ~90 days later: how
// close the two scores are (not whether the literal choice matches) is the
// stability signal — a trader can rationally switch to an equally-sound
// option and still be "consistent," but a swing between a 100 and a 0
// answer means the underlying rule wasn't stable.
export function calcDrillConsistency(
  card: DrillCard,
  firstChoice: DrillOptionKey,
  secondChoice: DrillOptionKey
): number | null {
  const first = scoreDrillResponse(card, firstChoice);
  const second = scoreDrillResponse(card, secondChoice);
  if (!first || !second) return null;
  return 100 - Math.abs(first.score - second.score);
}

// docs/SPEC.md Phase 9-C-3 hook: a wrong/low-score drill answer feeds the
// SRS queue automatically.
export function isLowScoreDrillResponse(score: number, threshold = 50): boolean {
  return score < threshold;
}
