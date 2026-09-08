import { redirect } from "next/navigation";
import { PageGuide } from "@/components/page-guide";
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
      <PageGuide>
        <p>
          매매 실력이 완전히 똑같은 두 사람이라도, 한 번 거래에{" "}
          <b>돈을 얼마나 베팅하는지(리스크 %)</b>에 따라 계좌가 완전히
          망가질 확률이 크게 달라집니다. 이 화면은 그 확률을 실제로 수천 번
          가상으로 시뮬레이션해서 눈으로 보여줍니다.
        </p>
        <p>
          <b>몬테카를로</b>는 &quot;같은 조건에서 수없이 반복해서 결과의
          분포를 본다&quot;는 뜻의 통계 기법 이름입니다. 종목을 추천하거나
          수익을 예측하는 도구가 아니라, <b>사이징(베팅 크기)이 왜 중요한지</b>{" "}
          체감하기 위한 도구입니다.
        </p>
      </PageGuide>
      <RiskLabClient autoDistribution={autoDistribution} tradeCount={closedRs.length} />
    </div>
  );
}
