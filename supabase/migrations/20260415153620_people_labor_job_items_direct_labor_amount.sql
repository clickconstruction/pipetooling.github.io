-- Optional flat line cost for Sub Labor when hours/rate are not used (simple entry mode).

ALTER TABLE public.people_labor_job_items
  ADD COLUMN IF NOT EXISTS direct_labor_amount numeric(12, 2) NULL;

COMMENT ON COLUMN public.people_labor_job_items.direct_labor_amount IS
  'When NOT NULL, line labor cost is this dollar amount; count, hrs_per_unit, is_fixed, and labor_rate are ignored for costing.';
