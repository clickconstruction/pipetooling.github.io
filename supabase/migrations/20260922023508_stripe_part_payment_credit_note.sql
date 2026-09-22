SET lock_timeout = '3s';

-- v2.3695 — part cash on a Stripe bill. A cash/check payment for PART of a
-- Stripe bill is recorded as a Stripe credit note on the open invoice (the
-- pay link then asks for the rest) plus this ledger row, written by the
-- record-stripe-invoice-out-of-band-payment function. The row remembers its
-- credit note so "Undo part payment" can void exactly that note.
ALTER TABLE public.jobs_ledger_payments
  ADD COLUMN IF NOT EXISTS stripe_credit_note_id text;

COMMENT ON COLUMN public.jobs_ledger_payments.stripe_credit_note_id IS
  'v2.3695: the Stripe credit note (cn_…) that recorded this part payment on an open Stripe bill; voided when the payment is undone. NULL for every other payment.';
