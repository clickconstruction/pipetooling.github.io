-- Add is_fixed to people_labor_job_items (like cost_estimate_labor_rows)
-- When is_fixed is true, labor hours = hrs_per_unit (count is ignored)

ALTER TABLE public.people_labor_job_items
ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.people_labor_job_items.is_fixed IS 'When true, labor hours = hrs_per_unit (count ignored).';
