import Link from "next/link";
import { redirect } from "next/navigation";
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
      <DrillClient cards={cards} />
    </div>
  );
}
