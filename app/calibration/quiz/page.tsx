import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizClient } from "./quiz-client";

export default async function CalibrationQuizPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">주간 예측 퀴즈</h1>
      <QuizClient />
    </div>
  );
}
