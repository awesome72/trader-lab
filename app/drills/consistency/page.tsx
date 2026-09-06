import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDrillConsistencyHistory } from "@/lib/queries/drills";
import { createClient } from "@/lib/supabase/server";

export default async function DrillConsistencyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const entries = await getDrillConsistencyHistory(user.id);
  const avgConsistency =
    entries.length > 0
      ? entries.reduce((s, e) => s + (e.consistencyScore ?? 0), 0) / entries.length
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">판단의 일관성</h1>
        <p className="text-sm text-muted-foreground">
          같은 시나리오를 90일 뒤 다시 풀었을 때, 당신의 판단이 얼마나
          안정적이었는지 보여줍니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">평균 일관성</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">
          {avgConsistency !== null ? `${avgConsistency.toFixed(0)}/100` : "재출제된 카드가 아직 없습니다."}
        </CardContent>
      </Card>

      {entries.map((e) => (
        <Card key={e.card.id}>
          <CardHeader>
            <CardTitle className="text-sm">{e.card.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              {e.firstAnsweredAt.slice(0, 10)}: {e.firstChoice}번 선택 →{" "}
              {e.latestAnsweredAt.slice(0, 10)}: {e.latestChoice}번 선택
            </p>
            <p className={e.consistencyScore !== null && e.consistencyScore < 60 ? "text-amber-600" : "text-emerald-600"}>
              일관성 {e.consistencyScore?.toFixed(0) ?? "—"}/100
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
