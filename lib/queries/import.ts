import { db } from "@/lib/db";
import { trades } from "@/lib/db/schema";
import { NO_PLAN_TAG } from "@/lib/labels";
import type { Direction, HorizonType } from "@/lib/domain/types";

export interface CsvImportRow {
  ticker: string;
  direction: Direction;
  entryDate: string; // ISO date/datetime
  entryPrice: number;
  quantity: number;
  exitDate: string; // ISO date/datetime
  exitPrice: number;
}

export interface CsvImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

function inferHorizon(entryAt: Date, exitAt: Date): HorizonType {
  const holdingDays = (exitAt.getTime() - entryAt.getTime()) / (1000 * 60 * 60 * 24);
  if (holdingDays < 1) return "scalp";
  if (holdingDays <= 1) return "day";
  if (holdingDays <= 10) return "swing";
  return "position";
}

// docs/SPEC.md Phase 10-4: imported historical trades have no real
// pre-declared plan, so processScore/realizedR stay null (never forced) and
// every plan field is an obvious placeholder — never used for any real R or
// process calculation because those always guard on realizedR/processScore
// being non-null first. Real cash P&L (realizedPnl) is still computed and
// shown, since that doesn't depend on a declared risk basis.
export async function importCsvTrades(userId: string, rows: CsvImportRow[]): Promise<CsvImportResult> {
  const errors: CsvImportResult["errors"] = [];
  const toInsert: (typeof trades.$inferInsert)[] = [];

  rows.forEach((row, i) => {
    const entryAt = new Date(row.entryDate);
    const exitAt = new Date(row.exitDate);

    if (!row.ticker.trim()) {
      errors.push({ row: i, message: "종목명/코드가 비어 있습니다." });
      return;
    }
    if (Number.isNaN(entryAt.getTime()) || Number.isNaN(exitAt.getTime())) {
      errors.push({ row: i, message: "날짜를 해석할 수 없습니다." });
      return;
    }
    if (!(row.entryPrice > 0) || !(row.exitPrice > 0) || !(row.quantity > 0)) {
      errors.push({ row: i, message: "가격/수량은 0보다 커야 합니다." });
      return;
    }

    const realizedPnl =
      row.direction === "long"
        ? (row.exitPrice - row.entryPrice) * row.quantity
        : (row.entryPrice - row.exitPrice) * row.quantity;

    // Placeholder only — never fed into any real R calculation, since
    // realizedR is intentionally left null for every imported row.
    const placeholderStopPrice =
      row.direction === "long" ? row.entryPrice * 0.999 : row.entryPrice * 1.001;

    toInsert.push({
      userId,
      source: "live",
      ticker: row.ticker.trim(),
      status: "closed",
      entryAt,
      entryPrice: row.entryPrice,
      quantity: row.quantity,
      direction: row.direction,
      thesis: "(CSV 임포트: 사전 논거 기록 없음)",
      setup: "other",
      horizon: inferHorizon(entryAt, exitAt),
      invalidation: "(CSV 임포트: 무효화 조건 기록 없음)",
      stopPrice: placeholderStopPrice,
      stopBasis: "technical",
      confidence: 50,
      emotionTags: [NO_PLAN_TAG],
      exitAt,
      exitPrice: row.exitPrice,
      realizedR: null,
      realizedPnl,
      processScore: null,
    });
  });

  if (toInsert.length > 0) {
    await db.insert(trades).values(toInsert);
  }

  return { imported: toInsert.length, errors };
}
