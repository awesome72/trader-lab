import Link from "next/link";
import { redirect } from "next/navigation";
import { ToastOnParam } from "@/components/toast-on-param";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calcBiasRadar, deriveFomoPriceContextFromTags, type BiasRadar } from "@/lib/domain/bias-metrics";
import { QUADRANT_LABELS } from "@/lib/labels";
import { getOngoingExperiment } from "@/lib/queries/coach";
import { getOpenPositions, getRecentClosedTrades, getWeeklyProcessScoreComparison } from "@/lib/queries/dashboard";
import { getOnboardingStatus } from "@/lib/queries/onboarding";
import { getDueCardCount } from "@/lib/queries/srs";
import { getEventsForTrades, getFilteredTrades } from "@/lib/queries/trades";
import { createClient } from "@/lib/supabase/server";

const AXIS_LABELS: Record<keyof BiasRadar, string> = {
  disposition: "처분효과",
  revengeTrading: "보복매매",
  overtrading: "과잉거래",
  averagingDown: "물타기",
  stopDelay: "손절지연",
  fomo: "FOMO추격",
};

const QUICK_LINKS: { href: string; label: string }[] = [
  { href: "/journal", label: "저널" },
  { href: "/scorecard", label: "스코어카드" },
  { href: "/metrics", label: "R-멀티플" },
  { href: "/bias", label: "편향 레이더" },
  { href: "/counterfactual", label: "반사실 시뮬레이터" },
  { href: "/replay", label: "리플레이" },
  { href: "/backtest", label: "백테스터" },
  { href: "/coach", label: "AI 코치" },
  { href: "/calibration", label: "캘리브레이션" },
  { href: "/drills", label: "시나리오 드릴" },
  { href: "/cards", label: "복습 카드" },
  { href: "/risklab", label: "리스크랩" },
  { href: "/import", label: "거래내역 임포트" },
  { href: "/settings", label: "설정" },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [onboarding, openPositions, experiment, weeklyScore, dueCardCount, recentTrades, allLiveTrades] = await Promise.all([
    getOnboardingStatus(user.id),
    getOpenPositions(user.id),
    getOngoingExperiment(user.id),
    getWeeklyProcessScoreComparison(user.id),
    getDueCardCount(user.id),
    getRecentClosedTrades(user.id, 5),
    getFilteredTrades(user.id, { source: "live" }),
  ]);

  const events = await getEventsForTrades(user.id, allLiveTrades.map((t) => t.id));
  const priceContext = deriveFomoPriceContextFromTags(allLiveTrades);
  const radar = calcBiasRadar(allLiveTrades, events, priceContext);
  const worstAxis = (Object.keys(radar) as (keyof BiasRadar)[]).reduce((worst, key) =>
    radar[key] > radar[worst] ? key : worst
  );

  const scoreDelta =
    weeklyScore.thisWeek !== null && weeklyScore.lastWeek !== null
      ? weeklyScore.thisWeek - weeklyScore.lastWeek
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <ToastOnParam
        entries={[
          { param: "onboarded", type: "success", message: "온보딩을 완료했습니다! 이제 실제 저널을 작성해보세요." },
        ]}
      />
      {!onboarding.completed ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center justify-between pt-6">
            <p className="text-sm">아직 온보딩을 완료하지 않았습니다. 5단계로 핵심 기능을 빠르게 익혀보세요.</p>
            <Link href="/onboarding" className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              온보딩 시작
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* 이 앱의 정체성: 가장 큰 숫자는 항상 프로세스 점수여야 하며, 계좌
          수익률/평가금액은 여기서 절대 크게 보여주지 않는다 (docs/SPEC.md Phase 10-1). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">이번 주 프로세스 점수</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold">
              {weeklyScore.thisWeek !== null ? weeklyScore.thisWeek.toFixed(0) : "—"}
            </span>
            {scoreDelta !== null ? (
              <span className={`text-sm font-medium ${scoreDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                전주 대비 {scoreDelta >= 0 ? "+" : ""}
                {scoreDelta.toFixed(0)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">전주 데이터 없음</span>
            )}
          </div>
        </CardContent>
      </Card>

      {openPositions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">진행 중 포지션</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openPositions.map((t) => (
              <Link
                key={t.id}
                href={`/journal/${t.id}`}
                className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted"
              >
                <span>{t.ticker ?? t.maskedLabel}</span>
                <span className="text-muted-foreground">
                  진입 {t.entryPrice} / 손절 {t.stopPrice} / 목표 {t.target1Price ?? "—"}
                </span>
              </Link>
            ))}
            <p className="text-xs text-muted-foreground">
              실시간 시세 연동은 준비 중입니다(Phase 10-3 데이터 수집기) — 계획 대비 현재가 위치는 아직 표시하지 않습니다.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {experiment && experiment.total > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">진행 중 AI 실험</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{experiment.rule}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(experiment.compliant / experiment.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{experiment.compliant}/{experiment.total} 거래 준수</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              가장 위험한 편향: {AXIS_LABELS[worstAxis]} ({radar[worstAxis].toFixed(0)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/bias" className="text-sm text-primary underline underline-offset-2">
              전체 편향 레이더 보기 →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">오늘의 복습</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/cards" className="text-sm text-primary underline underline-offset-2">
              {dueCardCount > 0 ? `오늘 복습 ${dueCardCount}장 →` : "오늘 복습할 카드 없음"}
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">최근 5거래</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {recentTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 청산된 거래가 없습니다.</p>
          ) : (
            recentTrades.map((t) => (
              <Link key={t.id} href={`/journal/${t.id}`}>
                <Badge variant={t.quadrant === "skill" ? "default" : t.quadrant === "mistake" ? "destructive" : "secondary"}>
                  {t.ticker ?? t.maskedLabel} · {t.quadrant ? QUADRANT_LABELS[t.quadrant] : "—"}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">바로가기</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              {l.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
