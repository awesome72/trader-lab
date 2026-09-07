// Auto-fills a live trade's MAE/MFE inputs from real market data when the
// collector (scripts/collector/) has already backfilled the ticker, instead
// of always asking the trader to remember/type the low/high seen while the
// position was open (docs/SPEC.md's original manual-entry design — see
// app/journal/[id]/close/close-form.tsx).

export interface DailyBar {
  d: string; // "YYYY-MM-DD"
  low: number;
  high: number;
}

// Both bounds inclusive; `d`/fromDate/toDate compare correctly as plain
// strings since they're always "YYYY-MM-DD".
export function calcPriceRangeInWindow(
  bars: DailyBar[],
  fromDate: string,
  toDate: string
): { low: number; high: number } | null {
  const inRange = bars.filter((b) => b.d >= fromDate && b.d <= toDate);
  if (inRange.length === 0) return null;

  return {
    low: Math.min(...inRange.map((b) => b.low)),
    high: Math.max(...inRange.map((b) => b.high)),
  };
}
