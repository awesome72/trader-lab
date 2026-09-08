import { redirect } from "next/navigation";
import { PageGuide } from "@/components/page-guide";
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

      <PageGuide>
        <p>
          &quot;소크라테스 코치&quot;라는 이름처럼, 답을 알려주는 대신 스스로
          생각하게 만드는 질문을 던집니다. 저널 상세 화면에서는 진입 직후
          (&quot;프리모템&quot;)나 청산 후(&quot;포스트모템&quot;)에 요청할
          수 있고, 이 화면에서는 이번 주·이번 달 전체 흐름을 되짚어봅니다.
        </p>
        <p>
          매번 &quot;다음 10거래 중 이렇게 해보자&quot;는 검증 가능한 실험을
          하나씩 제안하는데, 그 실험을 실제로 얼마나 지켰는지가 아래
          &quot;준수율&quot;로 표시됩니다.
        </p>
      </PageGuide>

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
