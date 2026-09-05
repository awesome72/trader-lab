CREATE TYPE "public"."horizon_type" AS ENUM('scalp', 'day', 'swing', 'position');--> statement-breakpoint
CREATE TYPE "public"."setup_type" AS ENUM('breakout', 'pullback', 'reversal', 'earnings', 'flow', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('live', 'replay', 'drill');--> statement-breakpoint
CREATE TYPE "public"."stop_basis" AS ENUM('technical', 'atr', 'max_loss', 'time');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('planned', 'open', 'closed', 'cancelled');--> statement-breakpoint
-- "auth"."users" already exists (managed by Supabase Auth) — not created here.
CREATE TABLE "backtest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" uuid,
	"period_start" date,
	"period_end" date,
	"is_out_of_sample" boolean,
	"metrics" jsonb,
	"equity_curve" jsonb,
	"ran_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calibration_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trade_id" uuid,
	"predicted_prob" numeric NOT NULL,
	"outcome" boolean,
	"resolved_at" timestamp with time zone,
	"context" text
);
--> statement-breakpoint
CREATE TABLE "coach_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" text,
	"input_context" jsonb,
	"output" jsonb,
	"experiment_suggested" text,
	"experiment_status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drill_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"title" text,
	"situation" jsonb,
	"options" jsonb,
	"scoring_rubric" jsonb,
	"concept_tags" text[],
	CONSTRAINT "drill_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "drill_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"card_id" uuid,
	"chosen" text,
	"confidence" integer,
	"rationale" text,
	"consistency_score" numeric,
	"answered_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investor_flow" (
	"ticker" text NOT NULL,
	"d" date NOT NULL,
	"foreign_net" bigint,
	"institution_net" bigint,
	"individual_net" bigint,
	"program_net" bigint,
	CONSTRAINT "investor_flow_ticker_d_pk" PRIMARY KEY("ticker","d")
);
--> statement-breakpoint
CREATE TABLE "ohlcv_daily" (
	"ticker" text NOT NULL,
	"d" date NOT NULL,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"close" numeric,
	"volume" bigint,
	"value" bigint,
	"adj_close" numeric,
	CONSTRAINT "ohlcv_daily_ticker_d_pk" PRIMARY KEY("ticker","d")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"account_size" numeric DEFAULT 10000000 NOT NULL,
	"default_risk_pct" numeric DEFAULT 1 NOT NULL,
	"max_risk_pct" numeric DEFAULT 2 NOT NULL,
	"fee_bps" numeric DEFAULT 1.5 NOT NULL,
	"tax_bps" numeric DEFAULT 15 NOT NULL,
	"slippage_bps" numeric DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "replay_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"start_date" date NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"seed" text,
	"revealed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text,
	"definition" jsonb,
	"version" integer DEFAULT 1,
	"search_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "srs_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"front" text,
	"back" text,
	"concept_tags" text[],
	"source_trade_id" uuid,
	"ease" numeric DEFAULT 2.5,
	"interval_days" integer DEFAULT 1,
	"due_at" timestamp with time zone DEFAULT now(),
	"reps" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "ticker_master" (
	"ticker" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"market" text,
	"sector" text,
	"listed_from" date,
	"delisted_at" date,
	"market_cap" bigint
);
--> statement-breakpoint
CREATE TABLE "trade_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now(),
	"kind" text NOT NULL,
	"payload" jsonb,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "source_type" DEFAULT 'live' NOT NULL,
	"ticker" text,
	"masked_label" text,
	"status" "trade_status" DEFAULT 'planned' NOT NULL,
	"entry_at" timestamp with time zone,
	"entry_price" numeric,
	"quantity" integer,
	"direction" text DEFAULT 'long',
	"thesis" text NOT NULL,
	"setup" "setup_type" NOT NULL,
	"horizon" "horizon_type" NOT NULL,
	"invalidation" text NOT NULL,
	"stop_price" numeric NOT NULL,
	"stop_basis" "stop_basis" NOT NULL,
	"target1_price" numeric,
	"target2_price" numeric,
	"confidence" integer NOT NULL,
	"planned_risk_pct" numeric,
	"planned_r_multiple" numeric,
	"emotion_tags" text[],
	"prev_trade_pnl_r" numeric,
	"condition_score" integer,
	"exit_at" timestamp with time zone,
	"exit_price" numeric,
	"exit_reason" text,
	"realized_r" numeric,
	"realized_pnl" numeric,
	"mae_r" numeric,
	"mfe_r" numeric,
	"process_score" integer,
	"process_breakdown" jsonb,
	"quadrant" text,
	"journal_locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_rule_set_id_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_records" ADD CONSTRAINT "calibration_records_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_records" ADD CONSTRAINT "calibration_records_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_sessions" ADD CONSTRAINT "coach_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_responses" ADD CONSTRAINT "drill_responses_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_responses" ADD CONSTRAINT "drill_responses_card_id_drill_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."drill_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investor_flow" ADD CONSTRAINT "investor_flow_ticker_ticker_master_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."ticker_master"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ohlcv_daily" ADD CONSTRAINT "ohlcv_daily_ticker_ticker_master_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."ticker_master"("ticker") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_sessions" ADD CONSTRAINT "replay_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_source_trade_id_trades_id_fk" FOREIGN KEY ("source_trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_events" ADD CONSTRAINT "trade_events_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ohlcv_daily_d_idx" ON "ohlcv_daily" USING btree ("d");--> statement-breakpoint
CREATE INDEX "trades_user_id_entry_at_idx" ON "trades" USING btree ("user_id","entry_at");