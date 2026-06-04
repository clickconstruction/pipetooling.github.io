-- Recurring job reports: calendar_last_week = Sun-Sat week before the week containing anchor.

CREATE OR REPLACE FUNCTION public.reporting_window_calendar_week_prior_to_anchor(
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
    FROM z
  ),
  w AS (
    SELECT
      (
        (
          aa.anchor -
          ((EXTRACT(DOW FROM aa.anchor))::bigint * INTERVAL '1 day')
        )::date
        - 7
      ) AS prior_week_sun
    FROM a AS aa
  )
  SELECT
    ((w.prior_week_sun)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_start_utc,
    (((w.prior_week_sun + 7)::date)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_end_utc,
    w.prior_week_sun AS reporting_date
  FROM w;
$$;

COMMENT ON FUNCTION public.reporting_window_calendar_week_prior_to_anchor(text, date) IS
  'Recurring job report: full calendar week BEFORE the Sun-Sat week containing anchor; reporting_date = that week Sunday (dispatch dedup).';

REVOKE ALL ON FUNCTION public.reporting_window_calendar_week_prior_to_anchor(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reporting_window_calendar_week_prior_to_anchor(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporting_window_calendar_week_prior_to_anchor(text, date) TO service_role;

ALTER TABLE public.recurring_job_report_schedule_recipients
  DROP CONSTRAINT IF EXISTS recurring_job_report_schedule_recipients_activity_scope_check;

ALTER TABLE public.recurring_job_report_schedule_recipients
  ADD CONSTRAINT recurring_job_report_schedule_recipients_activity_scope_check
  CHECK (
    activity_scope IN (
      'calendar_yesterday',
      'calendar_today',
      'calendar_week',
      'calendar_last_week'
    )
  );

COMMENT ON COLUMN public.recurring_job_report_schedule_recipients.activity_scope IS
  'calendar_yesterday|calendar_today|calendar_week (week containing anchor)|calendar_last_week (prior Sun–Sat week); activity window in schedule timezone (half-open local midnights → UTC).';
