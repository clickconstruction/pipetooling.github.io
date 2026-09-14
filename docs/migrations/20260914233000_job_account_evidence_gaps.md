# 20260914233000_job_account_evidence_gaps.sql (2026-09-14, v2.3430)

Job accounts at the counter, PR 4 — **the evidence rule** behind the Needs You card, the Pipeline Fix-ups chip and the Job Accounts tab filter.

- **`list_job_account_evidence_gaps()`** → every `(job, supply house)` pair where the house has `job_accounts = 'expects'`, an invoice is allocated to the job at that house or a PO Generator code was minted for the pair in the last **180 days**, and no `job_supply_house_accounts` row is `open` or `not_needed` for the pair. Columns: job, house (id + name), invoice count, allocated and unpaid dollars (`amount × pct / 100`, matching the Job Accounts tab), PO count, the latest evidence timestamp, and the house's job-accounts rep (name, phone). Biggest allocated dollars first.
- **`count_job_account_evidence_gaps()`** → one row over the list: distinct jobs, pairs, allocated dollars, the house names joined.

Both `SECURITY DEFINER`, `STABLE`, gated inside on `is_office_staff()` (dev, master_technician, assistant, controller) — everyone else gets the empty answer. `REVOKE … FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`. Idempotent (`CREATE OR REPLACE`). The v2.3161 `count_job_account_flag_gaps()` stays in the database but the client no longer calls it.

Depends on `20260914210000_job_supply_house_accounts.sql`. Apply order: push any time after the client merge — the hook treats an RPC error as "no card", and the tab treats it as "no filter rows".
