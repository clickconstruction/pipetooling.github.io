SET lock_timeout = '3s';

-- Who pays the bill, PR 3 (v2.3349): split by line. On a job whose
-- "Bills go to" is `split`, each work line item carries who pays it, and
-- the Bill tab carves one draft invoice per payer from the untagged rows
-- (the drafts inherit the tag as their bill_to_party). The two-jobs-per-
-- address workaround (14 pairs in 120 days) becomes one job with two bills.
--
--   jobs_ledger_fixtures.bill_to_party
--     NULL      — no tag: the job's rule decides (customer on a split job)
--     customer / gc — this line's payer
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls; the
-- fixtures table's existing RLS governs writes. Discount rows never carry a
-- tag (their shares follow the work they discount).

ALTER TABLE public.jobs_ledger_fixtures
  ADD COLUMN IF NOT EXISTS bill_to_party text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_fixtures_bill_to_party_check') THEN
    ALTER TABLE public.jobs_ledger_fixtures
      ADD CONSTRAINT jobs_ledger_fixtures_bill_to_party_check
      CHECK (bill_to_party IS NULL OR bill_to_party IN ('customer', 'gc'));
  END IF;
END $$;

COMMENT ON COLUMN public.jobs_ledger_fixtures.bill_to_party IS
  'Who pays this line (v2.3349): NULL follows the job rule; customer | gc on a split job. The per-payer carve on the Bill tab groups untagged-by-invoice rows by it.';
