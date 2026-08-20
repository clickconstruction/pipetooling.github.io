# 20260821020000_followup_activity_set_based.sql (2026-08-20, v2.1920)

Part 3 of the Aug 19–20 OOM-crash-loop remediation. Two changes, no contract
change:

1. `CREATE INDEX IF NOT EXISTS idx_job_status_events_job_changed ON
   job_status_events (job_id, changed_at DESC)` — the baseline shipped only
   single-column indexes on this table, so the RPC's latest-event lookup
   couldn't do a backward index scan.
2. `CREATE OR REPLACE public.list_job_followup_activity(p_today date)` — the
   v2.1718 body ran three bare correlated aggregates per open job; under
   SECURITY INVOKER each `max()` evaluated the child table's per-row RLS
   EXISTS chase on every historical note/event. Rewritten as `LEFT JOIN
   LATERAL … ORDER BY … LIMIT 1` probes riding
   `idx_jobs_ledger_thread_notes_job_created` and the new composite — RLS now
   stops after ~one row per job. The schedule-blocks `min()` keeps its
   aggregate shape (bounded range scan on
   `idx_job_schedule_blocks_job_work_date`).

Same signature and result shape — `src/types/database.ts` unchanged. RLS
posture unchanged (SECURITY INVOKER; whole-table GROUP BY pre-aggregation was
explicitly avoided because it would evaluate RLS on every note in the DB).
`jobs_ledger_thread_note_stats_cache.last_note_at` was considered and
rejected: it skips "Arrived at job / Leaving job" stamps, which ARE activity
for follow-up purposes.
