"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  dbProfileToDomain,
  dbTradeEventToDomain,
  dbTradeToDomain,
} from "@/lib/db/mappers";
import { profiles, tradeEvents, trades } from "@/lib/db/schema";
import { applyCosts, calcRealizedR } from "@/lib/domain/r-multiple";
import { calcProcessScore, calcQuadrant } from "@/lib/domain/process-score";
import { createClient } from "@/lib/supabase/server";
import {
  journalCloseSchema,
  type JournalCloseInput,
} from "@/lib/validation/journal";

export async function closeTrade(
  tradeId: string,
  input: JournalCloseInput
): Promise<{ ok: false; error: string } | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = journalCloseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.",
    };
  }
  const values = parsed.data;

  const [tradeRow] = await db
    .select()
    .from(trades)
    .where(and(eq(trades.id, tradeId), eq(trades.userId, user.id)));

  if (!tradeRow) {
    return { ok: false, error: "거래를 찾을 수 없습니다." };
  }
  if (tradeRow.status === "closed") {
    return { ok: false, error: "이미 청산된 거래입니다." };
  }
  if (tradeRow.entryPrice === null) {
    return { ok: false, error: "진입가가 없는 거래는 청산할 수 없습니다." };
  }

  const [settings] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));

  const direction = tradeRow.direction === "short" ? "short" : "long";
  const worstPrice = direction === "long" ? values.lowestPrice : values.highestPrice;
  const bestPrice = direction === "long" ? values.highestPrice : values.lowestPrice;

  const grossR = calcRealizedR(
    tradeRow.entryPrice,
    tradeRow.stopPrice,
    values.exitPrice,
    direction
  );
  const maeR = calcRealizedR(tradeRow.entryPrice, tradeRow.stopPrice, worstPrice, direction);
  const mfeR = calcRealizedR(tradeRow.entryPrice, tradeRow.stopPrice, bestPrice, direction);

  if (grossR === null) {
    return { ok: false, error: "손절가와 진입가가 같아 R을 계산할 수 없습니다." };
  }

  const netR = settings
    ? (applyCosts(
        grossR,
        tradeRow.entryPrice,
        tradeRow.stopPrice,
        settings.feeBps,
        settings.taxBps,
        settings.slippageBps
      ) ?? grossR)
    : grossR;

  const actualRiskAmount =
    (tradeRow.quantity ?? 0) * Math.abs(tradeRow.entryPrice - tradeRow.stopPrice);
  const realizedPnl = netR * actualRiskAmount;

  const exitAt = new Date(values.exitAt);

  const events = (
    await db.select().from(tradeEvents).where(eq(tradeEvents.tradeId, tradeId))
  ).map(dbTradeEventToDomain);

  const domainTrade = dbTradeToDomain({
    ...tradeRow,
    exitAt,
    exitPrice: values.exitPrice,
    exitReason: values.exitReason,
    maeR,
    mfeR,
  });

  const profileSettings = settings
    ? dbProfileToDomain(settings)
    : {
        id: user.id,
        displayName: null,
        accountSize: 10_000_000,
        defaultRiskPct: 1,
        maxRiskPct: 2,
        feeBps: 1.5,
        taxBps: 15,
        slippageBps: 10,
        createdAt: new Date().toISOString(),
      };

  const scoreResult = calcProcessScore(domainTrade, events, profileSettings);
  const quadrant = calcQuadrant(scoreResult.total, netR);

  await db
    .update(trades)
    .set({
      status: "closed",
      exitAt,
      exitPrice: values.exitPrice,
      exitReason: values.exitReason,
      realizedR: netR,
      realizedPnl,
      maeR,
      mfeR,
      processScore: scoreResult.total,
      processBreakdown: scoreResult.breakdown,
      quadrant,
    })
    .where(and(eq(trades.id, tradeId), eq(trades.userId, user.id)));

  await db.insert(tradeEvents).values({
    tradeId,
    kind: "note",
    note: `무효화 조건 발동 여부: ${
      values.invalidationTriggered === "yes"
        ? "발동함"
        : values.invalidationTriggered === "no"
          ? "발동 안 함"
          : "모르겠음"
    }`,
    payload: { invalidationTriggered: values.invalidationTriggered },
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${tradeId}`);
  redirect(`/journal/${tradeId}?closed=1`);
}
