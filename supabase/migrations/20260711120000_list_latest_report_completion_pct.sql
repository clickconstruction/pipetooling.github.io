-- Jobs → Job Summary "%" column: latest field-report completion percent per job.
--
-- Extracts the completion percent server-side because reports.field_values also holds
-- signature data-URLs — bulk-fetching the JSON client-side would be megabytes. Parsing
-- mirrors the client kernel (`tryParsePercent0to100` + new-key-wins in
-- src/lib/reportTemplateFieldDisplay.ts / jobChargesTimeline.ts): take the new
-- "How complete is the job?" value, falling back to the legacy "Who was on the job?"
-- key only when the new key is absent; parse the leading integer; keep 0–100; the most
-- recent report with a valid percent wins (percent-less reports are skipped, same as the
-- Charges & Value timeline's green line).
--
-- SECURITY INVOKER: rows are governed by the existing reports RLS (dev / master / assistant),
-- which matches who can reach the Job Summary tab.

CREATE OR REPLACE FUNCTION public.list_latest_report_completion_pct(p_job_ids uuid[])
RETURNS TABLE (job_ledger_id uuid, pct integer)
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
  )
  SELECT DISTINCT ON (job_ledger_id)
    job_ledger_id,
    n::integer AS pct
  FROM parsed
  WHERE n BETWEEN 0 AND 100
  ORDER BY job_ledger_id, created_at DESC;
$$;

COMMENT ON FUNCTION public.list_latest_report_completion_pct(uuid[]) IS
  'Latest valid field-report completion percent (0-100) per job, for the Jobs Job Summary % column. SECURITY INVOKER; reports RLS applies.';
