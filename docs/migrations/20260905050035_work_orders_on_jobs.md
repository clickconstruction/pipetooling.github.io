# 20260905050035_work_orders_on_jobs

**Work Orders tab, PR 1 (v2.2814)** — a work order can anchor to a job before any sheet or step exists; unpriced drafts; record ids; signing creates the sheet.

## What it does

- `step_commitments.job_id` (→ `jobs_ledger`, CASCADE) as a third anchor; `step_commitments_anchor_check` becomes `step_id OR labor_job_id OR job_id`. Index on `job_id`. Partial unique `step_commitments_job_person_live_uniq` on `(job_id, person_id)` for job-only rows (`step_id IS NULL AND labor_job_id IS NULL AND status <> 'cancelled'`).
- `amount` drops NOT NULL; `step_commitments_amount_when_sent_check` (`amount IS NOT NULL OR status = 'draft'`) — an assistant can draft the sub and scope and leave the price to the master.
- `record_id text` + partial unique index; `next_work_order_record_id(p_job_id)` returns `WO-<hcp_number>-NN` (NN = existing ids for that job + 1; a job without a number uses the first 6 hex of its id).
- Back-fill: sheet-anchored rows get `job_id` from `jobs_ledger.hcp_number = people_labor_jobs.job_number` (newest job wins).
- `can_access_sub_work_order(step, sheet, job)` replaces the 2-arg helper (dropped after the four policies are recreated on the new one); job rows follow the sheet rule (office set + superintendent).
- `create_sheet_for_work_order(p_commitment_id)` — SECURITY DEFINER, office set **or service role** (`request.jwt.claim.role`): for an accepted/approved/settled job-anchored order with no sheet, inserts `people_labor_jobs` (master from the job, address/number from the job, `job_date = app_today()`, `project_id`/`step_id` carried), one fixed `people_labor_job_items` line = amount labelled with the record id, the assignee junction, and links `labor_job_id`. Idempotent (returns the existing sheet). Returns `{ok, labor_job_id, created}` or `{error}`.
- `respond_to_work_order` (same signature): job-anchored orders name the job (`hcp · address`) and, on accept, call `create_sheet_for_work_order`; the result carries `job_id` and the created `labor_job_id`.
- `settle_step_commitment` (same signature): a job-anchored order with no sheet is approved, gets its sheet via `create_sheet_for_work_order`, then settles; NULL amount raises. Step orders unchanged (and now use `app_today()`).
- Ends with both read-only appliers and the twin fence.

## Order

Push before PR 2's client (the assembler inserts `job_id` rows and NULL amounts). `submit-sub-portal` redeploys with PR 2 so the sub's signature creates the sheet from the portal path too; until then a signed job-anchored order is created by the office via Mark accepted → Settle.

## Rollback

Cancel or delete job-only rows (`step_id IS NULL AND labor_job_id IS NULL`), set any NULL amounts, then re-add the NOT NULL and the old anchor CHECK. The helper's 2-arg form is gone; recreate it from 20260904211244 if needed.
