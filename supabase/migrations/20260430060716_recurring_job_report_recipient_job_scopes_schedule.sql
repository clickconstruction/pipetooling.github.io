-- Recurring job report recipients: expanded job_scope (schedule-based); drop all_jobs (migrated narrow).

UPDATE public.recurring_job_report_schedule_recipients
SET job_scope = 'member_jobs_only'
WHERE job_scope = 'all_jobs';

ALTER TABLE public.recurring_job_report_schedule_recipients
  DROP CONSTRAINT IF EXISTS recurring_job_report_schedule_recipients_job_scope_check;

ALTER TABLE public.recurring_job_report_schedule_recipients
  ADD CONSTRAINT recurring_job_report_schedule_recipients_job_scope_check
  CHECK (
    job_scope IN (
      'member_jobs_only',
      'schedule_today',
      'schedule_yesterday',
      'schedule_this_week'
    )
  );

COMMENT ON COLUMN public.recurring_job_report_schedule_recipients.job_scope IS
  'member_jobs_only = jobs_ledger_team_members for recipient; schedule_today|yesterday|this_week = distinct job_id from job_schedule_blocks for assignee_user_id=recipient intersect master jobs (work_date/today or week per scope).';

COMMENT ON COLUMN public.recurring_job_report_dispatch_log.reporting_date IS
  'Idempotency key with schedule + recipient: prior-day summary date (civil) for daily scopes; week Sunday (civil) for schedule_this_week weekly rollup.';

-- Full Sun–Sat+1 half-open window in p_timezone; reporting_date = that week''s Sunday (dedup key).
CREATE OR REPLACE FUNCTION public.reporting_window_calendar_week_containing_anchor(
  p_timezone text,
  p_anchor_date date DEFAULT NULL
)
RETURNS TABLE (
  window_start_utc timestamptz,
  window_end_utc timestamptz,
  reporting_date date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH z AS (
    SELECT COALESCE(NULLIF(trim(p_timezone), ''), 'America/Chicago') AS tznm
  ),
  a AS (
    SELECT COALESCE(
      p_anchor_date,
      (timezone((SELECT tznm FROM z), now()))::date
    )::date AS anchor
  ),
  w AS (
    SELECT
      (aa.anchor - ((EXTRACT(DOW FROM aa.anchor))::bigint * INTERVAL '1 day'))::date AS week_sun
    FROM a AS aa
  )
  SELECT
    ((w.week_sun)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_start_utc,
    (((w.week_sun + 7)::date)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_end_utc,
    w.week_sun AS reporting_date
  FROM w;
$$;

COMMENT ON FUNCTION public.reporting_window_calendar_week_containing_anchor(text, date) IS
  'Recurring job report weekly window: Sunday 00:00 through next Sunday 00:00 (exclusive end) in p_timezone; reporting_date = week Sunday for dispatch_log idempotency.';

REVOKE ALL ON FUNCTION public.reporting_window_calendar_week_containing_anchor(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reporting_window_calendar_week_containing_anchor(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporting_window_calendar_week_containing_anchor(text, date) TO service_role;

-- Optional civil "today" in p_timezone for preview; NULL = now() in zone (dispatch).
DROP FUNCTION IF EXISTS public.reporting_window_for_recurring_job_email(text, text);

CREATE OR REPLACE FUNCTION public.reporting_window_for_recurring_job_email(
  p_timezone text,
  p_preset text,
  p_anchor_date date DEFAULT NULL
)
RETURNS TABLE (window_start_utc timestamptz, window_end_utc timestamptz, reporting_date date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH z AS (
    SELECT COALESCE(NULLIF(trim(p_timezone), ''), 'America/Chicago') AS tznm
  ),
  b AS (
    SELECT (
      COALESCE(p_anchor_date, (timezone(z.tznm, now()))::date) - INTERVAL '1 day'
    )::date AS rpt
    FROM z
    WHERE lower(trim(coalesce(p_preset, ''))) = 'prior_calendar_day'
  )
  SELECT
    (b.rpt::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_start_utc,
    (((b.rpt + INTERVAL '1 day')::date)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_end_utc,
    b.rpt AS reporting_date
  FROM b;
$$;

COMMENT ON FUNCTION public.reporting_window_for_recurring_job_email(text, text, date) IS
  'Reporting period in UTC (prior_calendar_day = day before anchor civil date in p_timezone; anchor defaults to today in zone).';

REVOKE ALL ON FUNCTION public.reporting_window_for_recurring_job_email(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reporting_window_for_recurring_job_email(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporting_window_for_recurring_job_email(text, text, date) TO service_role;
