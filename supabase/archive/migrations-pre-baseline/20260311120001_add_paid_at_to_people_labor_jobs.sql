-- Add paid_at to people_labor_jobs for Sub Labor Mark Paid feature
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.people_labor_jobs.paid_at IS 'When this sub labor job was marked paid. NULL = unpaid.';
