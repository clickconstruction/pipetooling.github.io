# 20260916060000_record_job_tip_from_deposit.sql (2026-09-16, v2.3496)

Accounts Receivable: record a bank deposit's unapplied remainder as a tip on the job that earned it (`to-dos/money-with-no-bill/`). One new function; **no table, column or constraint changes**.

- **`record_job_tip_from_deposit(p_mercury_transaction_id uuid, p_job_id uuid, p_amount numeric, p_payment_type text DEFAULT NULL, p_note text DEFAULT NULL) RETURNS jsonb`** (new, SECURITY DEFINER, `search_path = public`). Three writes in one transaction:
  1. a `jobs_ledger_fixtures` row named `Tip` — `count` 1, positive `line_unit_price`, `invoice_id` NULL, **`line_kind` left at its `work` default**;
  2. `jobs_ledger.revenue` **recomputed** from the job's own lines (named rows × price plus un-voided hazmat fees — the same expression `apply_job_discount` uses), never incremented;
  3. a **job-level** `jobs_ledger_payments` row (`invoice_id` NULL) carrying `mercury_transaction_id`, `reference_number = mercury_id`, and `paid_on` = the deposit's posted Chicago day.
  
  Returns `{ok, fixture_id, payment_id, revenue, remaining_after}`, or `{error}` for every refusal (the modal reads the same envelope shape the allocation RPC uses).

- **Gates copied from `apply_mercury_bank_payment_allocations`, not from `apply_job_discount`**, so the function grants no capability that Accounts Receivable does not already have: signed in; role in `dev · master_technician · assistant · primary` (controller is excluded there too); the same six-way job-access check (`master_user_id`, `is_dev()`, role `primary`, either direction of `master_assistants`, `assistants_share_master`).

- **Cap and race.** The Mercury row is taken `FOR UPDATE`, then `abs(amount) − Σ jobs_ledger_payments.amount on that transaction` is the ceiling, with the same `0.0001` tolerance the allocation RPC uses. Without the lock two people adding a tip at once would both pass.

- **Grants.** `REVOKE ALL … FROM PUBLIC, anon`; `GRANT EXECUTE … TO authenticated, service_role`.

## What is deliberately not here

- No new `line_kind` value: the CHECK admits only `work`/`discount` and 36 client files branch on it.
- No custom activity event: `jobs_ledger_fixtures_to_activity_ins` already writes *"Specific work added: Tip"* (it skips only `line_kind = 'discount'`) and `jobs_ledger_payments_to_activity_ins` writes the payment.
- `jobs_ledger.payments_made` is never written — the B3 trigger `jobs_ledger_payments_recompute_pm` owns it.
- `jobs_ledger.status` is not touched: a tip raises revenue and payments by the same amount, so coverage cannot change.

Known downstream effect: the payment insert fires `enqueue_payment_made_email_ai`, queuing a `paid_job_email_queue` row whose recipients are three staff user ids — an internal notice, nothing to the customer.

`CREATE OR REPLACE`, so re-running is safe. Apply order: after the client merge (the client hand-carries the function's type until `npm run gen-types:linked` follows the push, and shows a plain "not live in the database yet" message if pressed in the gap).
