"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import { calcPlannedR } from "@/lib/domain/r-multiple";
import { createClient } from "@/lib/supabase/server";
import { journalEntrySchema, type JournalEntryInput } from "@/lib/validation/journal";

export async function createTrade(
  input: JournalEntryInput
): Promise<{ ok: false; error: string } | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Never trust client-side zod validation alone.
  const parsed = journalEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }
  const values = parsed.data;

  const [prevTrade] = await db
    .select({ realizedR: trades.realizedR })
    .from(trades)
    .where(eq(trades.userId, user.id))
    .orderBy(desc(trades.exitAt))
    .limit(1);

  const plannedRMultiple = values.target1Price
    ? calcPlannedR(values.entryPrice, values.stopPrice, values.target1Price)
    : null;

  const now = new Date();

  const [inserted] = await db
    .insert(trades)
    .values({
      userId: user.id,
      source: "live",
      ticker: values.ticker,
      status: "open",
      entryAt: new Date(values.entryAt),
      entryPrice: values.entryPrice,
      quantity: values.quantity,
      direction: values.direction,
      thesis: values.thesis,
      setup: values.setup,
      horizon: values.horizon,
      invalidation: values.invalidation,
      stopPrice: values.stopPrice,
      stopBasis: values.stopBasis,
      target1Price: values.target1Price ?? null,
      target2Price: values.target2Price ?? null,
      confidence: values.confidence,
      plannedRiskPct: values.plannedRiskPct,
      plannedRMultiple,
      emotionTags: values.emotionTags,
      prevTradePnlR: prevTrade?.realizedR ?? null,
      conditionScore: values.conditionScore ?? null,
      journalLockedAt: now,
      createdAt: now,
    })
    .returning({ id: trades.id });

  revalidatePath("/journal");
  redirect(`/journal/${inserted.id}`);
}
