SET lock_timeout = '3s';

-- "Their Word" PR 4: payment terms on the customer — the lever the promise
-- record leads to. One decision per customer, set from Customer review or
-- the Edit customer form, read by New Bid and New Job so the decision follows
-- the customer onto every screen where the office would otherwise say yes by
-- habit. Additive: four nullable-with-default columns on customers; the
-- table's existing RLS (masters own, adopted assistants, estimators) governs
-- who can write them — the client shows the control to office roles only.
--
--   standard                   — bill on completion, chase per the loop (default)
--   deposit_required           — a deposit before work starts on new jobs and bids
--   no_new_work_past_promise   — New Job / New Bid warn while a promise is broken
--   winding_down               — finish open jobs, decline new ones

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS payment_terms_note text,
  ADD COLUMN IF NOT EXISTS payment_terms_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_terms_set_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_payment_terms_check'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_payment_terms_check
      CHECK (payment_terms IN ('standard', 'deposit_required', 'no_new_work_past_promise', 'winding_down'));
  END IF;
END $$;

COMMENT ON COLUMN public.customers.payment_terms IS
  'Their Word PR 4 (v2.3285): the office''s standing decision about this customer — standard | deposit_required | no_new_work_past_promise | winding_down. Shown on New Bid / New Job.';
COMMENT ON COLUMN public.customers.payment_terms_note IS
  'Free-text reason / instruction shown with the terms ("ask Malachi before bidding Ph. 2").';
