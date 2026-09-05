import type { Trade, TradeEvent } from "./types";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

export interface DispositionEffectResult {
  pgr: number;
  plr: number;
  index: number;
}

/**
 * Disposition effect via PGR (Proportion of Gains Realized) / PLR
 * (Proportion of Losses Realized), using mfeR/maeR as a proxy for "had an
 * unrealized gain/loss opportunity" since we don't have a live daily
 * unrealized-P&L feed for open positions here.
 */
export function calcDispositionEffect(trades: Trade[]): DispositionEffectResult {
  const withExcursions = trades.filter(
    (t) => t.realizedR !== null && t.mfeR !== null && t.maeR !== null
  );

  const gainOpportunities = withExcursions.filter((t) => (t.mfeR as number) > 0);
  const realizedGains = gainOpportunities.filter((t) => (t.realizedR as number) > 0);
  const lossOpportunities = withExcursions.filter((t) => (t.maeR as number) < 0);
  const realizedLosses = lossOpportunities.filter((t) => (t.realizedR as number) < 0);

  const pgr =
    gainOpportunities.length > 0
      ? realizedGains.length / gainOpportunities.length
      : 0;
  const plr =
    lossOpportunities.length > 0
      ? realizedLosses.length / lossOpportunities.length
      : 0;

  return { pgr, plr, index: pgr - plr };
}

export function calcRevengeTradingRate(
  trades: Trade[],
  windowMinutes = 60
): number {
  const closed = trades
    .filter((t) => t.entryAt !== null && t.exitAt !== null)
    .sort((a, b) => (a.entryAt as string).localeCompare(b.entryAt as string));

  if (closed.length < 2) return 0;

  let eligible = 0;
  let revenge = 0;

  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1];
    const curr = closed[i];
    eligible += 1;
    const gapMinutes =
      (new Date(curr.entryAt as string).getTime() -
        new Date(prev.exitAt as string).getTime()) /
      MS_PER_MINUTE;
    if (
      (prev.realizedR ?? 0) < 0 &&
      gapMinutes >= 0 &&
      gapMinutes <= windowMinutes
    ) {
      revenge += 1;
    }
  }

  return eligible > 0 ? revenge / eligible : 0;
}

export function calcOvertradingSlope(trades: Trade[]): number {
  const closed = trades.filter(
    (t) => t.realizedR !== null && (t.entryAt !== null || t.exitAt !== null)
  );

  const byMonth = new Map<string, { count: number; sumR: number }>();
  for (const t of closed) {
    const dateStr = (t.entryAt ?? t.exitAt) as string;
    const month = dateStr.slice(0, 7); // YYYY-MM
    const bucket = byMonth.get(month) ?? { count: 0, sumR: 0 };
    bucket.count += 1;
    bucket.sumR += t.realizedR as number;
    byMonth.set(month, bucket);
  }

  const points = Array.from(byMonth.values());
  const n = points.length;
  if (n < 2) return 0;

  const xs = points.map((p) => p.count);
  const ys = points.map((p) => p.sumR);
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = ys.reduce((s, v) => s + v, 0) / n;

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (xs[i] - xMean) * (ys[i] - yMean);
    variance += (xs[i] - xMean) ** 2;
  }

  return variance > 0 ? covariance / variance : 0;
}

function isLosingAdd(trade: Trade, event: TradeEvent): boolean {
  if (event.kind !== "add_position" || event.tradeId !== trade.id) return false;
  const price = event.payload?.price;
  if (typeof price !== "number" || trade.entryPrice === null) return false;
  return trade.direction === "long"
    ? price < trade.entryPrice
    : price > trade.entryPrice;
}

export function calcAveragingDownRate(
  trades: Trade[],
  events: TradeEvent[]
): number {
  if (trades.length === 0) return 0;
  const withAveragingDown = trades.filter((t) =>
    events.some((e) => isLosingAdd(t, e))
  );
  return withAveragingDown.length / trades.length;
}

/**
 * Average hours "overheld" past a stop breach. We don't have a bar-by-bar
 * feed here, so maeR <= -1 (price moved at least 1R against the plan) is
 * used as the breach signal, and the full holding duration of trades that
 * breached but weren't exited via 'stop' is used as the delay proxy.
 */
export function calcStopDelayHours(
  trades: Trade[],
  events: TradeEvent[]
): number {
  void events; // reserved for future use once bar-level breach timestamps exist
  const delayed = trades.filter(
    (t) =>
      t.maeR !== null &&
      t.maeR <= -1 &&
      t.exitReason !== "stop" &&
      t.entryAt !== null &&
      t.exitAt !== null
  );

  if (delayed.length === 0) return 0;

  const totalHours = delayed.reduce((sum, t) => {
    const hours =
      (new Date(t.exitAt as string).getTime() -
        new Date(t.entryAt as string).getTime()) /
      MS_PER_HOUR;
    return sum + hours;
  }, 0);

  return totalHours / delayed.length;
}

export interface FomoPriceContext {
  tradeId: string;
  dayChangePctAtEntry: number; // e.g. +5.2 means +5.2% before entry that day
}

export interface FomoStatsResult {
  rate: number;
  winRate: number;
  avgR: number;
}

export function calcFomoStats(
  trades: Trade[],
  priceContext: FomoPriceContext[]
): FomoStatsResult {
  if (trades.length === 0) return { rate: 0, winRate: 0, avgR: 0 };

  const contextByTradeId = new Map(
    priceContext.map((c) => [c.tradeId, c.dayChangePctAtEntry])
  );

  const fomoTrades = trades.filter((t) => {
    const change = contextByTradeId.get(t.id);
    return change !== undefined && change >= 5;
  });

  const rate = fomoTrades.length / trades.length;

  const closedFomo = fomoTrades.filter((t) => t.realizedR !== null);
  const winRate =
    closedFomo.length > 0
      ? closedFomo.filter((t) => (t.realizedR as number) > 0).length /
        closedFomo.length
      : 0;
  const avgR =
    closedFomo.length > 0
      ? closedFomo.reduce((s, t) => s + (t.realizedR as number), 0) /
        closedFomo.length
      : 0;

  return { rate, winRate, avgR };
}

export interface BiasEvidence {
  trades: Trade[];
  // Always <= 0: R actually forfeited/lost to this bias, across all axes.
  estimatedLossR: number;
}

/**
 * Trades where a real gain opportunity (mfeR) was given back before exit, or
 * a real loss opportunity (maeR <= -1) was held to worse than a disciplined
 * -1R stop-out — the two disposition-effect failure modes. estimatedLossR
 * sums the R actually forfeited in each case (as a negative number).
 */
export function findDispositionEvidence(trades: Trade[]): BiasEvidence {
  const flagged = trades.filter((t) => {
    if (t.realizedR === null) return false;
    const gainGivenBack = t.mfeR !== null && t.mfeR - t.realizedR >= 1;
    const lossHeldPastStop = t.maeR !== null && t.maeR <= -1 && t.realizedR < -1;
    return gainGivenBack || lossHeldPastStop;
  });

  const estimatedLossR = flagged.reduce((sum, t) => {
    const realizedR = t.realizedR as number;
    const gainGap = t.mfeR !== null ? Math.max(0, t.mfeR - realizedR) : 0;
    const lossGap =
      t.maeR !== null && t.maeR <= -1 && realizedR < -1 ? Math.abs(realizedR - -1) : 0;
    return sum - (gainGap + lossGap);
  }, 0);

  return { trades: flagged, estimatedLossR };
}

export function findRevengeTradingEvidence(
  trades: Trade[],
  windowMinutes = 60
): BiasEvidence {
  const closed = trades
    .filter((t) => t.entryAt !== null && t.exitAt !== null)
    .sort((a, b) => (a.entryAt as string).localeCompare(b.entryAt as string));

  const flagged: Trade[] = [];
  for (let i = 1; i < closed.length; i++) {
    const prev = closed[i - 1];
    const curr = closed[i];
    const gapMinutes =
      (new Date(curr.entryAt as string).getTime() -
        new Date(prev.exitAt as string).getTime()) /
      MS_PER_MINUTE;
    if ((prev.realizedR ?? 0) < 0 && gapMinutes >= 0 && gapMinutes <= windowMinutes) {
      flagged.push(curr);
    }
  }

  const estimatedLossR = flagged.reduce(
    (sum, t) => sum + Math.min(0, t.realizedR ?? 0),
    0
  );
  return { trades: flagged, estimatedLossR };
}

/**
 * Flags trades in any calendar month where trade count was at/above the
 * trader's own median monthly count AND that month's total R was negative —
 * i.e. months where trading more coincided with losing more.
 */
export function findOvertradingEvidence(trades: Trade[]): BiasEvidence {
  const closed = trades.filter((t) => t.realizedR !== null && (t.entryAt ?? t.exitAt));

  const byMonth = new Map<string, Trade[]>();
  for (const t of closed) {
    const month = (t.entryAt ?? t.exitAt) as string;
    const key = month.slice(0, 7);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(t);
    byMonth.set(key, bucket);
  }

  const counts = Array.from(byMonth.values())
    .map((bucket) => bucket.length)
    .sort((a, b) => a - b);
  const medianCount =
    counts.length > 0 ? counts[Math.floor((counts.length - 1) / 2)] : 0;

  const flagged: Trade[] = [];
  for (const bucket of byMonth.values()) {
    const sumR = bucket.reduce((s, t) => s + (t.realizedR as number), 0);
    if (bucket.length >= medianCount && sumR < 0) {
      flagged.push(...bucket);
    }
  }

  const estimatedLossR = flagged.reduce(
    (sum, t) => sum + Math.min(0, t.realizedR ?? 0),
    0
  );
  return { trades: flagged, estimatedLossR };
}

export function findAveragingDownEvidence(
  trades: Trade[],
  events: TradeEvent[]
): BiasEvidence {
  const flagged = trades.filter((t) => events.some((e) => isLosingAdd(t, e)));
  const estimatedLossR = flagged.reduce(
    (sum, t) => sum + Math.min(0, (t.realizedR as number) - -1),
    0
  );
  return { trades: flagged, estimatedLossR };
}

export function findStopDelayEvidence(
  trades: Trade[],
  events: TradeEvent[]
): BiasEvidence {
  void events;
  const flagged = trades.filter(
    (t) =>
      t.maeR !== null &&
      t.maeR <= -1 &&
      t.exitReason !== "stop" &&
      t.realizedR !== null
  );
  const estimatedLossR = flagged.reduce(
    (sum, t) => sum + Math.min(0, (t.realizedR as number) - -1),
    0
  );
  return { trades: flagged, estimatedLossR };
}

export function findFomoEvidence(
  trades: Trade[],
  priceContext: FomoPriceContext[]
): BiasEvidence {
  const contextByTradeId = new Map(
    priceContext.map((c) => [c.tradeId, c.dayChangePctAtEntry])
  );
  const flagged = trades.filter((t) => (contextByTradeId.get(t.id) ?? -Infinity) >= 5);
  const estimatedLossR = flagged.reduce(
    (sum, t) => sum + Math.min(0, t.realizedR ?? 0),
    0
  );
  return { trades: flagged, estimatedLossR };
}

/**
 * Stopgap for calcFomoStats/findFomoEvidence until a real intraday OHLC feed
 * exists (see docs/SPEC.md Phase 10): treats the trader's own self-declared
 * "fomo" emotion tag (set at entry, pre-committed) as if that day's move had
 * been >= 5%, and everything else as 0%. Same trade-off already made for
 * scoreEmotion() in process-score.ts and the noFomo counterfactual scenario.
 */
export function deriveFomoPriceContextFromTags(trades: Trade[]): FomoPriceContext[] {
  return trades.map((t) => ({
    tradeId: t.id,
    dayChangePctAtEntry: t.emotionTags.includes("fomo") ? 5 : 0,
  }));
}

export interface BiasRadar {
  disposition: number;
  revengeTrading: number;
  overtrading: number;
  averagingDown: number;
  stopDelay: number;
  fomo: number;
}

/**
 * Maps each raw bias metric onto a 0-100 danger score, anchored so the
 * literature/spec threshold (docs/SPEC.md M4) lands near 50. These curves are
 * a reasonable default, not a validated clinical scale — revisit once M4's
 * UI (Phase 5) shows how they feel against real journals.
 */
export function calcBiasRadar(
  trades: Trade[],
  events: TradeEvent[],
  priceContext: FomoPriceContext[] = []
): BiasRadar {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const disposition = calcDispositionEffect(trades);
  const revengeRate = calcRevengeTradingRate(trades);
  const overtradingSlope = calcOvertradingSlope(trades);
  const averagingDownRate = calcAveragingDownRate(trades, events);
  const stopDelayHours = calcStopDelayHours(trades, events);
  const fomo = calcFomoStats(trades, priceContext);
  const overallMetrics = trades.filter((t) => t.realizedR !== null);
  const overallWinRate =
    overallMetrics.length > 0
      ? overallMetrics.filter((t) => (t.realizedR as number) > 0).length /
        overallMetrics.length
      : 0;

  return {
    disposition: clamp((disposition.index / 0.2) * 100),
    revengeTrading: clamp((revengeRate / 0.3) * 100),
    overtrading: clamp(-overtradingSlope * 100),
    averagingDown: clamp(averagingDownRate * 400),
    stopDelay: clamp((stopDelayHours / 48) * 100),
    fomo: clamp((overallWinRate - fomo.winRate) * 400),
  };
}
