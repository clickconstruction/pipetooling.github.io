-- Add estimator cost fields to cost_estimates table
-- estimator_cost_per_count: per-count-row amount (default $10)
-- estimator_cost_flat_amount: when set, use this flat amount instead of count × per_count

ALTER TABLE public.cost_estimates
  ADD COLUMN IF NOT EXISTS estimator_cost_per_count NUMERIC(10, 2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS estimator_cost_flat_amount NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN public.cost_estimates.estimator_cost_per_count IS 'Per-count-row amount for estimator cost (default $10)';
COMMENT ON COLUMN public.cost_estimates.estimator_cost_flat_amount IS 'When set, use this flat amount instead of count × per_count';
