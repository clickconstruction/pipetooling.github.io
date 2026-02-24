-- Add Job Plans link field to jobs_ledger (below Google Drive in New/Edit Job form)

ALTER TABLE public.jobs_ledger
ADD COLUMN IF NOT EXISTS job_plans_link TEXT;

COMMENT ON COLUMN public.jobs_ledger.job_plans_link IS 'Link to job plans (e.g. Google Drive).';
