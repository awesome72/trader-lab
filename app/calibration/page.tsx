import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  brierScore,
  bucketize,
  calcBrierTrend,
  calibrationError,
  COIN_FLIP_BRIER_SCORE,
  diagnoseCalibration,
  hasCalibrationBadge,
} from "@/lib/domain/calibration";
import { getQuizCalibrationRecords, getTradeCalibrationRecords } from "@/lib/queries/calibration";
import { createClient } from "@/lib/supabase/server";
import { BrierTrendChart, CalibrationCurveChart } from "./charts";

const DIAGNOSIS_TEXT: Record<string, string> = {
  overconfident: "과신 — 고확신 구간에서 선언한 만큼 맞히지 못하고 있습니다.",
  underconfident: "과소신뢰 — 실제로는 더 잘 맞히면서 확신도를 낮게 부르고 있습니다.",
  well_calibrated: "양호한 캘리브레이션입니다.",
};

export default async function CalibrationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [tradeRecords, quizRecords] = await Promise.all([
    getTradeCalibrationRecords(user.id),
    getQuizCalibrationRecords(user.id),
  ]);
  const allRecords = [...tradeRecords, ...quizRecords];

  const buckets = bucketize(allRecords, 10);
  const brier = brierScore(allRecords);
  const ece = calibrationError(allRecords);
  const diagnosis = diagnoseCalibration(buckets);
  const trend = calcBrierTrend(allRecords, 10);
  const badge = hasCalibrationBadge(allRecords);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">캘리브레이션 트레이너</h1>
          <p className="text-sm text-muted-foreground">
            &ldquo;확신도&rdquo;가 실제로 얼마나 맞는지 측정합니다. 종목 판단이
            아니라 자기 판단의 신뢰도를 훈련하는 도구입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {badge ? <Badge>Brier &lt; 0.18 배지</Badge> : null}
          <Button render={<Link href="/calibration/quiz" />}>주간 예측 퀴즈</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">Brier Score</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {brier !== null ? brier.toFixed(3) : "—"}
            <div className="text-xs font-normal text-muted-foreground">동전던지기 {COIN_FLIP_BRIER_SCORE}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">ECE</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{ece !== null ? ece.toFixed(3) : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal text-muted-foreground">표본</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{allRecords.filter((r) => r.outcome !== null).length}건</CardContent>
        </Card>
      </div>

      {diagnosis ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            diagnosis === "overconfident"
              ? "border-red-300 bg-red-50 text-red-700"
              : diagnosis === "underconfident"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
          }`}
        >
          {DIAGNOSIS_TEXT[diagnosis]}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>캘리브레이션 곡선</CardTitle>
        </CardHeader>
        <CardContent>
          <CalibrationCurveChart buckets={buckets} />
          <p className="mt-1 text-xs text-muted-foreground">점선(y=x)에 가까울수록 좋습니다. 점 크기는 표본 수입니다.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brier Score 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <BrierTrendChart trend={trend} />
        </CardContent>
      </Card>
    </div>
  );
}
