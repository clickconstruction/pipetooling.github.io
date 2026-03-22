-- Add cost_to_company to person_licenses (optional dollar amount, e.g. renewal fee)

ALTER TABLE public.person_licenses
  ADD COLUMN IF NOT EXISTS cost_to_company NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN public.person_licenses.cost_to_company IS 'Optional cost to company in dollars (e.g. renewal fee).';
