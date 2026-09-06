import { redirect } from "next/navigation";
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
      <ReviewClient cards={cards} />
    </div>
  );
}
