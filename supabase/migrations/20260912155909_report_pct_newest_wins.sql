SET lock_timeout = '3s';

-- v2.3372 — the newest % complete wins, whoever set it.
--
-- `list_latest_report_completion_pct` (v2.1xx, 20260711120000) returned only the
-- latest field report's percent, and every reader (Job Summary's % column, the
-- Pipeline's burning-jobs card, the Quickfill "complete, no bill" list) took that
-- over the job's own `pct_complete` whenever a report existed — regardless of
-- date. Mission Hills (J523) had a 77 % report from May 15 and a 90 % set by hand
-- on Sep 3; the card read "100% spent at 77% done".
--
-- The function now also returns WHEN that report was filed and when the office
-- last set the job's % by hand (`job_pct_events`, source 'manual' — the trigger
-- on jobs_ledger.pct_complete is the single writer, so every hand-set since
-- 2026-08-07 is dated; 'seed' rows are the back-fill and 'service' rows are
-- report-derived, neither counts as a hand-set). The client kernel
-- (`currentReportPctByJobId`) keeps the report only when it is newer than the
-- last hand-set; otherwise the job's own % stands.
--
-- Return type changes (two new columns), so the function is dropped and
-- recreated — CREATE OR REPLACE refuses a different OUT list. Same body for
-- the percent parse, same SECURITY INVOKER (reports RLS + job_pct_events RLS
-- both already scope rows to the caller's jobs).

DROP FUNCTION IF EXISTS public.list_latest_report_completion_pct(uuid[]);

CREATE FUNCTION public.list_latest_report_completion_pct(p_job_ids uuid[])
RETURNS TABLE (job_ledger_id uuid, pct integer, reported_at timestamptz, manual_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH candidate AS (
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
    WHERE r.job_ledger_id = ANY (p_job_ids)
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
