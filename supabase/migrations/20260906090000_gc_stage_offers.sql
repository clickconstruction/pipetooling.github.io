SET lock_timeout = '3s';

-- v2.2933: the GC sees the stages you offer. Two job-level switches (share
-- stage dates with this GC — off by default on every job; offer the next
-- stage on its own when one passes inspection) and, per stage window, whether
-- it is offered to the GC and which bundle it rides in (several stages, one
-- window, one card). Additive + idempotent.

ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS gc_shares_stage_dates boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS gc_auto_offer_next boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.jobs_ledger.gc_shares_stage_dates IS 'Off by default: nothing about stages reaches the GC portal until this is on AND a stage is offered.';
COMMENT ON COLUMN public.jobs_ledger.gc_auto_offer_next IS 'When a stage passes inspection, offer the next one to the GC without asking.';

ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS offered_to_gc boolean NOT NULL DEFAULT false;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS offered_to_gc_at timestamptz;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS bundle_id uuid;
COMMENT ON COLUMN public.job_stage_windows.bundle_id IS 'Stages offered together share one bundle id: one card on the GC portal, one window, withdrawn as one.';
CREATE INDEX IF NOT EXISTS job_stage_windows_offered_idx ON public.job_stage_windows (job_id) WHERE offered_to_gc;
