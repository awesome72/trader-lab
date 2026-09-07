import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, replaySessions } from "@/lib/db/schema";

export async function getOnboardingStatus(userId: string): Promise<{ completed: boolean }> {
  const [row] = await db
    .select({ onboardingCompletedAt: profiles.onboardingCompletedAt })
    .from(profiles)
    .where(eq(profiles.id, userId));
  return { completed: row?.onboardingCompletedAt !== null && row?.onboardingCompletedAt !== undefined };
}

// Lets a trader leave mid-onboarding and resume where they left off instead
// of restarting at step 1 (the "?step=" URL always wins when explicitly
// given — this is only the fallback for a bare "/onboarding" link).
export async function getOnboardingStep(userId: string): Promise<number> {
  const [row] = await db.select({ onboardingStep: profiles.onboardingStep }).from(profiles).where(eq(profiles.id, userId));
  return row?.onboardingStep ?? 1;
}

export async function saveOnboardingStep(userId: string, step: number): Promise<void> {
  await db.update(profiles).set({ onboardingStep: step }).where(eq(profiles.id, userId));
}

// A created session is a deliberate action (clicking "세션 시작"), so its
// mere existence is treated as "체험 완료" for onboarding purposes — the
// spec's own replay flow already forces a journal entry before any trade,
// so simply starting a session already means the trader engaged with it.
export async function hasStartedReplaySession(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: replaySessions.id }).from(replaySessions).where(eq(replaySessions.userId, userId)).limit(1);
  return !!row;
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  await db.update(profiles).set({ onboardingCompletedAt: new Date() }).where(eq(profiles.id, userId));
}
