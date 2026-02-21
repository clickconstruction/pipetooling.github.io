-- Add distance_miles to people_labor_jobs for drive cost calculation
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS distance_miles NUMERIC(6, 2);

COMMENT ON COLUMN public.people_labor_jobs.distance_miles IS 'Round-trip distance in miles for drive cost calculation (max 9999.99)';
