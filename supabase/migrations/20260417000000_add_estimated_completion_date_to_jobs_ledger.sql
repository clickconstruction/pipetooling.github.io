ALTER TABLE public.jobs_ledger
ADD COLUMN estimated_completion_date DATE;

COMMENT ON COLUMN public.jobs_ledger.estimated_completion_date IS 'Optional estimated date when the job will be completed.';
