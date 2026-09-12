# 20260912155909_report_pct_newest_wins.sql (2026-09-12, v2.3372)

`list_latest_report_completion_pct(p_job_ids uuid[])` gains two columns — `reported_at` (when the latest report carrying a % was filed) and `manual_at` (the job's last hand-set % from `job_pct_events`, source `manual`; null when never). The OUT list changed, so the function is dropped and recreated with the same body, the same SECURITY INVOKER and `GRANT EXECUTE … TO authenticated`.

Why: readers took any report's % over the job's own regardless of date (Mission Hills: a May 15 report at 77 % beat a Sep 3 hand-set of 90 %). The client kernel `currentReportPctByJobId` now keeps a report only when it is newer than the last hand-set.

No table change. Idempotent (`DROP FUNCTION IF EXISTS` + `CREATE`). Regenerate `src/types/database.ts` after the push.
