import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyDigestEmail, sendEmail } from "@/lib/email";
import { buildWeeklyDigestData, getDigestRecipientIds } from "@/lib/queries/digest";
import { createAdminClient } from "@/lib/supabase/admin";

// Triggered weekly by .github/workflows/weekly-digest.yml (same pattern as
// scripts/collector/'s daily.py cron) via a signed POST — never exposed to
// browsers. CRON_SECRET is a value we generate ourselves (not from an
// external service), shared between this route and the GitHub Actions
// secret.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://trader-lab-eight.vercel.app";
  const userIds = await getDigestRecipientIds();
  const admin = createAdminClient();

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      const email = data?.user?.email;
      if (error || !email) {
        skipped++;
        continue;
      }

      const digestData = await buildWeeklyDigestData(userId, siteUrl);
      const { subject, html, text } = buildWeeklyDigestEmail(digestData);
      const ok = await sendEmail(email, subject, html, text);
      if (ok) sent++;
      else skipped++;
    } catch (err) {
      errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ total: userIds.length, sent, skipped, errors });
}
