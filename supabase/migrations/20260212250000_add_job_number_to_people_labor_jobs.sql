ALTER TABLE public.people_labor_jobs
ADD COLUMN IF NOT EXISTS job_number VARCHAR(10) DEFAULT NULL;

COMMENT ON COLUMN public.people_labor_jobs.job_number IS 'Optional job number, max 10 characters. Shown in Labor form and Ledger.';
