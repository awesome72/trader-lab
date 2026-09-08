import { redirect } from "next/navigation";
import { PageGuide } from "@/components/page-guide";
import { getFilteredTrades, getEventsForTrades } from "@/lib/queries/trades";
import { ensureDeckInitialized, generatePersonalMistakeCards, getDueCards } from "@/lib/queries/srs";
import { createClient } from "@/lib/supabase/server";
import { ReviewClient } from "./review-client";

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  await ensureDeckInitialized(user.id);

  const trades = await getFilteredTrades(user.id, { source: "live" });
  const events = await getEventsForTrades(user.id, trades.map((t) => t.id));
  await generatePersonalMistakeCards(user.id, trades, events);

  const cards = await getDueCards(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">오늘의 복습</h1>
        <p className="text-sm text-muted-foreground">
          간격 반복 학습(SRS)으로 리스크 관리·행동재무학·시장 제도·통계 개념과
          당신의 실제 실수 패턴을 복습합니다.
        </p>
      </div>
      <PageGuide>
        <p>
          <b>간격 반복 학습(SRS)</b>은 &quot;다 외웠다&quot; 싶을 때쯤 다시
          한번 복습하면 훨씬 오래 기억에 남는다&quot;는 원리를 이용한
          학습법입니다. 처음엔 자주, 익숙해질수록 점점 간격을 늘려가며(1일 →
          3일 → 7일 → …) 반복해서 보여줍니다.
        </p>
        <p>
          공용 카드(리스크 관리·행동재무학 개념) 외에, <b>당신의 실제 매매
          기록에서 반복되는 실수 패턴</b>(예: 손절 미준수, 물타기)을 감지해
          만든 개인 맞춤 카드도 함께 섞여 나옵니다.
        </p>
      </PageGuide>
      <ReviewClient cards={cards} />
    </div>
  );
}
