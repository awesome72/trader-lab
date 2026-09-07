import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getOnboardingStatus, getOnboardingStep, hasStartedReplaySession } from "@/lib/queries/onboarding";
import { createClient } from "@/lib/supabase/server";
import { advanceOnboardingStep, saveOnboardingStep1 } from "./actions";
import { RMultipleDemo } from "./r-multiple-demo";
import { OnboardingQuiz } from "./onboarding-quiz";

const TOTAL_STEPS = 5;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const { step: stepParam, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const status = await getOnboardingStatus(user.id);
  if (status.completed) {
    redirect("/");
  }

  // An explicit ?step= always wins (lets a trader jump back manually); a
  // bare "/onboarding" visit (e.g. the home banner) resumes the last step
  // they reached instead of restarting at step 1.
  const step = stepParam
    ? Math.min(TOTAL_STEPS, Math.max(1, Number(stepParam) || 1))
    : await getOnboardingStep(user.id);

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  const hasReplay = step === 4 ? await hasStartedReplaySession(user.id) : false;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <p className="text-sm text-muted-foreground">온보딩 {step} / {TOTAL_STEPS}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>계좌 규모 · 리스크 설정</CardTitle>
            <CardDescription>모든 R 계산과 사이징의 기준이 됩니다. 나중에 설정에서 언제든 바꿀 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveOnboardingStep1} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountSize">계좌 규모 (원)</Label>
                <Input id="accountSize" name="accountSize" type="number" min={0} defaultValue={profile?.accountSize ?? 10_000_000} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultRiskPct">기본 리스크 %</Label>
                  <Input id="defaultRiskPct" name="defaultRiskPct" type="number" step="0.1" min={0} defaultValue={profile?.defaultRiskPct ?? 1} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRiskPct">최대 리스크 %</Label>
                  <Input id="maxRiskPct" name="maxRiskPct" type="number" step="0.1" min={0} defaultValue={profile?.maxRiskPct ?? 2} required />
                </div>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full">다음</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>R-multiple이란?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RMultipleDemo />
            <form action={advanceOnboardingStep.bind(null, 3)}>
              <Button type="submit" className="w-full">다음</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>첫 저널 작성 튜토리얼</CardTitle>
            <CardDescription>모든 거래는 진입 전에 계획을 선언하는 것에서 시작합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2 rounded-md border bg-muted p-3">
              <p><span className="font-medium">논거: </span>&ldquo;종가가 20일 이동평균선을 돌파했고 거래량이 평균 대비 크게 증가했습니다.&rdquo; (샘플)</p>
              <p><span className="font-medium">무효화 조건: </span>&ldquo;종가가 20일 이동평균선 아래로 마감하면 무효화됩니다.&rdquo; (샘플)</p>
              <p><span className="font-medium">손절가·목표가·확신도</span>도 함께 미리 선언합니다.</p>
            </div>
            <p className="text-muted-foreground">
              이렇게 진입 전에 적어둔 계획은 청산 후 실제 행동과 자동으로
              대조되어, 계획과 실제의 불일치를 스스로 발견하게 해줍니다.
            </p>
            <Button variant="outline" render={<Link href="/journal/new" target="_blank" />} className="w-full">
              저널 작성해보기 (새 탭)
            </Button>
            <form action={advanceOnboardingStep.bind(null, 4)}>
              <Button type="submit" className="w-full">다음</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>블라인드 바 리플레이 체험</CardTitle>
            <CardDescription>종목명·날짜 없이 과거 시세를 한 봉씩 재생하며 매매 규율을 훈련합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              레벨 1(캔들만)로 세션을 최소 1회 진행해보세요. 매수 시 저널
              작성이 강제되고, 종목명은 세션을 종료해야 공개됩니다.
            </p>
            <Button variant="outline" render={<Link href="/replay" target="_blank" />} className="w-full">
              리플레이 시작하기 (새 탭)
            </Button>
            {hasReplay ? (
              <>
                <p className="text-sm text-emerald-600">세션을 시작한 기록이 확인되었습니다.</p>
                <form action={advanceOnboardingStep.bind(null, 5)}>
                  <Button type="submit" className="w-full">다음</Button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-amber-600">아직 세션을 시작하지 않았습니다. 위 버튼으로 진행한 뒤 새로고침해주세요.</p>
                <Button className="w-full" disabled>
                  다음
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 5 ? <OnboardingQuiz /> : null}
    </div>
  );
}
