-- Optional link from a job to the source bid proposal (job-centric, parallel to project_id).

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.jobs_ledger.bid_id IS
  'Optional linked bid proposal for this job (e.g. won bid). Distinct from estimates.job_ledger_id.';

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_bid_id ON public.jobs_ledger (bid_id)
  WHERE bid_id IS NOT NULL;
