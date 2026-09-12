SET lock_timeout = '3s';

-- Bills also go to, follow-up (v2.3362): the Stripe send log records which
-- copies went out with each send, so the Send Email invoice confirm's history
-- answers "did DRF get it" per send — not just "a copy list exists on the
-- bill" (jobs_ledger_invoices.copy_emails, v2.3358) or an entry in the
-- app-wide email_send_log.
--
--   jobs_ledger_invoice_stripe_email_sends.copy_emails
--     the addresses send-stripe-invoice actually delivered a copy to on this
--     send (NULL when none were on the bill or all failed).
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls.
-- Written by send-stripe-invoice (service role) — deploy it after the push.

ALTER TABLE public.jobs_ledger_invoice_stripe_email_sends
  ADD COLUMN IF NOT EXISTS copy_emails text[];

COMMENT ON COLUMN public.jobs_ledger_invoice_stripe_email_sends.copy_emails IS
  'Bills also go to (v2.3362): the copy addresses this Stripe send actually reached (send-stripe-invoice); NULL when none.';
