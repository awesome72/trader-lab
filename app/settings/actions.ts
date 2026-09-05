"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

function parsePositiveNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function updateSettings(formData: FormData) {
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
  const feeBps = parsePositiveNumber(formData.get("feeBps"));
  const taxBps = parsePositiveNumber(formData.get("taxBps"));
  const slippageBps = parsePositiveNumber(formData.get("slippageBps"));

  if (
    accountSize === null ||
    defaultRiskPct === null ||
    maxRiskPct === null ||
    feeBps === null ||
    taxBps === null ||
    slippageBps === null
  ) {
    redirect("/settings?error=" + encodeURIComponent("입력값을 확인해주세요."));
  }

  // Re-validated server-side; the client form's number inputs are not trusted.
  await db
    .update(profiles)
    .set({
      accountSize,
      defaultRiskPct,
      maxRiskPct,
      feeBps,
      taxBps,
      slippageBps,
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}
