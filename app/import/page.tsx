import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">증권사 거래내역 임포트</h1>
        <p className="text-sm text-muted-foreground">
          CSV 파일을 업로드하고 컬럼을 매핑하면 과거 거래를 저널에
          가져옵니다. 사전 계획이 없는 거래이므로 프로세스 점수는 매기지
          않습니다.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
