# 20261103080000_job_charge_adjustments.sql (2026-11-03, v2.6445)

Adjustments on a job's charges (punch list #254, PR 3): the table behind the Charges window's changes on top of the record.

- **`job_charge_adjustments`** — `job_id` → `jobs_ledger` (cascade), `kind` (day_shape · day_off · line_pass_through · line_off), `target` (a YYYY-MM-DD for a day, the material line's id for a line), `shape` (required for `day_shape`, one of the six crew shapes), `reason`, `made_by`, `created_at`, `reverted_at` / `reverted_by`. A partial index on `job_id` where not reverted.
- **RLS**: SELECT, INSERT (with `made_by = auth.uid()`) and UPDATE for `has_payroll_access()` — a dev, the controller, a pay-approved master, the roles that see a job's profit on the Job Summary. No DELETE: reverting stamps the row so the log keeps what was tried.
- **Fences**: the three calls at the end, so a read-only account and a digital twin cannot write it.

**Apply order**: the Job Summary's Charges column and the Charges window read the table; before the push the read answers a refusal, which the window shows with its reason and no Retry, and the column reads the record alone. Push right after the merge.
