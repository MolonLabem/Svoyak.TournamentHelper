ALTER TABLE tournaments ADD COLUMN management_key_hash TEXT;
--> statement-breakpoint
CREATE TABLE tournament_owner_sessions (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  session_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(tournament_id,session_hash)
);
--> statement-breakpoint
CREATE INDEX tournament_owner_sessions_lookup ON tournament_owner_sessions(session_hash,expires_at);
