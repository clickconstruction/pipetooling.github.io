SET lock_timeout = '3s';

-- Share this bill, PR 3 (v2.3377): a GC's card says once whether they see
-- their customers' bills by default.
--
-- Some builders should see, as a rule, which of the homeowners they sent us
-- still owe for repairs — Done Right Foundation and its repair jobs. Saying
-- it on each job (v2.3376's Show <GC> row) would be one tick per job, ~200 a
-- year for Done Right. This flag is the same shape as gc_pays_by_default
-- (v2.3353): a fact about the customer that starts every NEW job's memory
-- (jobs_ledger.show_bills_to_other_party) on when that customer is the
-- job's GC and not its customer row. Existing jobs are not touched; a job's
-- own memory and each bill's stamp still decide.
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls;
-- customers' existing RLS governs writes.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sees_customer_bills boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customers.sees_customer_bills IS
  'Share this bill (v2.3377): when this customer is the GC on a NEW job (and not its customer row), the job starts with show_bills_to_other_party = true, so Bill Customer''s "Show it on their statement" tick starts ticked. Existing jobs are not touched.';
