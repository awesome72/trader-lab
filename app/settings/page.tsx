import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToastOnParam } from "@/components/toast-on-param";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/login/actions";
import { updateSettings } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <ToastOnParam
        entries={[
          { param: "saved", type: "success", message: "저장되었습니다" },
          { param: "error", type: "error" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>계좌 & 리스크 설정</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountSize">계좌 규모 (원)</Label>
              <Input
                id="accountSize"
                name="accountSize"
                type="number"
                min={0}
                step="1"
                defaultValue={profile?.accountSize ?? 10_000_000}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultRiskPct">기본 리스크 %</Label>
                <Input
                  id="defaultRiskPct"
                  name="defaultRiskPct"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={profile?.defaultRiskPct ?? 1}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxRiskPct">최대 리스크 %</Label>
                <Input
                  id="maxRiskPct"
                  name="maxRiskPct"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={profile?.maxRiskPct ?? 2}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feeBps">수수료 (bp)</Label>
                <Input
                  id="feeBps"
                  name="feeBps"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={profile?.feeBps ?? 1.5}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxBps">세금 (bp)</Label>
                <Input
                  id="taxBps"
                  name="taxBps"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={profile?.taxBps ?? 15}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slippageBps">슬리피지 (bp)</Label>
                <Input
                  id="slippageBps"
                  name="slippageBps"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={profile?.slippageBps ?? 10}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="weeklyDigestEnabled"
                name="weeklyDigestEnabled"
                type="checkbox"
                defaultChecked={profile?.weeklyDigestEnabled ?? true}
                className="h-4 w-4"
              />
              <Label htmlFor="weeklyDigestEnabled" className="font-normal">
                주간 요약 이메일 받기 (이번 주 프로세스 점수, 복습 대기 카드 수 등)
              </Label>
            </div>

            <Button type="submit" className="w-full">
              저장
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">내 데이터</CardTitle>
          <CardDescription>저널, 거래, 캘리브레이션, 드릴, 복습 카드 등 모든 데이터를 JSON으로 내려받습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" render={<a href="/api/export" />} className="w-full">
            전체 데이터 내보내기 (JSON)
          </Button>
          <Button variant="outline" render={<a href="/api/export/csv" />} className="w-full">
            거래 내역만 내보내기 (CSV, 엑셀/구글시트용)
          </Button>
        </CardContent>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          로그아웃
        </Button>
      </form>
    </div>
  );
}
