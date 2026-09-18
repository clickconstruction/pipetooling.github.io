SET lock_timeout = '3s';

-- Pipeline cell item 2 (v2.3593, owner's pick b, 2026-09-18): a field report's % complete
-- counts for the job's current run only. A report filed BEFORE the job last entered
-- Working (job_status_events.to_status = 'working', newest changed_at) describes an earlier
-- visit — J931 Heron's Jun 23 "100%" was a toilet-and-sink visit on a $48,700 job that
-- re-entered Working on Aug 20 — and must not feed Job Summary, Burn or the Ready-to-bill
-- prompt as if the job were done. A job with no Working event keeps every report, as before.
-- Same OUT list as v2.3372 (20260912155909), so CREATE OR REPLACE and no types regen.

CREATE OR REPLACE FUNCTION public.list_latest_report_completion_pct(p_job_ids uuid[])
RETURNS TABLE (job_ledger_id uuid, pct integer, reported_at timestamptz, manual_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH current_run AS (
    -- when the job last entered Working; NULL when it never has (every report counts)
    SELECT job_id, max(changed_at) AS working_since
    FROM public.job_status_events
    WHERE job_id = ANY (p_job_ids) AND to_status = 'working'
    GROUP BY job_id
  ),
  candidate AS (
    SELECT
      r.job_ledger_id,
      r.created_at,
      btrim(
        COALESCE(
          r.field_values ->> 'How complete is the job?',
          r.field_values ->> 'Who was on the job?'
        )
      ) AS raw
    FROM public.reports r
    LEFT JOIN current_run c ON c.job_id = r.job_ledger_id
    WHERE r.job_ledger_id = ANY (p_job_ids)
      AND (c.working_since IS NULL OR r.created_at >= c.working_since)
  ),
  parsed AS (
    SELECT
      job_ledger_id,
      created_at,
      ((regexp_match(raw, '^[+-]?\d+'))[1])::bigint AS n
    FROM candidate
    WHERE raw ~ '^[+-]?\d+'
  ),
  latest AS (
    SELECT DISTINCT ON (job_ledger_id)
      job_ledger_id,
      n::integer AS pct,
      created_at AS reported_at
    FROM parsed
    WHERE n BETWEEN 0 AND 100
    ORDER BY job_ledger_id, created_at DESC
  ),
  hand_set AS (
    SELECT job_id, max(changed_at) AS manual_at
    FROM public.job_pct_events
    WHERE job_id = ANY (p_job_ids) AND source = 'manual'
    GROUP BY job_id
  )
  SELECT l.job_ledger_id, l.pct, l.reported_at, h.manual_at
  FROM latest l
  LEFT JOIN hand_set h ON h.job_id = l.job_ledger_id;
$$;
GRANT EXECUTE ON FUNCTION public.list_latest_report_completion_pct(uuid[]) TO authenticated;
