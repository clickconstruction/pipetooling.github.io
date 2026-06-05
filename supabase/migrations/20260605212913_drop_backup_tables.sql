-- Drop 3 leftover backup tables flagged `rls_disabled_in_public` (ERROR). They sat in the
-- public schema with RLS off, so PostgREST exposed them to anon/authenticated.
--
-- All 3 are redundant snapshots from the migration squash / crew-lead freeze:
--   _schema_migrations_backup_squash  (pre-squash migration history; also in git + baseline)
--   _freeze_crew_lead_jobs_backup
--   _freeze_crew_lead_bids_backup
-- 0 policies, 0 inbound FKs, no app usage (only auto-generated src/types/database.ts entries).
-- Their CREATE TABLE structure remains recoverable from 20250101000000_baseline.sql + git.
--
-- Dropping removes the data-exposure surface and clears the advisor ERRORs.
-- Idempotent (IF EXISTS); no CASCADE needed (no dependents). Regenerate database types after.

DROP TABLE IF EXISTS public._schema_migrations_backup_squash;
DROP TABLE IF EXISTS public._freeze_crew_lead_jobs_backup;
DROP TABLE IF EXISTS public._freeze_crew_lead_bids_backup;
