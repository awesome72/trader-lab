ALTER TABLE "trades" ADD CONSTRAINT "trades_replay_session_id_replay_sessions_id_fk"
  FOREIGN KEY ("replay_session_id") REFERENCES "replay_sessions"("id");
--> statement-breakpoint
CREATE INDEX "trades_replay_session_id_idx" ON "trades" ("replay_session_id");
