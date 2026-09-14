# 20260914200000_job_crew_position.sql (2026-09-14, v2.3418)

The crew feed for the Jobs → Pipeline row (*Where the Job Is*, PR 3). One read-only RPC, no table changes.

- `list_job_crew_position(p_job_ids uuid[], p_today date)` — per job: `last_work_date` and `last_day_people` (clock sessions in the 60 days up to `p_today`, revoked/rejected excluded; names from `users.name`), `sessions_60d` / `people_60d`, the newest sub sheet's `sheet_stage` / `sheet_names` / `sheet_date` / `sheet_progress_pct` / `sheet_stage_changed_at`, the newest report that answered "How complete is the job?" as `report_pct` / `report_at` (the same parse `list_latest_report_completion_pct` uses), and `pct_manual_at` (newest `job_pct_events` row with source `manual`).
- **Office roles only** — dev / master_technician / assistant / controller / primary; anyone else gets no rows (owner decision 2026-09-14: employee and sub names ride in the answer, office only). SECURITY DEFINER because the source tables' policies do not all admit those roles; the role check is the whole access rule.
- `p_today` is passed by the client (`todayYmdInAppTz`) so no zone literal lives in SQL.

Apply order: merge → `supabase db push` → `npm run gen-types:linked` (the Functions entry was hand-added to `src/types/database.ts` in this PR so the hook typechecks; the regen replaces it byte-for-byte). The client is fail-soft until the push lands (the RPC missing = an empty map, the cell unchanged).
