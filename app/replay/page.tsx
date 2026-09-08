import { redirect } from "next/navigation";
import { PageGuide } from "@/components/page-guide";
import { createClient } from "@/lib/supabase/server";
import { NewSessionForm } from "./new-session-form";

export default async function ReplayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">블라인드 바 리플레이</h1>
      <PageGuide>
        <p>
          실제로 과거에 있었던 주가 흐름을 <b>종목명과 날짜를 가린 채</b>{" "}
          하루하루 재생해서 보여줍니다. &quot;이 종목은 삼성전자니까 오를
          거야&quot; 같은 선입견 없이, 오직 눈앞의 차트와 자신이 세운 규칙만
          보고 판단하는 연습을 하기 위해서입니다.
        </p>
        <p>
          매수 버튼을 누르면 실제 매매처럼 논거·손절가를 미리 적어야 하고,
          어떤 종목이었는지는 세션을 끝까지 마쳐야 공개됩니다.
        </p>
      </PageGuide>
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 sm:hidden">
        리플레이 화면은 차트와 컨트롤 패널이 넓은 화면에 최적화되어 있습니다.
        데스크톱 또는 태블릿 가로모드에서 이용해주세요.
      </p>
      <NewSessionForm />
    </div>
  );
}
