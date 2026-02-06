-- Add driving cost calculation fields to cost_estimates table
-- These fields allow calculation of driving costs based on total hours, distance, and configurable rates

ALTER TABLE public.cost_estimates 
  ADD COLUMN IF NOT EXISTS driving_cost_rate NUMERIC(10, 2) DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS hours_per_trip NUMERIC(10, 2) DEFAULT 2.0;

COMMENT ON COLUMN public.cost_estimates.driving_cost_rate IS 'Rate per mile for driving cost calculation (default $0.70)';
COMMENT ON COLUMN public.cost_estimates.hours_per_trip IS 'Number of man hours per trip for driving cost calculation (default 2.0)';
