# 20260912050224_stripe_email_sends_copy_emails.sql (2026-09-12, v2.3362)

Bills also go to, follow-up (fragment `docs/recent-features/v2.3362.md`): `jobs_ledger_invoice_stripe_email_sends.copy_emails text[]` — the copy addresses `send-stripe-invoice` actually delivered to on that send (NULL when none). Read by the Send Email invoice confirm's history list. Additive, idempotent; no CREATE TABLE; service-role writer. Push before deploying `send-stripe-invoice` (the insert names the column).
