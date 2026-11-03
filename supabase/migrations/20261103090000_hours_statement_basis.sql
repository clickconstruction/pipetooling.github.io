SET lock_timeout = '3s';

-- The hours statement's basis (punch list #251, PR 2): a saved statement says whether it prices the days at what the
-- worker was paid or at what the customer is charged, and keeps the rate and the words it was charged at. Additive and
-- idempotent. The gate needs no change: a charged row carries with_pay = false, and can_touch_hours_statement(with_pay)
-- already admits every office role to a row with the pay left off.

ALTER TABLE public.hours_statements
  ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS charge_rate numeric,
  ADD COLUMN IF NOT EXISTS charge_words text;
COMMENT ON COLUMN public.hours_statements.basis IS
  'paid: the days at the wage with the pay reports; charged: the days as crew-days at the rate card or the job''s rule, no pay on the paper. Punch list #251.';
COMMENT ON COLUMN public.hours_statements.charge_rate IS
  'On the charged basis, the headline rate the paper was charged at (the job''s shape or flat rate, else the master-with-a-helper row), dollars for the crew''s hour.';
COMMENT ON COLUMN public.hours_statements.charge_words IS
  'On the charged basis, the words under the signature: how the paper was charged (the job''s rule and the rate).';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hours_statements_basis_check') THEN
    ALTER TABLE public.hours_statements
      ADD CONSTRAINT hours_statements_basis_check CHECK (basis IN ('paid', 'charged')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hours_statements_charged_no_pay') THEN
    ALTER TABLE public.hours_statements
      ADD CONSTRAINT hours_statements_charged_no_pay CHECK (basis <> 'charged' OR with_pay = false) NOT VALID;
  END IF;
END $$;
