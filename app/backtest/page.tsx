import { redirect } from "next/navigation";
import { PageGuide } from "@/components/page-guide";
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
      <PageGuide>
        <p>
          &quot;20일 이동평균선을 넘으면 사고, -2%가 되면 판다&quot; 같은
          매매 규칙을 코드를 몰라도 조합해서, 실제 과거 시세에 그 규칙을
          그대로 적용해보는 화면입니다. &quot;이 방법이 정말 통했을까?&quot;를
          감이 아니라 숫자로 확인할 수 있습니다.
        </p>
        <p>
          결과는 항상 두 구간으로 나눠 보여줍니다 — 규칙을{" "}
          <b>만드는 데 쓴 기간(In-sample)</b>과{" "}
          <b>검증용으로 떼어둔 기간(Out-of-sample)</b>. 뒤 구간에서 성과가
          갑자기 뚝 떨어지면, 그 규칙이 진짜 통하는 게 아니라 과거 데이터에만
          억지로 끼워맞춘 것일 가능성이 큽니다(과최적화).
        </p>
      </PageGuide>
      <RuleBuilder />
    </div>
  );
}
