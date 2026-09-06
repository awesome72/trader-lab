"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { markOnboardingComplete } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";

function parsePositiveNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Same validation as app/settings/actions.ts's updateSettings, but this one
// stays inside the onboarding flow (redirects to step 2) instead of /settings.
export async function saveOnboardingStep1(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const accountSize = parsePositiveNumber(formData.get("accountSize"));
  const defaultRiskPct = parsePositiveNumber(formData.get("defaultRiskPct"));
  const maxRiskPct = parsePositiveNumber(formData.get("maxRiskPct"));

  if (accountSize === null || defaultRiskPct === null || maxRiskPct === null) {
    redirect("/onboarding?step=1&error=" + encodeURIComponent("입력값을 확인해주세요."));
  }

  await db.update(profiles).set({ accountSize, defaultRiskPct, maxRiskPct }).where(eq(profiles.id, user.id));
  redirect("/onboarding?step=2");
}

export async function completeOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  await markOnboardingComplete(user.id);
  return { ok: true };
}
