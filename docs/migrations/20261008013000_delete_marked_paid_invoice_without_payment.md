# 20261008013000_delete_marked_paid_invoice_without_payment.sql (2026-10-07, v2.4839)

A bill stamped paid with no payment behind it gets a door off the job ([v2.4839](../recent-features/v2.4839.md)).

1. **`delete_marked_paid_invoice_without_payment(p_invoice_id)`**: SECURITY DEFINER, the send-back's roles (`dev`, `master_technician`, `assistant`, `controller`, `primary`) and its job gate (the job's master, a dev, primary, the office cohort, an assistant sharing the master). Refuses a row whose status is not `paid` (*Use Delete draft or Send back*), one a `jobs_ledger_payments` row references (*Unlink it under the bill first*), and one with a `stripe_invoice_id` (*Stripe holds a paid mark on this bill. Undo it under the bill first.*). Deletes the row and returns `{ ok, deleted }`, or `{ ok: false, error }`. Executable by `authenticated` only.

Locks: `CREATE OR REPLACE FUNCTION` only; `SET lock_timeout = '3s'` first. No CREATE TABLE, so no fence calls. Idempotent.

## Order

Merge, `supabase db push`. The client calls the RPC only from the new menu item, so deploy order does not matter; until the push the item answers with the RPC-missing error.
