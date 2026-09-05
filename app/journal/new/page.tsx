import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { profiles, trades } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { JournalForm } from "./journal-form";

export default async function NewJournalEntryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));

  const [prevTrade] = await db
    .select({ realizedR: trades.realizedR, exitAt: trades.exitAt })
    .from(trades)
    .where(eq(trades.userId, user.id))
    .orderBy(desc(trades.exitAt))
    .limit(1);

  let prevTradeWarning: string | null = null;
  if (prevTrade?.exitAt && (prevTrade.realizedR ?? 0) < 0) {
    const minutesSince = Math.round(
      (Date.now() - new Date(prevTrade.exitAt).getTime()) / 60_000
    );
    if (minutesSince >= 0 && minutesSince <= 60) {
      prevTradeWarning = `직전 손실 청산 후 ${minutesSince}분 경과. 보복매매 가능성을 점검하세요.`;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">새 저널 작성</h1>
      <JournalForm
        accountSize={profile?.accountSize ?? 10_000_000}
        defaultRiskPct={profile?.defaultRiskPct ?? 1}
        maxRiskPct={profile?.maxRiskPct ?? 2}
        prevTradeWarning={prevTradeWarning}
        prevTradeRealizedR={prevTrade?.realizedR ?? null}
      />
    </div>
  );
}
