import { redirect } from "next/navigation";
import { getFilteredTrades } from "@/lib/queries/trades";
import { createClient } from "@/lib/supabase/server";
import { RiskLabClient } from "./risklab-client";

export default async function RiskLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const trades = await getFilteredTrades(user.id, { source: "live" });
  const closedRs = trades
    .map((t) => t.realizedR)
    .filter((r): r is number => r !== null);

  const autoDistribution = closedRs.length >= 30 ? closedRs : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">몬테카를로 리스크랩</h1>
        <p className="text-sm text-muted-foreground">
          같은 실력(R 분포)이라도 사이징에 따라 파산 확률이 어떻게 달라지는지
          체험합니다. 종목 추천이나 수익 예측이 아닙니다.
        </p>
      </div>
      <RiskLabClient autoDistribution={autoDistribution} tradeCount={closedRs.length} />
    </div>
  );
}
