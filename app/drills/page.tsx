import Link from "next/link";
import { redirect } from "next/navigation";
import { PageGuide } from "@/components/page-guide";
import { Button } from "@/components/ui/button";
import { getDueDrillCards } from "@/lib/queries/drills";
import { createClient } from "@/lib/supabase/server";
import { DrillClient } from "./drill-client";

export default async function DrillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const cards = await getDueDrillCards(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">시나리오 드릴</h1>
          <p className="text-sm text-muted-foreground">
            정답/오답이 아니라 &ldquo;당신이 선언한 규칙과 일관된 선택인가&rdquo;를 채점합니다.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/drills/consistency" />}>
          일관성 보기
        </Button>
      </div>
      <PageGuide>
        <p>
          &quot;손절 직전에 반등할 것 같은데 손절가에 왔다&quot; 같은 실전
          상황을 보여주고 어떻게 대응할지 고르게 합니다. 채점은 &quot;정답을
          맞혔는가&quot;가 아니라 <b>&quot;스스로 미리 정해둔 규칙과 일관된
          선택을 했는가&quot;</b>입니다 — 실전에서는 규칙을 아는 것과 그
          순간에 실제로 지키는 것 사이에 큰 차이가 있기 때문입니다.
        </p>
        <p>
          같은 상황이 90일 뒤에 다시 나오는데, 그때와 지금의 판단이 얼마나
          일관됐는지는 &quot;일관성 보기&quot;에서 확인할 수 있습니다.
        </p>
      </PageGuide>
      <DrillClient cards={cards} />
    </div>
  );
}
