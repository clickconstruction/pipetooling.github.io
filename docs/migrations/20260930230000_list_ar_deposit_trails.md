# 20260930230000_list_ar_deposit_trails.sql (2026-09-30, v2.4277)

Accounts Receivable's deposit rows gain a trail line — *→ #650 ATI Schertz today 4:02 PM by Taunya · was #878 Take 5- Seguin 9/29* — and this is its read (punch list #74 PR 2 of 4).

- **`list_ar_deposit_trails(p_tx_ids uuid[])`** — new, read-only (`STABLE SECURITY DEFINER`), gated like `list_mercury_transactions_for_bank_payments` (dev / master / assistant / controller / primary) and, per job, by the job-access clause of `list_ar_allocations_for_mercury_transaction`. Returns one row per payment each deposit ever carried: the live ones from `jobs_ledger_payments` (`live = true`) and the removed ones from `deleted_records_archive` (`table_name = 'jobs_ledger_payments'`, not restored), each with the job's number and name, the bill, the amount, `applied_at` (the payment's `created_at`), `applied_by` (the actor on the job history's *Payment* event for that payment — null when nobody was signed in), and for removed ones `removed_at` / `removed_by` from the archive. A job the archive lost comes back with null job fields. At most 1,000 ids a call; the client sends 500.
- **`idx_deleted_records_archive_payment_tx`** — an expression index on `row_data->>'mercury_transaction_id'` for archived payments; the archive had nothing keyed on the deposit.

The removal time is read from the archive, not the history, so this does not wait on `20260930213000_payment_removed_when_removed` (not on prod as of this writing).

Apply order: **client first**. The modal calls the RPC with `as never` and treats "could not find the function" as "no trails yet" — nothing on the row until the push. Then `supabase db push` from a main checkout, then the gen-types PR.
