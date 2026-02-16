ALTER TABLE public.people_labor_jobs
ADD COLUMN IF NOT EXISTS job_date DATE DEFAULT NULL;

COMMENT ON COLUMN public.people_labor_jobs.job_date IS 'Optional job date. When set, used for display in Ledger; otherwise created_at is used.';
