-- Add bid_id for pre-job time tracking. Mutually exclusive with job_ledger_id.
ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clock_sessions.bid_id IS 'Optional bid this session is for (pre-job work). Mutually exclusive with job_ledger_id.';

ALTER TABLE public.clock_sessions
  ADD CONSTRAINT clock_sessions_job_or_bid_not_both
  CHECK (NOT (job_ledger_id IS NOT NULL AND bid_id IS NOT NULL));
