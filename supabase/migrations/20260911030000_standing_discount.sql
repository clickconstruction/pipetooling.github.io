SET lock_timeout = '3s';

-- Discount tools round two, PR 3 (v2.3272): a standing discount per customer.
--
-- The rate lives on the customer; the decision lives on the job. Nothing is
-- ever inserted by itself: the app OFFERS the standing discount on New Job,
-- on the Bill tab of a job with no discount yet, and inside Bill Customer,
-- until someone applies it (an ordinary discount row + the ordinary trail
-- event) or waves it off for that job (standing_discount_waived_at).
-- Additive; the old client ignores all three columns.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS standing_discount_pct numeric(7,4),
  ADD COLUMN IF NOT EXISTS standing_discount_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_standing_discount_pct_check'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_standing_discount_pct_check
      CHECK (standing_discount_pct IS NULL OR (standing_discount_pct > 0 AND standing_discount_pct <= 100));
  END IF;
END $$;

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS standing_discount_waived_at timestamptz;

COMMENT ON COLUMN public.customers.standing_discount_pct IS
  'Standing discount (v2.3272): percent offered on every new job and bill for this customer until applied or waved off on that job. NULL = none.';
COMMENT ON COLUMN public.customers.standing_discount_reason IS
  'Standing discount (v2.3272): the reason preset (Negotiated, Referral, Repeat customer, Goodwill, Price match) the offered row is named after.';
COMMENT ON COLUMN public.jobs_ledger.standing_discount_waived_at IS
  'Standing discount (v2.3272): set when the office waved the customer''s standing discount off for this job ("not on this job").';
