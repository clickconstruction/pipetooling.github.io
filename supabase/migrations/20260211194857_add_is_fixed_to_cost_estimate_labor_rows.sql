-- Add is_fixed to cost_estimate_labor_rows for fixed (non-count-multiplied) labor hours
ALTER TABLE public.cost_estimate_labor_rows
  ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cost_estimate_labor_rows.is_fixed IS 'When true, total hours = rough_in + top_out + trim_set (not multiplied by count).';
