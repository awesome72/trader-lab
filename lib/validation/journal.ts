import { z } from "zod";

// Shared between the client form (live feedback) and the Server Action
// (authoritative check — never trust client-side validation alone).
//
// Number fields use plain z.number() (not z.coerce) — the form converts
// input strings to numbers itself via react-hook-form's `valueAsNumber`,
// so react-hook-form's field type and zod's inferred type stay identical
// and zodResolver's generics don't fight each other.

const INDICATOR_KEYWORDS = /(이평|이동평균|RSI|거래량|지지|저항|%)/i;

export const journalEntrySchema = z.object({
  ticker: z.string().trim().min(1, "종목 코드를 입력해주세요."),
  direction: z.enum(["long", "short"]),
  entryPrice: z.number().positive("진입가는 0보다 커야 합니다."),
  quantity: z.number().int().positive("수량은 1 이상이어야 합니다."),
  entryAt: z.string().min(1, "체결 시각을 입력해주세요."),

  thesis: z
    .string()
    .trim()
    .min(50, "논거를 언어화하지 못했다면 아직 논거가 아닙니다 (최소 50자)."),
  setup: z.enum([
    "breakout",
    "pullback",
    "reversal",
    "earnings",
    "flow",
    "event",
    "other",
  ]),
  horizon: z.enum(["scalp", "day", "swing", "position"]),

  invalidation: z
    .string()
    .trim()
    .min(20, "무효화 조건은 최소 20자 이상 입력해주세요."),
  stopPrice: z.number().positive("손절가는 0보다 커야 합니다."),
  stopBasis: z.enum(["technical", "atr", "max_loss", "time"]),

  target1Price: z.number().positive().optional(),
  target2Price: z.number().positive().optional(),
  confidence: z.number().int().min(0).max(100),

  plannedRiskPct: z.number().positive("리스크 %는 0보다 커야 합니다."),

  emotionTags: z.array(z.string()),
  conditionScore: z.number().int().min(1).max(5).optional(),
});

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

export function isInvalidationVerifiable(text: string): boolean {
  return INDICATOR_KEYWORDS.test(text) || /\d/.test(text);
}

export const journalCloseSchema = z.object({
  exitPrice: z.number().positive("청산가는 0보다 커야 합니다."),
  exitAt: z.string().min(1, "청산 시각을 입력해주세요."),
  exitReason: z.enum(["stop", "target", "discretionary", "time"]),
  // Manual until Phase 10 wires up a real OHLC feed — the trader reports the
  // best/worst price actually seen while the position was open.
  lowestPrice: z.number().positive("최저가는 0보다 커야 합니다."),
  highestPrice: z.number().positive("최고가는 0보다 커야 합니다."),
  invalidationTriggered: z.enum(["yes", "no", "unsure"]),
});

export type JournalCloseInput = z.infer<typeof journalCloseSchema>;

// Abbreviated pre-commitment for app/replay (docs/SPEC.md Phase 6-4):
// thesis/invalidation/stop/target/confidence only — no ticker/entry fields
// since those come from the replay bar itself, not the trader.
export const replayEntrySchema = z.object({
  thesis: z
    .string()
    .trim()
    .min(30, "논거를 최소 30자 이상 입력해주세요."),
  invalidation: z
    .string()
    .trim()
    .min(20, "무효화 조건은 최소 20자 이상 입력해주세요."),
  stopPrice: z.number().positive("손절가는 0보다 커야 합니다."),
  target1Price: z.number().positive().optional(),
  confidence: z.number().int().min(0).max(100),
});

export type ReplayEntryInput = z.infer<typeof replayEntrySchema>;
