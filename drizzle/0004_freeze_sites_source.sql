-- SOURCE SITES ONLY. Keep the old D1 read-only, including across old deployments.
-- Do not apply this migration to the standalone Cloudflare database.
CREATE TRIGGER svoyak_frozen_tournaments_insert BEFORE INSERT ON tournaments BEGIN SELECT RAISE(ABORT, 'Source frozen for migration'); END;
--> statement-breakpoint
CREATE TRIGGER svoyak_frozen_tournaments_update BEFORE UPDATE ON tournaments BEGIN SELECT RAISE(ABORT, 'Source frozen for migration'); END;
--> statement-breakpoint
CREATE TRIGGER svoyak_frozen_tournaments_delete BEFORE DELETE ON tournaments BEGIN SELECT RAISE(ABORT, 'Source frozen for migration'); END;
--> statement-breakpoint
CREATE TRIGGER svoyak_frozen_sessions_insert BEFORE INSERT ON tournament_owner_sessions BEGIN SELECT RAISE(ABORT, 'Source frozen for migration'); END;
--> statement-breakpoint
CREATE TRIGGER svoyak_frozen_sessions_update BEFORE UPDATE ON tournament_owner_sessions BEGIN SELECT RAISE(ABORT, 'Source frozen for migration'); END;
--> statement-breakpoint
CREATE TRIGGER svoyak_frozen_sessions_delete BEFORE DELETE ON tournament_owner_sessions BEGIN SELECT RAISE(ABORT, 'Source frozen for migration'); END;
