import type { Direction, ExitReason } from "./types";

/**
 * Planned R-multiple at entry: reward-to-risk ratio implied by entry/stop/target.
 * Sign-consistent for both directions without needing an explicit `direction`
 * argument: for a short, stop > entry and target < entry, so the ratio of two
 * negative differences still comes out positive for a favorable setup.
 */
export function calcPlannedR(
  entry: number,
  stop: number,
  target: number
): number | null {
  const risk = entry - stop;
  if (risk === 0) return null;
  return (target - entry) / risk;
}

export function calcRealizedR(
  entry: number,
  stop: number,
  exit: number,
  direction: Direction
): number | null {
  const risk = direction === "long" ? entry - stop : stop - entry;
  if (risk === 0) return null;
  const reward = direction === "long" ? exit - entry : entry - exit;
  return reward / risk;
}

export function calcRiskAmount(accountSize: number, riskPct: number): number {
  return accountSize * (riskPct / 100);
}

export function calcPositionSize(
  accountSize: number,
  riskPct: number,
  entry: number,
  stop: number
): number | null {
  const riskPerShare = Math.abs(entry - stop);
  if (riskPerShare === 0) return null;
  const riskAmount = calcRiskAmount(accountSize, riskPct);
  return Math.floor(riskAmount / riskPerShare);
}

/**
 * Deducts fees/tax/slippage from a gross R value, expressed in R units.
 * Costs are assumed proportional to entry price (fee+slippage on both the
 * buy and sell leg, tax on the sell leg only), then converted to R by
 * dividing by the 1R distance (|entry - stop|).
 */
export function applyCosts(
  grossR: number,
  entry: number,
  stop: number,
  feeBps: number,
  taxBps: number,
  slippageBps: number
): number | null {
  const riskPerShare = Math.abs(entry - stop);
  if (riskPerShare === 0) return null;
  const totalCostBps = feeBps * 2 + taxBps + slippageBps * 2;
  const costPerShare = (entry * totalCostBps) / 10000;
  const costInR = costPerShare / riskPerShare;
  return grossR - costInR;
}

/**
 * Classifies an exit price against the pre-declared stop/target, for flows
 * (e.g. app/replay) where the trader doesn't manually pick an exit reason —
 * the fill itself tells us which rule fired. Stop takes priority when a
 * price gap makes both look true in the same bar.
 */
export function inferExitReason(
  direction: Direction,
  exitPrice: number,
  stopPrice: number,
  target1Price: number | null
): ExitReason {
  const stopHit = direction === "long" ? exitPrice <= stopPrice : exitPrice >= stopPrice;
  if (stopHit) return "stop";

  const targetHit =
    target1Price !== null &&
    (direction === "long" ? exitPrice >= target1Price : exitPrice <= target1Price);
  if (targetHit) return "target";

  return "discretionary";
}
