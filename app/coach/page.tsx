import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOngoingExperiment } from "@/lib/queries/coach";
import { createClient } from "@/lib/supabase/server";
import { CoachPanel } from "./coach-panel";

export default async function CoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const experiment = await getOngoingExperiment(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">AI 소크라테스 코치</h1>
        <p className="text-sm text-muted-foreground">
          답을 주지 않고 질문을 던집니다. 종목 추천이나 시황 판단은 하지
          않습니다 — 판단은 당신의 몫입니다.
        </p>
      </div>

      {experiment ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">진행 중인 실험</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>실험: {experiment.rule}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${experiment.total > 0 ? (experiment.compliant / experiment.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-muted-foreground">
              {experiment.compliant}/{experiment.total || 10} 거래 준수
              {experiment.total === 0 ? " (아직 청산된 거래 없음)" : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>주간 리뷰</CardTitle>
        </CardHeader>
        <CardContent>
          <CoachPanel kind="weekly" triggerLabel="이번 주 리뷰 요청" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>월간 리뷰</CardTitle>
        </CardHeader>
        <CardContent>
          <CoachPanel kind="monthly" triggerLabel="이번 달 리뷰 요청" />
        </CardContent>
      </Card>
    </div>
  );
}
