-- Row Level Security (CLAUDE.md rule 5): every user-owned table gets RLS
-- enabled with an auth.uid() = user_id policy. Tables owned indirectly
-- through a parent row (trade_events -> trades, backtest_runs -> rule_sets)
-- check ownership via that parent instead. Shared/reference tables get RLS
-- enabled too, with a read-only policy for any authenticated user.

-- profiles
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own profile" ON "profiles"
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);--> statement-breakpoint

-- trades
ALTER TABLE "trades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows" ON "trades"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

-- trade_events (owned via trades.user_id)
ALTER TABLE "trade_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows via trade" ON "trade_events"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "trades"
      WHERE "trades"."id" = "trade_events"."trade_id"
        AND "trades"."user_id" = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "trades"
      WHERE "trades"."id" = "trade_events"."trade_id"
        AND "trades"."user_id" = auth.uid()
    )
  );--> statement-breakpoint

-- calibration_records
ALTER TABLE "calibration_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows" ON "calibration_records"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

-- replay_sessions
ALTER TABLE "replay_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows" ON "replay_sessions"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

-- drill_responses
ALTER TABLE "drill_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows" ON "drill_responses"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

-- rule_sets
ALTER TABLE "rule_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows" ON "rule_sets"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

-- backtest_runs (owned via rule_sets.user_id)
ALTER TABLE "backtest_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows via rule_set" ON "backtest_runs"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "rule_sets"
      WHERE "rule_sets"."id" = "backtest_runs"."rule_set_id"
        AND "rule_sets"."user_id" = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "rule_sets"
      WHERE "rule_sets"."id" = "backtest_runs"."rule_set_id"
        AND "rule_sets"."user_id" = auth.uid()
    )
  );--> statement-breakpoint

-- srs_cards (user_id IS NULL = shared deck, readable by everyone)
ALTER TABLE "srs_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "read own or shared" ON "srs_cards"
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "insert own rows" ON "srs_cards"
  FOR INSERT WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "update own rows" ON "srs_cards"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "delete own rows" ON "srs_cards"
  FOR DELETE USING (auth.uid() = user_id);--> statement-breakpoint

-- coach_sessions
ALTER TABLE "coach_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "own rows" ON "coach_sessions"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

-- Shared/reference tables: no per-user ownership, read-only for logged-in users.
ALTER TABLE "ticker_master" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "read for authenticated" ON "ticker_master"
  FOR SELECT USING (auth.role() = 'authenticated');--> statement-breakpoint

ALTER TABLE "ohlcv_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "read for authenticated" ON "ohlcv_daily"
  FOR SELECT USING (auth.role() = 'authenticated');--> statement-breakpoint

ALTER TABLE "investor_flow" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "read for authenticated" ON "investor_flow"
  FOR SELECT USING (auth.role() = 'authenticated');--> statement-breakpoint

ALTER TABLE "drill_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "read for authenticated" ON "drill_cards"
  FOR SELECT USING (auth.role() = 'authenticated');--> statement-breakpoint

-- ══════════════════════════════════════════════
-- Auto-create a profiles row on signup (Prompt 2, item 5)
-- ══════════════════════════════════════════════
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
