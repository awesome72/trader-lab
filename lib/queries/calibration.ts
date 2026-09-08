import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { calibrationRecords, ohlcvDaily, tickerMaster, trades } from "@/lib/db/schema";
import type { CalibrationRecord } from "@/lib/domain/calibration";

// "Trade" context calibration data isn't a separate table write — the
// trader's declared confidence (0-100, already collected at journal entry)
// doubles as their predicted probability, and the trade's own outcome
// resolves it. No new writes needed for this half of the calibration curve.
export async function getTradeCalibrationRecords(userId: string): Promise<CalibrationRecord[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.status, "closed"), isNotNull(trades.realizedR)));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    tradeId: r.id,
    predictedProb: r.confidence / 100,
    outcome: (r.realizedR as number) > 0,
    resolvedAt: r.exitAt ? r.exitAt.toISOString() : null,
    context: "trade" as const,
  }));
}

export async function getQuizCalibrationRecords(userId: string): Promise<CalibrationRecord[]> {
  const rows = await db
    .select()
    .from(calibrationRecords)
    .where(
      and(
        eq(calibrationRecords.userId, userId),
        eq(calibrationRecords.context, "quiz"),
        isNotNull(calibrationRecords.resolvedAt)
      )
    );

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    tradeId: r.tradeId,
    predictedProb: r.predictedProb,
    outcome: r.outcome,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    context: "quiz" as const,
  }));
}

export interface QuizBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  idx: number;
}
export interface QuizQuestion {
  recordId: string;
  bars: QuizBar[];
}

const WINDOW_SIZE = 120;
const HORIZON_DAYS = 5;

// Deterministic-enough randomness for picking windows — Math.random() here
// is fine (this is a query/route module, not lib/domain).
function pickRandomIndices(max: number, count: number): number[] {
  const indices = Array.from({ length: max }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count);
}

// Creates a quiz: picks `count` random 120-bar windows (from our seeded
// tickers) each with 5 more known future bars, and stores the true outcome
// server-side immediately (outcome resolved, predictedProb a placeholder)
// so the client can never see it — only the 120 masked bars go out.
export async function createQuizSession(userId: string, count = 20): Promise<QuizQuestion[]> {
  // Only the tracked set (scripts/collector/select_universe.py) ever has
  // ohlcv_daily rows — skips an empty per-ticker query for every untracked
  // ticker_master row otherwise.
  const tickers = await db
    .select({ ticker: tickerMaster.ticker })
    .from(tickerMaster)
    .where(eq(tickerMaster.isTracked, true));

  const candidates: { ticker: string; startIdx: number }[] = [];
  const rowsByTicker = new Map<string, (typeof ohlcvDaily.$inferSelect)[]>();

  if (tickers.length > 0) {
    // One query instead of one per ticker (previously up to ~325 round
    // trips for the tracked universe) — grouped by ticker in JS below.
    const allRows = await db
      .select()
      .from(ohlcvDaily)
      .where(inArray(ohlcvDaily.ticker, tickers.map((t) => t.ticker)))
      .orderBy(asc(ohlcvDaily.ticker), asc(ohlcvDaily.d));

    for (const row of allRows) {
      const list = rowsByTicker.get(row.ticker);
      if (list) list.push(row);
      else rowsByTicker.set(row.ticker, [row]);
    }
  }

  for (const t of tickers) {
    const rows = rowsByTicker.get(t.ticker) ?? [];
    const maxStart = rows.length - WINDOW_SIZE - HORIZON_DAYS;
    for (let start = 0; start < maxStart; start++) {
      candidates.push({ ticker: t.ticker, startIdx: start });
    }
  }

  const chosenIdx = pickRandomIndices(candidates.length, count);
  const questions: { bars: QuizBar[]; outcome: boolean }[] = [];

  for (const idx of chosenIdx) {
    const { ticker, startIdx } = candidates[idx];
    const rows = rowsByTicker.get(ticker)!;
    const windowRows = rows.slice(startIdx, startIdx + WINDOW_SIZE);
    const lastVisibleClose = windowRows[windowRows.length - 1].close as number;
    const futureClose = rows[startIdx + WINDOW_SIZE - 1 + HORIZON_DAYS].close as number;

    questions.push({
      bars: windowRows.map((r, i) => ({
        o: r.open ?? 0,
        h: r.high ?? 0,
        l: r.low ?? 0,
        c: r.close ?? 0,
        v: r.volume ?? 0,
        idx: i,
      })),
      outcome: futureClose > lastVisibleClose,
    });
  }

  const inserted = await db
    .insert(calibrationRecords)
    .values(
      questions.map((q) => ({
        userId,
        tradeId: null,
        predictedProb: 0,
        outcome: q.outcome,
        resolvedAt: null,
        context: "quiz",
      }))
    )
    .returning({ id: calibrationRecords.id });

  return inserted.map((row, i) => ({ recordId: row.id, bars: questions[i].bars }));
}

export interface QuizAnswer {
  recordId: string;
  predictedProb: number; // 0-1
}

export interface QuizGradeResult {
  recordId: string;
  predictedProb: number;
  outcome: boolean;
  squaredError: number;
}

export async function submitQuizAnswers(
  userId: string,
  answers: QuizAnswer[]
): Promise<QuizGradeResult[]> {
  const recordIds = answers.map((a) => a.recordId);
  const rows = await db
    .select()
    .from(calibrationRecords)
    .where(and(eq(calibrationRecords.userId, userId), inArray(calibrationRecords.id, recordIds)));
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const results: QuizGradeResult[] = [];
  const now = new Date();

  for (const answer of answers) {
    const row = rowById.get(answer.recordId);
    if (!row || row.outcome === null) continue;

    await db
      .update(calibrationRecords)
      .set({ predictedProb: answer.predictedProb, resolvedAt: now })
      .where(and(eq(calibrationRecords.id, answer.recordId), eq(calibrationRecords.userId, userId)));

    const outcomeValue = row.outcome ? 1 : 0;
    results.push({
      recordId: answer.recordId,
      predictedProb: answer.predictedProb,
      outcome: row.outcome,
      squaredError: (answer.predictedProb - outcomeValue) ** 2,
    });
  }

  return results;
}
