SET lock_timeout = '3s';

-- "My email schedule" (v2.1317): one self-scoped read for everything the app
-- is configured to email the CALLER — Settings → Your account renders it as a
-- weekly grid + event list. SECURITY DEFINER because the sources have
-- mismatched RLS the recipient can't otherwise cross (billed_report_email_
-- requests is readable by the SENDER, not the recipient; app_settings
-- recipient lists are dev-write surfaces). The function only ever returns
-- rows addressed to auth.uid() — safe to EXECUTE for all authenticated users
-- (the get_dashboard_payroll_totals aggregate-read precedent).

CREATE OR REPLACE FUNCTION public.get_my_email_schedule()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (SELECT (SELECT auth.uid()) AS uid),
-- Weekly digests: recurring job report schedules naming me as a recipient.
weekly AS (
  SELECT s.name, s.enabled, s.time_local, s.days_of_week, s.timezone,
         r.include_costs, r.activity_scope
  FROM public.recurring_job_report_schedule_recipients r
  JOIN public.recurring_job_report_schedules s ON s.id = r.schedule_id
  WHERE r.recipient_user_id = (SELECT uid FROM me)
),
-- One-off scheduled sends addressed to me, not yet sent.
billed_oneoffs AS (
  SELECT b.send_at, qu.name AS requested_by_name
  FROM public.billed_report_email_requests b
  LEFT JOIN public.users qu ON qu.id = b.requested_by
  WHERE b.recipient_user_id = (SELECT uid FROM me) AND b.sent_at IS NULL
),
schedule_day_oneoffs AS (
  SELECT d.send_at, d.work_date
  FROM public.schedule_day_email_requests d
  WHERE d.recipient_user_id = (SELECT uid FROM me)
    AND d.status = 'pending' AND d.sent_at IS NULL
),
-- Event streams: membership in the app_settings uuid-list keys. Guarded cast:
-- a malformed value degrades to "not a member", never an error.
setting_list AS (
  SELECT key,
         CASE WHEN value_text ~ '^\s*\[' THEN value_text::jsonb ELSE '[]'::jsonb END AS ids
  FROM public.app_settings
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1')
)
SELECT jsonb_build_object(
  'weekly', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', w.name,
      'enabled', w.enabled,
      'time_local', to_char(w.time_local, 'HH24:MI'),
      'days_of_week', to_jsonb(w.days_of_week),
      'timezone', w.timezone,
      'include_costs', w.include_costs,
      'activity_scope', w.activity_scope
    ) ORDER BY w.time_local) FROM weekly w), '[]'::jsonb),
  'one_offs', COALESCE((SELECT jsonb_agg(o ORDER BY (o->>'send_at')) FROM (
      SELECT jsonb_build_object('stream', 'billed_report', 'send_at', b.send_at,
                                'detail', COALESCE('from ' || NULLIF(trim(b.requested_by_name), ''), 'scheduled')) AS o
      FROM billed_oneoffs b
      UNION ALL
      SELECT jsonb_build_object('stream', 'schedule_day', 'send_at', d.send_at,
                                'detail', 'for ' || to_char(d.work_date, 'Mon FMDD'))
      FROM schedule_day_oneoffs d
    ) x), '[]'::jsonb),
  'events', jsonb_build_object(
    'paid_in_full', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'paid_job_email_recipients_v1'), false),
    'payment_received', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'payment_made_email_recipients_v1'), false)
  )
);
$$;

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Everything the app is configured to email the calling user (v2.1317): weekly report digests, pending one-off sends addressed to them, and event-stream memberships. Self-scoped — only auth.uid()''s own entries; EXECUTE for authenticated.';

REVOKE EXECUTE ON FUNCTION public.get_my_email_schedule() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_email_schedule() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_email_schedule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_email_schedule() TO service_role;
