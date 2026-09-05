import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { CloseForm } from "./close-form";

export default async function CloseTradePage({
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
  if (trade.status === "closed") {
    redirect(`/journal/${id}`);
  }
  if (trade.entryPrice === null) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-2xl font-semibold">청산 기록 — {trade.ticker}</h1>
      <CloseForm tradeId={id} entryPrice={trade.entryPrice} />
    </div>
  );
}
