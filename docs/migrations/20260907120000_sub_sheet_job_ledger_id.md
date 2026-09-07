# 20260907120000 — people_labor_jobs.job_ledger_id: sub sheets link to jobs by id

v2.3055. `job_number` is a free-text `varchar(10)` and every consumer matched it to `jobs_ledger.hcp_number` by text, each with its own trim / case / click-number rule (the census is in [`to-dos/sub-sheet-job-link-followups.md`](../../to-dos/sub-sheet-job-link-followups.md)). This adds the real link and keeps the number as display text.

- **Column** `job_ledger_id uuid REFERENCES jobs_ledger(id) ON DELETE SET NULL` + index. Nullable on purpose: `settle_step_commitment` mints step-anchored sheets on projects with no single job.
- **`resolve_job_ledger_id_by_number(text)`** — the one number → id resolver (trimmed, case-insensitive, HCP before click number, newest job wins, empty never matches; SECURITY DEFINER + `row_security off` so the link never depends on the writer's `jobs_ledger` visibility). Grants: authenticated, service_role.
- **BEFORE INSERT OR UPDATE trigger `people_labor_jobs_link_job_ledger_biu`**: a number-only writer that changes `job_number` moves the link with it; a row with no link and a number gets resolved (heals sheets written before their job existed, on their next write); a link with no number gets the job's effective number as display text. A writer that sets `job_ledger_id` itself is never second-guessed. To unlink a sheet, clear both columns.
- **Back-fill** of every sheet whose number resolves. No feed lines: the stage → activity trigger is `WHEN (OLD.stage IS DISTINCT FROM NEW.stage)`, the assignee sync is `UPDATE OF assigned_to_name`.
- **`create_sheet_for_work_order`** now writes `job_ledger_id` from the work order's job (and the effective number, so a click-only job no longer mints a numberless sheet). Body otherwise as in `20260906010000`.
- **`people_labor_jobs_stage_to_activity()`** and **`superintendent_can_access_sub_work_order()`** read the link first and fall back to the number match only when it is null (the access helper is a security consumer of the old text match).

Additive, idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP TRIGGER IF EXISTS`). After push: `npm run gen-types:linked` (the column and FK were hand-typed in `src/types/database.ts` for this PR). Client readers that still match by number are listed in the follow-ups file.
