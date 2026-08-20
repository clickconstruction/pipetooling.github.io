SET lock_timeout = '3s';

-- list_job_followup_activity: LATERAL rewrite + missing composite index (v2.1920).
--
-- The v2.1718 body ran three bare correlated aggregates per open job. Under
-- SECURITY INVOKER, `max(...)` evaluates the child table's per-row RLS policy
-- (an EXISTS chase back through jobs_ledger) on EVERY note/event of the job
-- before aggregating — the function was the #1 statement-timeout offender in
-- the Aug 19-20 OOM incident (16 timeouts in 48h; it runs on every office
-- Dashboard mount via the follow-ups banner). Two changes, same signature and
-- result shape (no client change, no type regen):
--
-- 1. job_status_events gets the composite (job_id, changed_at DESC) index the
--    baseline never had (only single-column indexes) — the latest-event probe
--    becomes a one-row backward index scan.
-- 2. The notes/events lookups become LATERAL ... ORDER BY ... LIMIT 1: the
--    newest RLS-visible row is found by index order and RLS stops after ~one
--    row per job, instead of running on every historical row. The
--    schedule-blocks min() keeps its aggregate shape — it's a bounded range
--    scan on idx_job_schedule_blocks_job_work_date.
--
-- Deliberately NOT reused: jobs_ledger_thread_note_stats_cache.last_note_at
-- (20260814214439) — that cache skips "Arrived at job / Leaving job" stamps,
-- but for follow-up purposes clock stamps ARE activity; substituting it would
-- make stamp-only jobs look quieter than they are.
--
-- RLS: unchanged — SECURITY INVOKER applies every table's SELECT policies to
-- every table reference regardless of join shape; callers still see only the
-- jobs/notes/events/blocks they could read anyway.

CREATE INDEX IF NOT EXISTS idx_job_status_events_job_changed
  ON public.job_status_events (job_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.list_job_followup_activity(p_today date)
RETURNS TABLE (job_id uuid, latest_activity_at timestamptz, next_scheduled_on date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    j.id AS job_id,
    GREATEST(
      COALESCE(n.last_note_at, to_timestamp(0)),
      COALESCE(e.last_event_at, to_timestamp(0)),
      COALESCE(j.last_work_date::timestamptz, to_timestamp(0)),
      COALESCE(j.last_bill_date::timestamptz, to_timestamp(0)),
      COALESCE(j.created_at, to_timestamp(0))
    ) AS latest_activity_at,
    b.next_on AS next_scheduled_on
  FROM public.jobs_ledger j
  LEFT JOIN LATERAL (
    SELECT nn.created_at AS last_note_at
    FROM public.jobs_ledger_thread_notes nn
    WHERE nn.job_id = j.id
    ORDER BY nn.created_at DESC
    LIMIT 1
  ) n ON true
  LEFT JOIN LATERAL (
    SELECT ee.changed_at AS last_event_at
    FROM public.job_status_events ee
    WHERE ee.job_id = j.id
    ORDER BY ee.changed_at DESC
    LIMIT 1
  ) e ON true
  LEFT JOIN LATERAL (
    SELECT min(bb.work_date) AS next_on
    FROM public.job_schedule_blocks bb
    WHERE bb.job_id = j.id AND bb.work_date >= p_today
  ) b ON true
  WHERE j.status IN ('waiting', 'working', 'ready_to_bill', 'billed', 'collections');
$$;

COMMENT ON FUNCTION public.list_job_followup_activity(date) IS
  'Latest activity + next scheduled visit per open job for Follow-Up Mode (v2.1718; LATERAL rewrite v2.1920). SECURITY INVOKER on purpose — every subquery runs under the caller''s RLS. p_today is the company-timezone wall date, computed by the client.';
