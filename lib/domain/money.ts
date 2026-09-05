// Floating-point-safe rounding for currency/price/quantity comparisons and
// aggregation, per CLAUDE.md architecture rule 7.
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
