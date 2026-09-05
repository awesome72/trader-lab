import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RuleBuilder } from "./rule-builder";

export default async function BacktestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">노코드 룰 백테스터</h1>
        <p className="text-sm text-muted-foreground">
          조건을 코드 없이 조합해 과거 데이터에 적용합니다. 신호는 종가에서
          판정하고, 체결은 항상 다음 봉 시가로 처리합니다(미래 정보 사용 금지).
        </p>
      </div>
      <RuleBuilder />
    </div>
  );
}
