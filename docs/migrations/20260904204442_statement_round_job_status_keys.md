# 20260904204442_statement_round_job_status_keys.sql (v2.2779)

Third cut of `get_statement_round_for_user` (after `20260904201238` and `20260904202939`): the merged-row key depends on **job status** too.

- `buildBilledStageRows` bundles a job's single billed line into a job-keyed row only when the job's status is `billed`. A `working` job's billed line (a break-off) stays an `invoice` row keyed by the invoice id, however many it has.
- `group_rows` now joins `jobs_ledger` for the status: `row_key = job_id` → job id; status `billed` with one row → job id; else the invoice id.
- Verified read-only against every round GC before the push: zero unmatched rows; RMC's remaining "changed" is a real post-certification change (19 certified rows vs 18 live).

`CREATE OR REPLACE`, additive.
