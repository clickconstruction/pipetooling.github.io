# 20261006120000_lien_last_work_day.sql (2026-10-06, v2.4676)

The last day of work on a job, set by hand for the lien clocks. The owner (2026-10-05): a billed job with no clock hours is dated from its creation; the office remembers the real day but will not edit hours already paid.

## What it does

- `ALTER TABLE jobs_ledger ADD COLUMN IF NOT EXISTS` × 4: `lien_last_work_on date`, `lien_last_work_note text NOT NULL DEFAULT ''`, `lien_last_work_set_at timestamptz`, `lien_last_work_set_by uuid REFERENCES users(id) ON DELETE SET NULL` — beside the contract-end day the retainage notice keeps (`20260923200000`). Comments on each.
- `CREATE OR REPLACE` of the four lien readers from their newest definitions (`list_gc_unpaid_months` and `list_jobs_owner_to_confirm` from `20260923170000`; `list_lien_notice_months` and `list_lien_affidavit_windows` from `20260924030000`), each with the one rule added:
  - the `jobs` CTE carries `j.lien_last_work_on`;
  - the creation-month fallback (v2.3747) applies only when `lien_last_work_on IS NULL`;
  - a third branch gives the hand-set day's month with `month_source = 'hand'`: in the month lists (`list_gc_unpaid_months`, `list_lien_notice_months`) when no approved session reaches that month; in `list_jobs_owner_to_confirm` (first month) only when the job has no approved session; in `list_lien_affidavit_windows` always, and a new `last_months` wrapper over `last_months_raw` keeps one row per job — the latest month and its source (`max`, `array_agg … ORDER BY last_month DESC`).
- Grants and comments on the four functions are unchanged (`CREATE OR REPLACE` keeps them). Clock sessions are not touched anywhere.

## Verified

- Parsed twice on a throwaway Postgres 15 (stub `jobs_ledger` and `users`, `check_function_bodies = off`): idempotent, four functions created.
- The client (`useLienDeskData.fetchLienClockColumns`, `JobFormLienContractRow`) reads the new columns best-effort, so a client that lands before the push keeps working.
