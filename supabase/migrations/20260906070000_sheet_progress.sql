SET lock_timeout = '3s';

-- v2.2931: their part, their percent. A sub reports how far along their stage
-- is from the portal (0 / 25 / 50 / 75; 100 is the existing "my work here is
-- done" flow). Lives on the sheet so the office reads it where the sheet is
-- read (Subs → Work, the story, the pay run); mirrored onto the project step's
-- percent_complete when the sheet is step-anchored. Additive + idempotent.

ALTER TABLE public.people_labor_jobs ADD COLUMN IF NOT EXISTS progress_pct integer;
ALTER TABLE public.people_labor_jobs ADD COLUMN IF NOT EXISTS progress_note text;
ALTER TABLE public.people_labor_jobs ADD COLUMN IF NOT EXISTS progress_at timestamptz;
ALTER TABLE public.people_labor_jobs ADD COLUMN IF NOT EXISTS progress_source text;

ALTER TABLE public.people_labor_jobs DROP CONSTRAINT IF EXISTS people_labor_jobs_progress_pct_check;
ALTER TABLE public.people_labor_jobs
  ADD CONSTRAINT people_labor_jobs_progress_pct_check CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100));
ALTER TABLE public.people_labor_jobs DROP CONSTRAINT IF EXISTS people_labor_jobs_progress_source_check;
ALTER TABLE public.people_labor_jobs
  ADD CONSTRAINT people_labor_jobs_progress_source_check CHECK (progress_source IS NULL OR progress_source IN ('portal', 'office'));

COMMENT ON COLUMN public.people_labor_jobs.progress_pct IS 'How far along the sub says their part is (0–100). 100 = they said done (the sheet moves to walkthrough).';
