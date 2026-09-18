# 20260917180000 — jobs_ledger_payment_events + move_jobs_ledger_payment (v2.3576)

Customer payments: move one to the right job, with a trace — PR 3 of the payment move/remove train (`to-dos/sub-payment-move-remove/`; v2.3562 did the sub sheets).

- **Table `jobs_ledger_payment_events`** — `kind` (`moved` only today), `payment_id`, `from_job_id` / `to_job_id` (→ `jobs_ledger`, cascade), a snapshot (`amount`, `paid_on`, `sent_on`, `note`, `payment_type`, `reference_number`, the unsent `invoice_id` it was unlinked from, `mercury_transaction_id`, `sequence_order`), `reason`, the actor, `created_at`. RLS: `is_office_staff()` reads and inserts.
- **`move_jobs_ledger_payment(p_payment_id, p_to_job_id, p_reason)` → jsonb** — `SECURITY DEFINER` with the same job-access check `remove_jobs_ledger_payment_and_reconcile` makes, on both jobs, and the same role list plus `controller`. Refuses a payment already on the destination, a missing destination, a Stripe-hosted bill, and **a bill that was sent** (*A sent bill counted this payment — unlink it from the bill first*). Otherwise: re-points the row (same id, amount, dates, memo, type, reference and bank-deposit link; last slot on the destination; `invoice_id` cleared), writes the event, reconciles the unsent bill it left (paid → billed when the applied sum no longer covers it) and the source job's status (paid → billed via `update_job_status` when its revenue is no longer covered), and returns both jobs' `payments_made`.
- **Nothing new for the caches**: `recompute_jobs_ledger_payments_made_tr` (B3) already recomputes both jobs on a `job_id` change, and the AR income label keys on `mercury_transaction_id`, which the move keeps.
- Ends with the read-only and twin write blocks (new table).

Push: `supabase db push` from a checkout at `main` after the client deploy; then regenerate types.
