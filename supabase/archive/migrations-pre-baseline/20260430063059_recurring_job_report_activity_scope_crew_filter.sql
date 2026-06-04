-- Recurring job reports: activity_scope + crew_filter (org-wide digest); drop job_scope.

ALTER TABLE public.recurring_job_report_schedule_recipients
  ADD COLUMN IF NOT EXISTS activity_scope text,
  ADD COLUMN IF NOT EXISTS crew_filter text;

UPDATE public.recurring_job_report_schedule_recipients
SET
  activity_scope = CASE job_scope
    WHEN 'member_jobs_only' THEN 'calendar_yesterday'
    WHEN 'schedule_today' THEN 'calendar_today'
    WHEN 'schedule_yesterday' THEN 'calendar_yesterday'
    WHEN 'schedule_this_week' THEN 'calendar_week'
    ELSE 'calendar_yesterday'
  END,
  crew_filter = COALESCE(crew_filter, 'all_users')
WHERE activity_scope IS NULL;

UPDATE public.recurring_job_report_schedule_recipients
SET crew_filter = 'all_users'
WHERE crew_filter IS NULL;

ALTER TABLE public.recurring_job_report_schedule_recipients
  DROP CONSTRAINT IF EXISTS recurring_job_report_schedule_recipients_job_scope_check;

ALTER TABLE public.recurring_job_report_schedule_recipients
  DROP COLUMN IF EXISTS job_scope;

ALTER TABLE public.recurring_job_report_schedule_recipients
  ALTER COLUMN activity_scope SET NOT NULL,
  ALTER COLUMN crew_filter SET NOT NULL;

ALTER TABLE public.recurring_job_report_schedule_recipients
  ADD CONSTRAINT recurring_job_report_schedule_recipients_activity_scope_check
  CHECK (
    activity_scope IN (
      'calendar_yesterday',
      'calendar_today',
      'calendar_week'
    )
  );

ALTER TABLE public.recurring_job_report_schedule_recipients
  ADD CONSTRAINT recurring_job_report_schedule_recipients_crew_filter_check
  CHECK (crew_filter IN ('all_users', 'my_team'));

COMMENT ON COLUMN public.recurring_job_report_schedule_recipients.activity_scope IS
  'calendar_yesterday|calendar_today|calendar_week — activity window in schedule timezone (half-open local midnights → UTC).';

COMMENT ON COLUMN public.recurring_job_report_schedule_recipients.crew_filter IS
  'all_users = anyone on org jobs; my_team = recipient + team_leader_assignments.member_user_id where leader_user_id=recipient.';

COMMENT ON COLUMN public.recurring_job_report_dispatch_log.reporting_date IS
  'Idempotency: civil summary day for yesterday/today scopes; week Sunday for calendar_week.';

-- One full civil calendar day in p_timezone: [p_civil_day 00:00, p_civil_day+1 00:00) as UTC instants.
CREATE OR REPLACE FUNCTION public.reporting_window_calendar_civil_day(
  p_timezone text,
  p_civil_day date
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
  )
  SELECT
    (p_civil_day::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_start_utc,
    (((p_civil_day + INTERVAL '1 day')::date)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_end_utc,
    p_civil_day AS reporting_date
  FROM z;
$$;

COMMENT ON FUNCTION public.reporting_window_calendar_civil_day(text, date) IS
  'Recurring job report: activity on one civil calendar day in p_timezone; reporting_date = that day.';

REVOKE ALL ON FUNCTION public.reporting_window_calendar_civil_day(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reporting_window_calendar_civil_day(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporting_window_calendar_civil_day(text, date) TO service_role;

-- Treat calendar_yesterday same as prior_calendar_day (day before anchor civil date).
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
    WHERE lower(trim(coalesce(p_preset, ''))) IN ('prior_calendar_day', 'calendar_yesterday')
  )
  SELECT
    (b.rpt::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_start_utc,
    (((b.rpt + INTERVAL '1 day')::date)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_end_utc,
    b.rpt AS reporting_date
  FROM b;
$$;

COMMENT ON FUNCTION public.reporting_window_for_recurring_job_email(text, text, date) IS
  'Reporting UTC window: prior_calendar_day or calendar_yesterday = full civil day before anchor in zone.';
