import { redirect } from "next/navigation";
import Link from "next/link";
import { FilterLink } from "@/components/filter-link";
import { PageGuide } from "@/components/page-guide";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calcAveragingDownRate,
  calcBiasRadar,
  calcDispositionEffect,
  calcFomoStats,
  calcOvertradingSlope,
  calcRevengeTradingRate,
  calcStopDelayHours,
  deriveFomoPriceContextFromTags,
  findAveragingDownEvidence,
  findDispositionEvidence,
  findFomoEvidence,
  findOvertradingEvidence,
  findRevengeTradingEvidence,
  findStopDelayEvidence,
} from "@/lib/domain/bias-metrics";
import { winRateOf } from "@/lib/domain/metrics";
import type { SourceType, Trade } from "@/lib/domain/types";
import { PERIOD_DAYS, getEventsForTrades, getFilteredTrades } from "@/lib/queries/trades";
import { createClient } from "@/lib/supabase/server";
import { BiasRadarChart } from "./charts";

function TradeEvidenceList({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return <p className="text-sm text-muted-foreground">해당하는 거래가 없습니다.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {trades.slice(0, 10).map((t) => (
        <li key={t.id}>
          <Link href={`/journal/${t.id}`} className="text-primary underline underline-offset-2">
            {t.ticker ?? t.maskedLabel ?? t.id.slice(0, 8)}
            {t.entryAt ? ` · ${t.entryAt.slice(0, 10)}` : ""}
          </Link>
          {t.realizedR !== null && (
            <span className="ml-2 text-xs text-muted-foreground">{t.realizedR.toFixed(2)}R</span>
          )}
        </li>
      ))}
      {trades.length > 10 && (
        <li className="text-xs text-muted-foreground">외 {trades.length - 10}건</li>
      )}
    </ul>
  );
}

function StatusBadge({ breached }: { breached: boolean }) {
  return breached ? (
    <Badge variant="destructive">임계값 초과</Badge>
  ) : (
    <Badge variant="secondary">안전 범위</Badge>
  );
}

function BiasAxisCard({
  value,
  id,
  title,
  metricLine,
  breached,
  academic,
  trades,
  estimatedLossR,
  prescription,
}: {
  value: string;
  id: string;
  title: string;
  metricLine: string;
  breached: boolean;
  academic: string;
  trades: Trade[];
  estimatedLossR: number;
  prescription: string;
}) {
  return (
    <AccordionItem value={id}>
      <AccordionTrigger>
        <span className="flex flex-1 items-center justify-between pr-2">
          <span className="font-semibold">{title}</span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-normal text-muted-foreground">{value}</span>
            <StatusBadge breached={breached} />
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">① 수치</p>
            <p className="text-sm text-muted-foreground">{metricLine}</p>
          </div>
          <div>
            <p className="text-sm font-medium">② 학술적 설명</p>
            <p className="text-sm text-muted-foreground">{academic}</p>
          </div>
          <div>
            <p className="text-sm font-medium">③ 당신의 데이터</p>
            <p className="mb-1 text-sm text-muted-foreground">
              추정 손실:{" "}
              <span className={estimatedLossR < 0 ? "font-semibold text-red-600" : ""}>
                {estimatedLossR.toFixed(2)}R
              </span>
            </p>
            <TradeEvidenceList trades={trades} />
          </div>
          <div>
            <p className="text-sm font-medium">④ 처방</p>
            <p className="text-sm text-muted-foreground">{prescription}</p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default async function BiasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; source?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const source = (params.source as SourceType) ?? "live";
  const trades = await getFilteredTrades(user.id, { period: params.period, source });
  const events = await getEventsForTrades(
    user.id,
    trades.map((t) => t.id)
  );

  const priceContext = deriveFomoPriceContextFromTags(trades);
  const radar = calcBiasRadar(trades, events, priceContext);

  const disposition = calcDispositionEffect(trades);
  const revengeRate = calcRevengeTradingRate(trades);
  const overtradingSlope = calcOvertradingSlope(trades);
  const averagingDownRate = calcAveragingDownRate(trades, events);
  const stopDelayHours = calcStopDelayHours(trades, events);
  const fomoStats = calcFomoStats(trades, priceContext);
  const overallWinRate = winRateOf(
    trades.filter((t) => t.realizedR !== null).map((t) => t.realizedR as number)
  );

  const dispositionEvidence = findDispositionEvidence(trades);
  const revengeEvidence = findRevengeTradingEvidence(trades);
  const overtradingEvidence = findOvertradingEvidence(trades);
  const averagingDownEvidence = findAveragingDownEvidence(trades, events);
  const stopDelayEvidence = findStopDelayEvidence(trades, events);
  const fomoEvidence = findFomoEvidence(trades, priceContext);

  const closedCount = trades.filter((t) => t.realizedR !== null).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">행동 편향 레이더</h1>
      <PageGuide>
        <p>
          사람은 누구나 무의식적으로 특정 습관에 빠지기 쉽습니다. 예를 들어
          이익은 조금만 나도 서둘러 팔면서 손실은 &quot;오르겠지&quot;하며
          오래 쥐고 있거나(처분효과), 손실을 본 직후 화가 나서 계획에 없던
          매매를 무리하게 시도하는(보복매매) 식입니다.
        </p>
        <p>
          이 화면은 어떤 종목을 샀는지, 시장이 어땠는지와 전혀 상관없이{" "}
          <b>오직 당신의 행동 패턴</b>만 숫자로 보여줍니다. 6축 레이더에서
          중심(0)에 가까울수록 건강한 상태이고, 바깥쪽(100)에 가까울수록
          그 습관이 강하게 나타난다는 뜻입니다.
        </p>
      </PageGuide>
      <p className="text-sm text-muted-foreground">
        아래 지표는 종목이나 시황과 무관하게, 오직 당신의 매매 기록에서만
        계산됩니다. 표본이 적을수록(현재 {closedCount}건) 추정치의 신뢰도는
        낮습니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">기간:</span>
        <FilterLink basePath="/bias" searchParams={params} paramKey="period" value={undefined} label="전체" active={!params.period} />
        {Object.keys(PERIOD_DAYS).map((p) => (
          <FilterLink key={p} basePath="/bias" searchParams={params} paramKey="period" value={p} label={p} active={params.period === p} />
        ))}
        <span className="ml-4 text-sm text-muted-foreground">데이터:</span>
        <FilterLink basePath="/bias" searchParams={params} paramKey="source" value={undefined} label="실전" active={!params.source || params.source === "live"} />
        <FilterLink basePath="/bias" searchParams={params} paramKey="source" value="replay" label="리플레이" active={params.source === "replay"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>6축 편향 레이더</CardTitle>
        </CardHeader>
        <CardContent>
          <BiasRadarChart radar={radar} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Accordion multiple>
            <BiasAxisCard
              id="disposition"
              title="처분효과 (Disposition Effect)"
              value={`index ${disposition.index.toFixed(2)}`}
              metricLine={`이익실현비율(PGR) ${(disposition.pgr * 100).toFixed(0)}% − 손실실현비율(PLR) ${(disposition.plr * 100).toFixed(0)}% = ${disposition.index.toFixed(2)} (임계값 > 0.10)`}
              breached={disposition.index > 0.1}
              academic="Shefrin과 Statman(1985)은 투자자가 이익 난 포지션은 너무 일찍 팔고, 손실 난 포지션은 너무 오래 붙잡는 비대칭적 성향을 처음 제시했습니다. 이후 Odean(1998)은 실제 증권계좌 데이터로 이 현상이 세후 수익률을 유의하게 깎아먹는다는 것을 확인했습니다."
              trades={dispositionEvidence.trades}
              estimatedLossR={dispositionEvidence.estimatedLossR}
              prescription="다음 10거래는 목표가에 도달하면 예외 없이 최소 절반을 익절하고, 손절가가 터치되면 재량적 보유 없이 즉시 청산하십시오."
            />
            <BiasAxisCard
              id="revenge"
              title="보복매매 (Revenge Trading)"
              value={`${(revengeRate * 100).toFixed(0)}%`}
              metricLine={`직전 손실 거래 종료 후 60분 이내 재진입 비율: ${(revengeRate * 100).toFixed(1)}% (임계값 > 15%)`}
              breached={revengeRate > 0.15}
              academic="Coval과 Shumway(2005)는 전문 트레이더도 손실을 본 직후 위험 감수 성향이 커진다는 것을 보였고, Lo와 Repin(2002)은 생리적 각성이 손실 직후 매매 판단을 왜곡한다고 보고했습니다."
              trades={revengeEvidence.trades}
              estimatedLossR={revengeEvidence.estimatedLossR}
              prescription="손실 거래를 종료한 뒤에는 최소 60분간 신규 진입을 금지하는 '쿨다운 타이머'를 매매 체크리스트에 추가하십시오."
            />
            <BiasAxisCard
              id="overtrading"
              title="과잉거래 (Overtrading)"
              value={overtradingSlope.toFixed(2)}
              metricLine={`월별 거래 건수와 월 합산 R의 회귀 기울기: ${overtradingSlope.toFixed(2)} (임계값 < 0)`}
              breached={overtradingSlope < 0}
              academic="Barber와 Odean(2000)은 'Trading Is Hazardous to Your Wealth'에서 거래 빈도가 높은 계좌일수록 순수익률이 낮아진다는 것을 대규모 계좌 데이터로 보였습니다. 거래가 늘수록 비용과 충동적 의사결정이 함께 늘어나기 때문입니다."
              trades={overtradingEvidence.trades}
              estimatedLossR={overtradingEvidence.estimatedLossR}
              prescription="한 달 최대 거래 횟수 상한을 미리 정하고, 상한에 도달하면 그 달은 리뷰만 하고 신규 진입을 중단하십시오."
            />
            <BiasAxisCard
              id="averaging-down"
              title="물타기 (Averaging Down)"
              value={`${(averagingDownRate * 100).toFixed(0)}%`}
              metricLine={`손실 중인 포지션에 추가 매수한 거래 비율: ${(averagingDownRate * 100).toFixed(1)}% (임계값 > 0%)`}
              breached={averagingDownRate > 0}
              academic="Kahneman과 Tversky(1979)의 전망이론은 손실 회피 성향이 사람들로 하여금 손실을 '확정'하기보다 포지션을 키워서라도 만회하려는 선택을 하게 만든다고 설명합니다. 물타기는 계획된 리스크 한도를 사후에 무너뜨리는 대표적 형태입니다."
              trades={averagingDownEvidence.trades}
              estimatedLossR={averagingDownEvidence.estimatedLossR}
              prescription="진입 시 선언한 수량 외의 추가 매수는 손실 중인 포지션에서는 규칙으로 금지하고, 확신이 커졌다면 '별도의 신규 거래'로 처음부터 다시 계획하십시오."
            />
            <BiasAxisCard
              id="stop-delay"
              title="손절지연 (Stop-Loss Delay)"
              value={`${stopDelayHours.toFixed(1)}시간`}
              metricLine={`손절가 터치 후 실제 청산까지 평균 지연 시간: ${stopDelayHours.toFixed(1)}시간 (임계값 > 24시간)`}
              breached={stopDelayHours > 24}
              academic="Odean(1998)은 'Are Investors Reluctant to Realize Their Losses?'에서 투자자들이 손실을 확정하는 결정을 체계적으로 미룬다는 것을 보였습니다. 손절 지연은 감정적 고통을 피하려는 선택이지만, 손실 규모를 계획보다 키우는 결과로 이어집니다."
              trades={stopDelayEvidence.trades}
              estimatedLossR={stopDelayEvidence.estimatedLossR}
              prescription="손절가 도달 시 자동 알림(또는 예약 주문)을 설정해, '재량적 판단'이 개입할 시간을 원천적으로 없애십시오."
            />
            <BiasAxisCard
              id="fomo"
              title="FOMO 추격 (Chasing)"
              value={`승률차 ${((overallWinRate - fomoStats.winRate) * 100).toFixed(0)}%p`}
              metricLine={`FOMO 추격 매매 승률 ${(fomoStats.winRate * 100).toFixed(0)}% vs 전체 승률 ${(overallWinRate * 100).toFixed(0)}% (임계값: FOMO 승률 < 전체 승률)`}
              breached={fomoEvidence.trades.length > 0 && fomoStats.winRate < overallWinRate}
              academic="Barber와 Odean(2008)은 개인 투자자가 이미 크게 오른, 주의를 끄는 종목을 뒤늦게 추격 매수하는 경향이 있고 이런 매매의 성과가 체계적으로 낮다는 것을 보였습니다. 추격 매수는 '놓칠지도 모른다'는 감정이 사전 계획을 대체할 때 나타납니다."
              trades={fomoEvidence.trades}
              estimatedLossR={fomoEvidence.estimatedLossR}
              prescription="진입 전 '오늘 이미 크게 움직였는가'를 체크리스트 첫 항목으로 넣고, 해당하면 최소 하루는 관망 후 재평가하십시오."
            />
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
