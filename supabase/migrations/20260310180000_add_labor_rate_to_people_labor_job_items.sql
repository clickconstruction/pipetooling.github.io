-- Add labor_rate per line item to people_labor_job_items
-- Enables per-row labor rate in the Specific Work (Line Items) table

ALTER TABLE public.people_labor_job_items
ADD COLUMN IF NOT EXISTS labor_rate NUMERIC(10, 2) NULL;

COMMENT ON COLUMN public.people_labor_job_items.labor_rate IS 'Labor rate ($/hr) for this line item; NULL falls back to job-level rate for backwards compat.';

-- Backfill: copy job's labor_rate to existing items
UPDATE public.people_labor_job_items i
SET labor_rate = j.labor_rate
FROM public.people_labor_jobs j
WHERE i.job_id = j.id
  AND i.labor_rate IS NULL
  AND j.labor_rate IS NOT NULL;
