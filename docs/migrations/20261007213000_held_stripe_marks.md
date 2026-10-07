# 20261007213000_held_stripe_marks.sql (2026-10-07, v2.4801)

A check on a Stripe bill holds the Stripe close (`docs/recent-features/v2.4801.md`). Two things:

- **`move_jobs_ledger_payment`** (replaced in full): a Stripe-hosted bill's payment is refused only while Stripe holds a record of it — a credit note on the row, or `stripe_invoice_status = 'paid'` — with the same two sentences `remove_jobs_ledger_payment_and_reconcile` answers with. A held check, or a deposit Accounts Receivable matched that Stripe never learned of, moves; it is unlinked from the bill on the way, and the bill reads Billed again when no longer covered (the existing reconcile block, which only ever ran for unsent bills). The sent-bill refusal is unchanged for non-Stripe bills.
- **pg_cron `held-stripe-marks-sweep`**, daily at 11:17 UTC → `POST /functions/v1/close-held-stripe-marks` with `X-Cron-Secret` (PROJECT_URL and CRON_SECRET from vault, the `job-contract-reminders` precedent). Unschedules any earlier copy first. Kill switch without unscheduling: `app_settings.held_stripe_marks_sweep_disabled_v1 = '1'`.

Apply order: deploy the edge function first, then push; the client is safe either way (a held row's Move to job… answers with the old refusal until the RPC lands).
