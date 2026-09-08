# 20260908120000_count_job_account_flag_gaps.sql (2026-09-08, v2.3161)

New RPC `count_job_account_flag_gaps()` → one row `(unflagged_jobs int, unflagged_total numeric, no_packet_invoices int, no_packet_total numeric)` for the two Needs You job-account cards:

- **unflagged** — jobs with a share packet on record (`supply_house_job_accounts`) that still carry unpaid, `on_job_account = false` allocated invoices, and those invoices' allocated dollars (`amount × pct / 100`, matching the Job Accounts tab).
- **no_packet** — unpaid `on_job_account = true` invoices allocated to jobs with no share record, and their allocated dollars.

`SECURITY DEFINER`, `STABLE`, gate inside (dev / master_technician / assistant / controller get numbers, everyone else the zero row) — the `count_pending_accounting_label_suggestions` precedent. `REVOKE … FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role` (20260906180000 hygiene). Idempotent (`CREATE OR REPLACE`). No apply-order coupling: the hook returns null on any RPC error, so a client ahead of the push just shows no card.
