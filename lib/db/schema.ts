// Drizzle schema mirroring docs/SPEC.md PART D SQL 1:1. Column names stay
// snake_case (matching the SQL); TS property names are camelCase.
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// `auth.users` is managed by Supabase itself; we only need a reference point
// for foreign keys, not to own or migrate that table.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const tradeStatusEnum = pgEnum("trade_status", [
  "planned",
  "open",
  "closed",
  "cancelled",
]);
export const setupTypeEnum = pgEnum("setup_type", [
  "breakout",
  "pullback",
  "reversal",
  "earnings",
  "flow",
  "event",
  "other",
]);
export const horizonTypeEnum = pgEnum("horizon_type", [
  "scalp",
  "day",
  "swing",
  "position",
]);
export const stopBasisEnum = pgEnum("stop_basis", [
  "technical",
  "atr",
  "max_loss",
  "time",
]);
export const sourceTypeEnum = pgEnum("source_type", ["live", "replay", "drill"]);

// ══════════════════════════════════════════════
// 1. 사용자 & 계좌 설정
// ══════════════════════════════════════════════
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id),
  displayName: text("display_name"),
  accountSize: numeric("account_size", { mode: "number" })
    .notNull()
    .default(10_000_000),
  defaultRiskPct: numeric("default_risk_pct", { mode: "number" })
    .notNull()
    .default(1.0),
  maxRiskPct: numeric("max_risk_pct", { mode: "number" }).notNull().default(2.0),
  feeBps: numeric("fee_bps", { mode: "number" }).notNull().default(1.5),
  taxBps: numeric("tax_bps", { mode: "number" }).notNull().default(15),
  slippageBps: numeric("slippage_bps", { mode: "number" }).notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// 2. 시장 데이터
// ══════════════════════════════════════════════
export const tickerMaster = pgTable("ticker_master", {
  ticker: text("ticker").primaryKey(),
  name: text("name").notNull(),
  market: text("market"),
  sector: text("sector"),
  listedFrom: date("listed_from"),
  delistedAt: date("delisted_at"), // survivorship-bias guard, see docs/SPEC.md C-2
  marketCap: bigint("market_cap", { mode: "number" }),
});

export const ohlcvDaily = pgTable(
  "ohlcv_daily",
  {
    ticker: text("ticker")
      .notNull()
      .references(() => tickerMaster.ticker),
    d: date("d").notNull(),
    open: numeric("open", { mode: "number" }),
    high: numeric("high", { mode: "number" }),
    low: numeric("low", { mode: "number" }),
    close: numeric("close", { mode: "number" }),
    volume: bigint("volume", { mode: "number" }),
    value: bigint("value", { mode: "number" }),
    adjClose: numeric("adj_close", { mode: "number" }),
  },
  (table) => [
    primaryKey({ columns: [table.ticker, table.d] }),
    index("ohlcv_daily_d_idx").on(table.d),
  ]
);

export const investorFlow = pgTable(
  "investor_flow",
  {
    ticker: text("ticker")
      .notNull()
      .references(() => tickerMaster.ticker),
    d: date("d").notNull(),
    foreignNet: bigint("foreign_net", { mode: "number" }),
    institutionNet: bigint("institution_net", { mode: "number" }),
    individualNet: bigint("individual_net", { mode: "number" }),
    programNet: bigint("program_net", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.ticker, table.d] })]
);

// ══════════════════════════════════════════════
// 3. M1 의사결정 저널 (핵심 테이블)
// ══════════════════════════════════════════════
export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    source: sourceTypeEnum("source").notNull().default("live"),
    ticker: text("ticker"),
    maskedLabel: text("masked_label"),
    status: tradeStatusEnum("status").notNull().default("planned"),

    // Entry (append-only once journalLockedAt is set)
    entryAt: timestamp("entry_at", { withTimezone: true }),
    entryPrice: numeric("entry_price", { mode: "number" }),
    quantity: integer("quantity"),
    direction: text("direction").default("long"),

    // Pre-commitment
    thesis: text("thesis").notNull(),
    setup: setupTypeEnum("setup").notNull(),
    horizon: horizonTypeEnum("horizon").notNull(),
    invalidation: text("invalidation").notNull(),
    stopPrice: numeric("stop_price", { mode: "number" }).notNull(),
    stopBasis: stopBasisEnum("stop_basis").notNull(),
    target1Price: numeric("target1_price", { mode: "number" }),
    target2Price: numeric("target2_price", { mode: "number" }),
    confidence: integer("confidence").notNull(),
    plannedRiskPct: numeric("planned_risk_pct", { mode: "number" }),
    plannedRMultiple: numeric("planned_r_multiple", { mode: "number" }),

    // Psychological state
    emotionTags: text("emotion_tags").array(),
    prevTradePnlR: numeric("prev_trade_pnl_r", { mode: "number" }),
    conditionScore: integer("condition_score"),

    // Exit
    exitAt: timestamp("exit_at", { withTimezone: true }),
    exitPrice: numeric("exit_price", { mode: "number" }),
    exitReason: text("exit_reason"),
    realizedR: numeric("realized_r", { mode: "number" }),
    realizedPnl: numeric("realized_pnl", { mode: "number" }),
    maeR: numeric("mae_r", { mode: "number" }),
    mfeR: numeric("mfe_r", { mode: "number" }),

    // Scoring
    processScore: integer("process_score"),
    processBreakdown: jsonb("process_breakdown"),
    quadrant: text("quadrant"),

    journalLockedAt: timestamp("journal_locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("trades_user_id_entry_at_idx").on(table.userId, table.entryAt)]
);

// 진입 후 추가 행동 (append-only 로그)
export const tradeEvents = pgTable("trade_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id")
    .notNull()
    .references(() => trades.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).defaultNow(),
  kind: text("kind").notNull(), // add_position/reduce/move_stop/note/emotion
  payload: jsonb("payload"),
  note: text("note"),
});

// ══════════════════════════════════════════════
// 4. M5 캘리브레이션
// ══════════════════════════════════════════════
export const calibrationRecords = pgTable("calibration_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  tradeId: uuid("trade_id").references(() => trades.id),
  predictedProb: numeric("predicted_prob", { mode: "number" }).notNull(),
  outcome: boolean("outcome"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  context: text("context"), // 'trade' | 'quiz'
});

// ══════════════════════════════════════════════
// 5. M7 리플레이 세션
// ══════════════════════════════════════════════
export const replaySessions = pgTable("replay_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  ticker: text("ticker").notNull(), // never sent to the client until revealed
  startDate: date("start_date").notNull(),
  currentIndex: integer("current_index").notNull().default(0),
  level: integer("level").notNull().default(1),
  seed: text("seed"),
  revealed: boolean("revealed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// 6. M8 드릴
// ══════════════════════════════════════════════
export const drillCards = pgTable("drill_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").unique(),
  title: text("title"),
  situation: jsonb("situation"),
  options: jsonb("options"),
  scoringRubric: jsonb("scoring_rubric"),
  conceptTags: text("concept_tags").array(),
});

export const drillResponses = pgTable("drill_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id),
  cardId: uuid("card_id").references(() => drillCards.id),
  chosen: text("chosen"),
  confidence: integer("confidence"),
  rationale: text("rationale"),
  consistencyScore: numeric("consistency_score", { mode: "number" }),
  answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// 7. M9 룰 백테스트
// ══════════════════════════════════════════════
export const ruleSets = pgTable("rule_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id),
  name: text("name"),
  definition: jsonb("definition"),
  version: integer("version").default(1),
  searchCount: integer("search_count").default(0), // over-optimization warning counter
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const backtestRuns = pgTable("backtest_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleSetId: uuid("rule_set_id").references(() => ruleSets.id),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  isOutOfSample: boolean("is_out_of_sample"),
  metrics: jsonb("metrics"),
  equityCurve: jsonb("equity_curve"),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow(),
});

// ══════════════════════════════════════════════
// 8. M11 학습 카드 (SRS)
// ══════════════════════════════════════════════
export const srsCards = pgTable("srs_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id), // null = shared deck
  front: text("front"),
  back: text("back"),
  conceptTags: text("concept_tags").array(),
  sourceTradeId: uuid("source_trade_id").references(() => trades.id),
  ease: numeric("ease", { mode: "number" }).default(2.5),
  intervalDays: integer("interval_days").default(1),
  dueAt: timestamp("due_at", { withTimezone: true }).defaultNow(),
  reps: integer("reps").default(0),
});

// ══════════════════════════════════════════════
// 9. M10 AI 코칭 로그
// ══════════════════════════════════════════════
export const coachSessions = pgTable("coach_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => profiles.id),
  kind: text("kind"), // premortem/postmortem/weekly/monthly
  inputContext: jsonb("input_context"),
  output: jsonb("output"),
  experimentSuggested: text("experiment_suggested"),
  experimentStatus: text("experiment_status").default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
