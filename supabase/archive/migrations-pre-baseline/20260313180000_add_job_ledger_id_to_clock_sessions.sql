-- Optional job link for clock sessions. Used for job-level hour reporting.
ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS job_ledger_id UUID REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clock_sessions.job_ledger_id IS 'Optional job this session is for. Used for job-level hour reporting.';
