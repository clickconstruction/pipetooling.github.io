-- Optional per-line unit price and scope text on job Specific Work rows (jobs_ledger_fixtures).
-- Not the Stripe invoice request body field line_description.
ALTER TABLE public.jobs_ledger_fixtures
  ADD COLUMN IF NOT EXISTS line_unit_price numeric(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS line_description text NULL;

COMMENT ON COLUMN public.jobs_ledger_fixtures.line_unit_price IS 'Optional unit price in dollars per line item; does not replace jobs_ledger.revenue.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.line_description IS 'Optional per-line scope or notes; not Stripe invoice line description.';
