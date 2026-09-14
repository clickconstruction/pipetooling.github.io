# 20260914240000_sub_sheet_link_cleanup.sql (2026-09-14, v2.3435)

Sub sheets read their job by id only. Closes `to-dos/sub-sheet-job-link-followups.md` → "After all rows are gone" (measured the same day: 77 sheets, 0 with `job_ledger_id IS NULL`). Idempotent; no table created.

- `people_labor_jobs_stage_to_activity()` — `CREATE OR REPLACE`; reads `NEW.job_ledger_id` only and returns without a feed line when it is null (the `resolve_job_ledger_id_by_number(NEW.job_number)` fallback is gone). Body otherwise as in `20260907120000`.
- `superintendent_can_access_sub_work_order(uuid, uuid)` — `CREATE OR REPLACE`; a sheet-anchored work order is the superintendent's via the sheet's `job_ledger_id` or its `project_id`; the `lower(btrim(jl.hcp_number)) = lower(btrim(s.job_number))` branch is gone. Comment updated.
- `DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_hcp_numbers(text[])` and `public.get_jobs_ledger_by_hcp_numbers_paid_only(text[])` — People → Review was the last caller and now reads `get_jobs_ledger_by_ids[_paid_only]` on the sheets' links. The client PR merges (and deploys) before the push, so no released client calls a dropped RPC.
- `ALTER TABLE public.people_labor_jobs ALTER COLUMN job_number TYPE text` — off `varchar(10)`; the column comment no longer says "max 10 characters". Takes a brief `ACCESS EXCLUSIVE` lock on `people_labor_jobs` (varchar → text is a catalog-only change, no rewrite); `SET lock_timeout = '3s'` makes a busy moment fail fast — retry.
- Kept on purpose: `resolve_job_ledger_id_by_number(text)` and the BEFORE trigger `people_labor_jobs_link_job_ledger()` that uses it to fill the link when a writer only sets the number.

Apply order: merge (client deploys) → `supabase db push` → `npm run gen-types:linked` in a follow-up chore PR (the two Functions entries were removed from `src/types/database.ts` by hand in this PR). No edge function redeploy — `sub-portal` / `submit-sub-portal` only display `job_number`.
