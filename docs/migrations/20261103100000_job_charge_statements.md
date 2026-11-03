# 20261103100000_job_charge_statements.sql (2026-11-03, v2.6447)

The saved Statements of charges (punch list #254, PR 2): a job-level paper for a period, kept with its snapshot so it prints again as it read.

- **`job_charge_statements`** — `record_id` (`SC-<job number>-<n>`, unique), `job_ledger_id` → `jobs_ledger` (cascade), `period_start` / `period_end` (end on or after start), `snapshot` (the window's read: sessions, lines, the rate card, the rule, the markup, the adjustments and the revenue as they stood, with the period, the job's words, who prepared it and when), `labor_usd` / `materials_usd` / `charges_usd` / `premium_usd` (the figures beside it, for the section's row), `state` (draft · printed), `prepared_by`, `prepared_at`, `created_at`, `updated_at`. An index on `(job_ledger_id, prepared_at desc)`.
- **RLS**: SELECT, INSERT (with `prepared_by = auth.uid()`) and UPDATE for `can_touch_hours_statement(false)` — a dev or the controller, the hours statement's own gate as v2.6450 draws it; the customer copy carries no pay, but the paper is the office's; DELETE only while the row is a draft.
- **Fences**: the three calls at the end, so a read-only account and a digital twin cannot write it.

**Apply order**: the section reads the table and the window writes it; before the push the section shows the refusal with its reason and a Save is refused with its reason. Push right after the merge.
