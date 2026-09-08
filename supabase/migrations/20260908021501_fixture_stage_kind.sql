SET lock_timeout = '3s';

-- Stage Plan PR 1 (to-dos/stage-plan): the line item is the stage. Order and
-- kind live on the line item itself — the Bill tab sets them, the Edit tab
-- reads them, the GC portal shows them, draws follow them.
--
--   stage_kind    'order'  a numbered stage: waits for the one above it to
--                          pass inspection; becomes a draw when it passes
--                 'any'    its own dates, no place in the line; bills when done
--                 NULL     a plain line item — not a stage; rides the final draw
--   shared_with_gc  the eye: this row shows on the GC's portal (never a sub's
--                   name — the portal speaks in the company's voice)
--
-- Owner decisions (2026-09-07): a hand-added line item defaults to Any time;
-- every existing line item becomes Any time (no job is put in order by this
-- migration — a user flips rows to Order when they want to). Additive and
-- idempotent; no new table, so no read-only fence appliers.
--
-- Apply order: this file lands first, the client that reads/writes the
-- columns (PR 2) follows. Until PR 2 the Job form's save (delete + reinsert of
-- the job's fixtures) resets both columns to their defaults on every save;
-- the shared_with_gc backfill below is re-run by the PR that starts reading it.

ALTER TABLE public.jobs_ledger_fixtures ADD COLUMN IF NOT EXISTS stage_kind text DEFAULT 'any';
ALTER TABLE public.jobs_ledger_fixtures DROP CONSTRAINT IF EXISTS jobs_ledger_fixtures_stage_kind_check;
ALTER TABLE public.jobs_ledger_fixtures
  ADD CONSTRAINT jobs_ledger_fixtures_stage_kind_check CHECK (stage_kind IS NULL OR stage_kind IN ('order', 'any'));
ALTER TABLE public.jobs_ledger_fixtures ADD COLUMN IF NOT EXISTS shared_with_gc boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs_ledger_fixtures.stage_kind IS
  'Stage Plan: ''order'' = numbered stage (waits on the one above, draws when it passes inspection); ''any'' = its own dates, bills when done (the default); NULL = a plain line item, not a stage.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.shared_with_gc IS
  'Stage Plan: the eye — this line item shows on the GC portal''s stage sequence. The job-level jobs_ledger.gc_shares_stage_dates switch is the master.';

-- Backfill: every existing line item is Any time.
UPDATE public.jobs_ledger_fixtures SET stage_kind = 'any' WHERE stage_kind IS NULL;

-- Backfill: a line item whose window was offered to the GC is shared.
UPDATE public.jobs_ledger_fixtures f
   SET shared_with_gc = true
  FROM public.job_stage_windows w
 WHERE w.fixture_id = f.id
   AND w.offered_to_gc
   AND NOT f.shared_with_gc;
