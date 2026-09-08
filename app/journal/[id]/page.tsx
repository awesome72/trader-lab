import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToastOnParam } from "@/components/toast-on-param";
import { db } from "@/lib/db";
import { tradeEvents, trades } from "@/lib/db/schema";
import {
  EMOTION_LABELS,
  EXIT_REASON_LABELS,
  HORIZON_LABELS,
  QUADRANT_LABELS,
  SETUP_LABELS,
  STOP_BASIS_LABELS,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CoachPanel } from "@/app/coach/coach-panel";

function pct(from: number, to: number): string {
  return `${(((to - from) / from) * 100).toFixed(1)}%`;
}

function Row({
  label,
  planned,
  actual,
  mismatch,
}: {
  label: string;
  planned: ReactNode;
  actual: ReactNode;
  mismatch?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-4 rounded-md px-3 py-2 text-sm",
        mismatch && "bg-orange-100 dark:bg-orange-950"
      )}
    >
      <div className="text-muted-foreground">{label}</div>
      <div>{planned}</div>
      <div>{actual}</div>
    </div>
  );
}

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [trade] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.id, id), eq(trades.userId, user.id)));

  if (!trade) {
    notFound();
  }

  const events = await db
    .select()
    .from(tradeEvents)
    .where(eq(tradeEvents.tradeId, id))
    .orderBy(asc(tradeEvents.at));

  const isClosed = trade.status === "closed";
  const breakdown = trade.processBreakdown as Record<string, number> | null;

  const hitTarget =
    isClosed && trade.target1Price !== null && trade.exitPrice !== null
      ? trade.direction === "short"
        ? trade.exitPrice <= trade.target1Price
        : trade.exitPrice >= trade.target1Price
      : null;

  const confidenceMismatch =
    isClosed && trade.realizedR !== null
      ? trade.confidence >= 50 !== trade.realizedR > 0
      : false;

  const invalidationEvent = events.find(
    (e) => e.payload && typeof e.payload === "object" && "invalidationTriggered" in (e.payload as object)
  );
  const invalidationTriggered = invalidationEvent
    ? (invalidationEvent.payload as { invalidationTriggered: string }).invalidationTriggered
    : null;

  const holdingDays =
    isClosed && trade.exitAt && trade.entryAt
      ? (
          (new Date(trade.exitAt).getTime() - new Date(trade.entryAt).getTime()) /
          (1000 * 60 * 60 * 24)
        ).toFixed(1)
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <ToastOnParam
        entries={[
          { param: "created", type: "success", message: "저널이 저장되었습니다 (핵심 필드는 이제 수정할 수 없습니다)" },
          { param: "closed", type: "success", message: "청산이 기록되었습니다" },
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {trade.ticker ?? trade.maskedLabel} · {SETUP_LABELS[trade.setup]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {trade.direction === "short" ? "숏" : "롱"} · {HORIZON_LABELS[trade.horizon]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {trade.quadrant ? (
            <Badge>{QUADRANT_LABELS[trade.quadrant as keyof typeof QUADRANT_LABELS]}</Badge>
          ) : null}
          {!isClosed ? (
            <Button render={<Link href={`/journal/${id}/close`}>청산 기록</Link>} />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>계획 vs 실제</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="grid grid-cols-3 gap-4 px-3 text-xs font-medium text-muted-foreground">
            <div />
            <div>진입 시 계획</div>
            <div>실제 결과</div>
          </div>
          <Row
            label="목표가"
            planned={
              trade.target1Price
                ? `${trade.target1Price.toLocaleString()} (${pct(trade.entryPrice ?? trade.target1Price, trade.target1Price)})`
                : "—"
            }
            actual={
              isClosed && trade.exitPrice
                ? `${trade.exitPrice.toLocaleString()} (${pct(trade.entryPrice ?? trade.exitPrice, trade.exitPrice)})`
                : "보유 중"
            }
            mismatch={isClosed && trade.target1Price !== null && hitTarget === false}
          />
          <Row
            label="손절가"
            planned={trade.stopPrice.toLocaleString()}
            actual={isClosed && trade.maeR !== null ? `MAE ${trade.maeR.toFixed(2)}R` : "보유 중"}
            mismatch={isClosed && trade.maeR !== null && trade.maeR <= -1}
          />
          <Row
            label="확신도"
            planned={`${trade.confidence}%`}
            actual={
              isClosed
                ? hitTarget
                  ? "적중"
                  : trade.realizedR !== null && trade.realizedR > 0
                    ? "부분 적중"
                    : "미적중"
                : "보유 중"
            }
            mismatch={confidenceMismatch}
          />
          <Row
            label="예상 / 실현 R"
            planned={trade.plannedRMultiple !== null ? `${trade.plannedRMultiple.toFixed(2)}R` : "—"}
            actual={isClosed && trade.realizedR !== null ? `${trade.realizedR.toFixed(2)}R` : "보유 중"}
          />
          <Row
            label="무효화 조건"
            planned={trade.invalidation}
            actual={
              invalidationTriggered === "yes"
                ? "발동함"
                : invalidationTriggered === "no"
                  ? "미발동"
                  : isClosed
                    ? "모르겠음"
                    : "보유 중"
            }
            mismatch={invalidationTriggered === "yes"}
          />
          <Row
            label="보유 예상 / 실제"
            planned={HORIZON_LABELS[trade.horizon]}
            actual={isClosed ? `${holdingDays}일` : "보유 중"}
            mismatch={isClosed && breakdown?.horizonRespect === 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>저널</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-medium">논거: </span>
            {trade.thesis}
          </p>
          <p>
            <span className="font-medium">손절 근거: </span>
            {STOP_BASIS_LABELS[trade.stopBasis]}
          </p>
          {trade.emotionTags && trade.emotionTags.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="font-medium">감정 태그:</span>
              {trade.emotionTags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {EMOTION_LABELS[tag] ?? tag}
                </Badge>
              ))}
            </div>
          ) : null}
          {isClosed && trade.exitReason ? (
            <p>
              <span className="font-medium">청산 사유: </span>
              {EXIT_REASON_LABELS[trade.exitReason as keyof typeof EXIT_REASON_LABELS] ?? trade.exitReason}
            </p>
          ) : null}
          {trade.processScore !== null ? (
            <p>
              <span className="font-medium">프로세스 점수: </span>
              {trade.processScore} / 100
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>타임라인</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {events.length === 0 ? (
            <p className="text-muted-foreground">기록된 이벤트가 없습니다.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="flex gap-3 border-b pb-2 last:border-0">
                <span className="w-40 shrink-0 text-muted-foreground">
                  {e.at ? new Date(e.at).toLocaleString("ko-KR") : ""}
                </span>
                <span>{e.note ?? e.kind}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI 코치</CardTitle>
        </CardHeader>
        <CardContent>
          <CoachPanel
            kind={isClosed ? "postmortem" : "premortem"}
            tradeId={id}
            triggerLabel={isClosed ? "AI 포스트모템 요청" : "AI 프리모템 요청"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
