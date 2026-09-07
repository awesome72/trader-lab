import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getOngoingExperiment } from "@/lib/queries/coach";
import { getWeeklyProcessScoreComparison } from "@/lib/queries/dashboard";
import { getDueCardCount } from "@/lib/queries/srs";
import type { WeeklyDigestData } from "@/lib/email";

export async function getDigestRecipientIds(): Promise<string[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.weeklyDigestEnabled, true));
  return rows.map((r) => r.id);
}

// Reuses the exact same queries the home dashboard already calls (see
// app/page.tsx) so the digest email can never drift from what the
// dashboard itself shows.
export async function buildWeeklyDigestData(userId: string, siteUrl: string): Promise<WeeklyDigestData> {
  const [weeklyScore, dueCardCount, experiment] = await Promise.all([
    getWeeklyProcessScoreComparison(userId),
    getDueCardCount(userId),
    getOngoingExperiment(userId),
  ]);

  return {
    thisWeekScore: weeklyScore.thisWeek,
    lastWeekScore: weeklyScore.lastWeek,
    dueCardCount,
    experiment,
    siteUrl,
  };
}
