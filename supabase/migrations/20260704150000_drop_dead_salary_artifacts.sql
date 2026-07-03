-- Salaried-area cleanup (audited 2026-07-04):
-- * salary_force_close_open_sessions_after_shift(): superseded — its fragment-close
--   behavior moved inline into salary_sync_one_user_clock_sessions (20260515092032);
--   zero callers in DB (pg_depend) and client.
-- * clock_sessions.salary_split_derived: written only by the pre-consolidation split
--   logic (7 rows, all 2026-04-21..24); never read by any DB function or client code.

DROP FUNCTION public.salary_force_close_open_sessions_after_shift(uuid, date, timestamptz);
ALTER TABLE public.clock_sessions DROP COLUMN salary_split_derived;
