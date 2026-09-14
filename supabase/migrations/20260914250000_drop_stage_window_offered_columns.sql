SET lock_timeout = '3s';

-- Stage Plan residuals item 2: retire the per-window "offered to the GC"
-- columns (v2.2933). Since Stage Plan PR 5 (v2.3132) the portal reads the
-- eye on the line item (jobs_ledger_fixtures.shared_with_gc); nothing reads
-- offered_to_gc / offered_to_gc_at / bundle_id, and the client no longer
-- writes them. Deploy the client BEFORE pushing this — the old client still
-- selects and writes these columns.
-- Idempotent: every statement is IF EXISTS.

DROP INDEX IF EXISTS public.job_stage_windows_offered_idx;
ALTER TABLE public.job_stage_windows DROP COLUMN IF EXISTS offered_to_gc;
ALTER TABLE public.job_stage_windows DROP COLUMN IF EXISTS offered_to_gc_at;
ALTER TABLE public.job_stage_windows DROP COLUMN IF EXISTS bundle_id;
