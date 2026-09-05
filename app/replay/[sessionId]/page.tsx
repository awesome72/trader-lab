import { notFound, redirect } from "next/navigation";
import {
  getOpenPositionForSession,
  getRevealSummary,
  getReplaySessionForUser,
  getRevealedBars,
} from "@/lib/queries/replay";
import { createClient } from "@/lib/supabase/server";
import { ReplayClient } from "./replay-client";
import { RevealView } from "./reveal-view";

export default async function ReplaySessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const session = await getReplaySessionForUser(sessionId, user.id);
  if (!session) {
    notFound();
  }

  if (session.revealed) {
    const summary = await getRevealSummary(sessionId, user.id);
    if ("error" in summary) {
      notFound();
    }
    return <RevealView result={summary} sessionId={sessionId} />;
  }

  const [bars, openPosition] = await Promise.all([
    getRevealedBars(session),
    getOpenPositionForSession(sessionId, user.id),
  ]);

  const position = openPosition
    ? {
        entryPrice: openPosition.entryPrice as number,
        stopPrice: openPosition.stopPrice,
        target1Price: openPosition.target1Price,
        direction: openPosition.direction,
        quantity: openPosition.quantity,
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">리플레이 진행 중</h1>
      <ReplayClient
        sessionId={sessionId}
        level={session.level}
        initialBars={bars}
        initialPosition={position}
      />
    </div>
  );
}
