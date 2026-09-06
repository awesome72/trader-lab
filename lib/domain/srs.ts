// docs/SPEC.md Phase 9-C-1: SM-2 spaced-repetition scheduling, pure. Grade
// is 0-5 (SuperMemo convention: <3 = forgot, reset; >=3 = remembered, grow
// the interval). The first four passes follow a fixed schedule
// (1→3→7→16→35 days) rather than classic SM-2's interval*ease from rep 1,
// per the spec's explicit numbers; beyond that, interval*ease takes over.

const FIXED_INTERVAL_STEPS = [1, 3, 7, 16, 35] as const;
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

export interface SrsCardState {
  ease: number;
  intervalDays: number;
  reps: number;
}

export interface SrsReviewResult {
  ease: number;
  intervalDays: number;
  reps: number;
  dueAt: string; // ISO
}

export const DEFAULT_SRS_STATE: SrsCardState = {
  ease: DEFAULT_EASE,
  intervalDays: 1,
  reps: 0,
};

function updateEase(ease: number, grade: number): number {
  const next = ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  return Math.max(MIN_EASE, next);
}

export function reviewCard(state: SrsCardState, grade: number, now: Date): SrsReviewResult {
  const clampedGrade = Math.max(0, Math.min(5, Math.round(grade)));
  const ease = updateEase(state.ease, clampedGrade);

  let reps: number;
  let intervalDays: number;

  if (clampedGrade < 3) {
    // 오답 시 리셋 — interval and streak restart, ease keeps evolving.
    reps = 0;
    intervalDays = 1;
  } else {
    reps = state.reps + 1;
    intervalDays =
      reps <= FIXED_INTERVAL_STEPS.length
        ? FIXED_INTERVAL_STEPS[reps - 1]
        : Math.round(state.intervalDays * ease);
  }

  const dueAt = new Date(now.getTime() + intervalDays * 86_400_000).toISOString();
  return { ease, intervalDays, reps, dueAt };
}
