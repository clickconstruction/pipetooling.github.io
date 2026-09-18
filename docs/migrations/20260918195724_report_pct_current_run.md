# 20260918195724_report_pct_current_run.sql (2026-09-18, v2.3593)

Pipeline cell item 2 — a service-visit report's 100% (owner's pick **b**; [`docs/recent-features/v2.3593.md`](../recent-features/v2.3593.md)).

- **`list_latest_report_completion_pct(uuid[])`** re-created (`CREATE OR REPLACE`, same OUT list as v2.3372 — no `gen-types`): a new `current_run` CTE takes each job's newest `job_status_events` row with `to_status = 'working'`, and a report filed before that instant is left out of the candidate set. A job with no Working event keeps every report, as before. Same percent parse, same `hand_set` join, same SECURITY INVOKER.

No tables, no columns. Idempotent. Apply order: merge → `supabase db push`; the client needs nothing — both readers (`useJobSummaryData`, `useQuickfillCompleteNoBillJobs`) call the RPC as before and fall through to the job's own `pct_complete` when no row comes back.
