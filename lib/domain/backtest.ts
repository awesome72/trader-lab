import { calcMetricsFromRs, type MetricsResult } from "./metrics";
import { applyCosts, calcPositionSize, calcRealizedR } from "./r-multiple";
import { buildIndicatorSeries, evaluateCondition, type BarSeries, type RuleDefinition } from "./rule-dsl";

// docs/SPEC.md Phase 7-2. Pure simulation: signals are decided from a bar's
// close, but every fill happens at the *next* bar's open — the one look-
// ahead rule this whole module exists to enforce. No Date.now(), no DB, no
// React; the caller (lib/queries/backtest.ts) is responsible for turning DB
// rows into TickerUniverseEntry[].

export interface TickerUniverseEntry {
  ticker: string;
  marketCap: number | null;
  delistedAt: string | null; // ISO date of the last tradable bar, if delisted
  dates: string[]; // ISO dates, ascending, aligned to the arrays below
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  foreignNet: number[];
}

export type ExitReason = "stop" | "target" | "time" | "delisted";

export interface BacktestTrade {
  ticker: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  exitReason: ExitReason;
  quantity: number;
  r: number; // net of costs
}

export interface BacktestOptions {
  accountSize: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  metrics: MetricsResult;
}

interface OpenPosition {
  ticker: string;
  entryIndex: number;
  entryDate: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number | null;
  quantity: number;
  daysSinceEntry: number;
}

interface PendingEntry {
  ticker: string;
  fillIndex: number;
  atrValueAtSignal: number | null;
}

export function runBacktest(
  universe: TickerUniverseEntry[],
  rule: RuleDefinition,
  opts: BacktestOptions
): BacktestResult {
  const perTicker = universe.map((entry) => {
    const bars: BarSeries = {
      open: entry.open,
      high: entry.high,
      low: entry.low,
      close: entry.close,
      volume: entry.volume,
      foreignNet: entry.foreignNet,
    };
    return {
      entry,
      bars,
      series: buildIndicatorSeries(bars, rule),
      dateIndex: new Map(entry.dates.map((d, i) => [d, i])),
    };
  });

  const allDates = Array.from(new Set(universe.flatMap((u) => u.dates))).sort();

  const openPositions = new Map<string, OpenPosition>();
  const pendingEntries = new Map<string, PendingEntry>();
  const trades: BacktestTrade[] = [];

  function closePosition(pos: OpenPosition, exitDate: string, exitPrice: number, reason: ExitReason) {
    const grossR = calcRealizedR(pos.entryPrice, pos.stopPrice, exitPrice, "long");
    if (grossR !== null) {
      const netR =
        applyCosts(
          grossR,
          pos.entryPrice,
          pos.stopPrice,
          rule.costs.feeBps,
          rule.costs.taxBps,
          rule.costs.slippageBps
        ) ?? grossR;
      trades.push({
        ticker: pos.ticker,
        entryDate: pos.entryDate,
        entryPrice: pos.entryPrice,
        exitDate,
        exitPrice,
        exitReason: reason,
        quantity: pos.quantity,
        r: netR,
      });
    }
    openPositions.delete(pos.ticker);
  }

  for (const date of allDates) {
    // 1) Fill pending entries scheduled for today (next-bar-open rule).
    for (const [ticker, pending] of pendingEntries) {
      const pt = perTicker.find((p) => p.entry.ticker === ticker)!;
      const idx = pt.dateIndex.get(date);
      if (idx !== pending.fillIndex) continue;

      const entryPrice = pt.bars.open[idx];
      const stop = rule.exit.stop;
      const stopPrice =
        stop.type === "atr"
          ? entryPrice - stop.multiplier * (pending.atrValueAtSignal ?? 0)
          : stop.type === "pct"
            ? entryPrice * (1 - stop.value / 100)
            : entryPrice - stop.value;
      const targetPrice = rule.exit.target ? entryPrice * (1 + rule.exit.target.value / 100) : null;

      const quantity = calcPositionSize(opts.accountSize, rule.sizing.riskPct, entryPrice, stopPrice);
      pendingEntries.delete(ticker);
      if (quantity === null || quantity <= 0 || stopPrice >= entryPrice) continue;

      openPositions.set(ticker, {
        ticker,
        entryIndex: idx,
        entryDate: date,
        entryPrice,
        stopPrice,
        targetPrice,
        quantity,
        daysSinceEntry: 0,
      });
    }

    // 2) Manage exits for positions whose ticker trades today.
    for (const pos of Array.from(openPositions.values())) {
      const pt = perTicker.find((p) => p.entry.ticker === pos.ticker)!;
      const idx = pt.dateIndex.get(date);
      if (idx === undefined) continue;

      pos.daysSinceEntry += 1;

      if (pt.entry.delistedAt === date) {
        closePosition(pos, date, pt.bars.close[idx], "delisted");
        continue;
      }
      if (pt.bars.low[idx] <= pos.stopPrice) {
        closePosition(pos, date, pos.stopPrice, "stop");
        continue;
      }
      if (pos.targetPrice !== null && pt.bars.high[idx] >= pos.targetPrice) {
        closePosition(pos, date, pos.targetPrice, "target");
        continue;
      }
      const timeStop = rule.exit.timeStop;
      if (timeStop && pos.daysSinceEntry >= timeStop.bars) {
        closePosition(pos, date, pt.bars.close[idx], "time");
      }
    }

    // 3) Decide new entries at today's close, to be filled at tomorrow's open.
    for (const pt of perTicker) {
      const idx = pt.dateIndex.get(date);
      if (idx === undefined) continue;
      if (openPositions.has(pt.entry.ticker) || pendingEntries.has(pt.entry.ticker)) continue;
      if (openPositions.size + pendingEntries.size >= rule.maxConcurrentPositions) continue;
      if (pt.entry.delistedAt !== null && date >= pt.entry.delistedAt) continue;

      const entryFires = evaluateCondition(rule.entry, pt.series, pt.entry.marketCap, idx);
      const excluded = rule.exclude
        ? evaluateCondition(rule.exclude, pt.series, pt.entry.marketCap, idx)
        : false;
      if (!entryFires || excluded) continue;

      const nextIdx = idx + 1;
      if (nextIdx >= pt.entry.dates.length) continue; // no next bar left to fill at

      const atrKey = `atr:close:${rule.exit.stop.type === "atr" ? rule.exit.stop.period : ""}:`;
      pendingEntries.set(pt.entry.ticker, {
        ticker: pt.entry.ticker,
        fillIndex: nextIdx,
        atrValueAtSignal: rule.exit.stop.type === "atr" ? (pt.series[atrKey]?.[idx] ?? null) : null,
      });
    }
  }

  const rs = trades.map((t) => t.r);
  return { trades, metrics: calcMetricsFromRs(rs) };
}

export interface WalkForwardSplit {
  trades: BacktestTrade[];
  metrics: MetricsResult;
}

export interface WalkForwardResult {
  splitDate: string;
  is: WalkForwardSplit;
  oos: WalkForwardSplit;
  overfitWarning: boolean;
}

// docs/SPEC.md Phase 7-4-1: always split the tested period into the first
// 70% (in-sample) and last 30% (out-of-sample) by calendar time, and always
// report both — never an in-sample-only view.
export function runWalkForwardBacktest(
  universe: TickerUniverseEntry[],
  rule: RuleDefinition,
  opts: BacktestOptions
): WalkForwardResult {
  const full = runBacktest(universe, rule, opts);
  const allDates = Array.from(new Set(universe.flatMap((u) => u.dates))).sort();
  const splitIdx = Math.max(0, Math.floor(allDates.length * 0.7) - 1);
  const splitDate = allDates[splitIdx] ?? allDates[allDates.length - 1];

  const isTrades = full.trades.filter((t) => t.entryDate <= splitDate);
  const oosTrades = full.trades.filter((t) => t.entryDate > splitDate);
  const isMetrics = calcMetricsFromRs(isTrades.map((t) => t.r));
  const oosMetrics = calcMetricsFromRs(oosTrades.map((t) => t.r));

  const overfitWarning = isMetrics.expectancy > 0 && oosMetrics.expectancy < isMetrics.expectancy * 0.5;

  return {
    splitDate,
    is: { trades: isTrades, metrics: isMetrics },
    oos: { trades: oosTrades, metrics: oosMetrics },
    overfitWarning,
  };
}

export interface WorstWindowResult {
  startDate: string;
  endDate: string;
  cumulativeR: number;
  tradeCount: number;
}

// docs/SPEC.md Phase 7-4-3: show the worst rolling window with the same
// visual weight as the average, so a trader can prepare for it rather than
// discover it live.
export function calcWorstWindow(trades: BacktestTrade[], windowDays = 183): WorstWindowResult | null {
  if (trades.length === 0) return null;

  const sorted = [...trades].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const msPerDay = 86_400_000;
  let worst: WorstWindowResult | null = null;

  for (const startTrade of sorted) {
    const startMs = new Date(startTrade.entryDate).getTime();
    const endMs = startMs + windowDays * msPerDay;
    const windowTrades = sorted.filter((t) => {
      const ms = new Date(t.entryDate).getTime();
      return ms >= startMs && ms < endMs;
    });
    const cumulativeR = windowTrades.reduce((s, t) => s + t.r, 0);
    if (!worst || cumulativeR < worst.cumulativeR) {
      worst = {
        startDate: startTrade.entryDate,
        endDate: windowTrades[windowTrades.length - 1].entryDate,
        cumulativeR,
        tradeCount: windowTrades.length,
      };
    }
  }

  return worst;
}

// docs/SPEC.md Phase 7-4-2: warn once the same rule_set has been re-run
// (parameter-tweaked) more than 20 times — multiple-testing / p-hacking risk.
export function multipleTestingWarning(searchCount: number): string | null {
  if (searchCount <= 20) return null;
  return `이 규칙에 대해 ${searchCount}회 탐색했습니다. 무작위 데이터에서도 20회 시도하면 우연히 좋은 결과가 나옵니다(다중검정 문제). 미학습 기간 검증이 필수입니다.`;
}
