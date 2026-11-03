SET lock_timeout = '3s';

-- The rate the company charges for an hour (punch list #251, PR 1, v2.6431). The owner, 2026-11-02: "our rate tends to
-- be two hundred and eighty-five dollars per hour", and the hours charged statement prices a worker's recorded hours at
-- it instead of at the wage. The app held no such rate; `revPerHour` and the P&L's revenue per hour are measured, and
-- `cost_estimates.labor_rate` is a bid's crew cost. Two homes, as the card decided: the company's rate in
-- `app_settings` (seeded $285.00, read by Settings → Jobs & dispatch and the statement window), and a job's own rate in
-- `jobs_ledger.hourly_charge_rate`, set from the statement window and Edit Job in PR 2, null until then. Additive: one
-- settings row and one nullable column, no table, no fences, no rewrite.

INSERT INTO public.app_settings (key, value_num)
VALUES ('hourly_charge_rate_v1', 285)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS hourly_charge_rate numeric;

COMMENT ON COLUMN public.jobs_ledger.hourly_charge_rate IS
  'Dollars an hour the customer is charged for a worker''s time on this job (punch list #251). Null = the company''s rate, app_settings hourly_charge_rate_v1. Set from the Hours statement window on the charged basis and from Edit Job (PR 2).';

-- Over zero when set. NOT VALID on purpose: every row is null today, and db push sends a file as one transaction, so a
-- VALIDATE here would scan the table under the ADD COLUMN's lock.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_ledger_hourly_charge_rate_positive' AND conrelid = 'public.jobs_ledger'::regclass
  ) THEN
    ALTER TABLE public.jobs_ledger
      ADD CONSTRAINT jobs_ledger_hourly_charge_rate_positive CHECK (hourly_charge_rate IS NULL OR hourly_charge_rate > 0) NOT VALID;
  END IF;
END $$;
