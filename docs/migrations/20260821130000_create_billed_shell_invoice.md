# 20260821130000_create_billed_shell_invoice.sql (2026-08-20, v2.1933)

`create_billed_shell_invoice(p_job_id uuid, p_billed_on date)` — the Fix bill
lines repair for Billed no-bill-line shells (v2.1931's cohort):

- inserts the job's missing billed invoice line for the full open remainder
  (`revenue − payments_made − Σ ready_to_bill amounts`), with `billed_at` =
  the supplied date (Chicago noon; the `jobs_ledger_invoices_billed_at_fn`
  trigger COALESCEs a provided value, so the backdate sticks) and
  `estimated_bill_date` = the same day;
- guards: dev / master_technician / `is_assistant()` writer gate; date
  required and not in the future; job must exist, be `status = 'billed'`,
  and have NO existing billed line (the shell definition); amount must be
  positive; `SELECT … FOR UPDATE` on the job row against double-clicks.

Function-only, idempotent (`CREATE OR REPLACE`). Client fails soft until
applied (the modal shows the RPC error inline per row).
