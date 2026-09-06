import { redirect } from "next/navigation";
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
      <p className="text-sm text-muted-foreground">
        과거의 실제 가격 흐름을 종목명과 날짜 없이 한 봉씩 재생합니다. 매수
        시 저널 작성이 강제되며, 종목명과 기간은 세션을 종료해야 공개됩니다.
      </p>
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 sm:hidden">
        리플레이 화면은 차트와 컨트롤 패널이 넓은 화면에 최적화되어 있습니다.
        데스크톱 또는 태블릿 가로모드에서 이용해주세요.
      </p>
      <NewSessionForm />
    </div>
  );
}
