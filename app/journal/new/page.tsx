import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PageGuide } from "@/components/page-guide";
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
      <PageGuide>
        <p>
          주식을 사기 전에 <b>&quot;왜 사는지&quot;</b>와{" "}
          <b>&quot;얼마가 되면 내 판단이 틀린 것인지&quot;</b>를 미리 적어두는
          화면입니다. 사람은 막상 손실이 나면 &quot;조금만 더 기다려보자&quot;며
          생각을 바꾸기 쉬운데, 사기 전에 미리 적어두면 나중에 실제로 어떻게
          됐는지와 비교해서 계획을 지켰는지 스스로 확인할 수 있습니다.
        </p>
        <p>
          한 번 저장하면 논거·손절가 같은 핵심 내용은{" "}
          <b>수정할 수 없습니다.</b> 나중에 &quot;사실 그때 이렇게
          생각했었다&quot;고 기억을 미화하는 것을 막기 위한 의도적인
          제한입니다.
        </p>
      </PageGuide>
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
