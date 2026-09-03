SET lock_timeout = '3s';

-- Job-account flag on supply house invoices: marks an invoice as riding on the
-- supply house's job account — the account the house opens against the property
-- owner (setup packet flow: v2.1605 "Share with supply house"). We still pay
-- the house as usual; the flag records that if the invoice ever goes unpaid,
-- the house's recourse is the owner, not us. Risk classification only — no AP
-- total, job cost rollup, or payment flow excludes flagged invoices.
ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS on_job_account boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.supply_house_invoices.on_job_account IS
  'Invoice is on the supply house''s job account for the allocated job: an unpaid balance is the property owner''s exposure, not ours. Display/risk classification only — never excluded from AP totals or job costs.';
