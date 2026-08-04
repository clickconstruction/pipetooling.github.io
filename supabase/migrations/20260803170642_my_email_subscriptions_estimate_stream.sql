SET lock_timeout = '3s';

-- "My email subscriptions" (v2.1330): get_my_email_schedule() learns the third
-- standing event stream — Estimate accepted — so Settings → Your account can
-- list EVERY subscription the caller is on:
--   * events.estimate_accepted_always: membership in the org-wide
--     estimate_accepted_notify_recipients_v1 app_settings list ("always
--     notify" — dev-managed via ⚙ on Estimates).
--   * estimate_specific: per-estimate subscriptions — estimates whose
--     accept_notify_user_ids names the caller and whose status could still
--     fire an acceptance ('draft','sent'); newest-first titles capped at 5
--     plus the full count.
-- Additive JSON keys only — the v2.1321/v2.1323 shape is unchanged, so either
-- deploy order of client vs migration degrades gracefully.

CREATE OR REPLACE FUNCTION public.get_my_email_schedule()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (SELECT (SELECT auth.uid()) AS uid),
chicago AS (
  SELECT today,
         (today - ((EXTRACT(ISODOW FROM today)::int - 1)))::date AS monday
  FROM (SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today) t
),
weekly AS (
  SELECT s.name, s.enabled, s.time_local, s.days_of_week, s.timezone,
         r.include_costs, r.activity_scope
  FROM public.recurring_job_report_schedule_recipients r
  JOIN public.recurring_job_report_schedules s ON s.id = r.schedule_id
  WHERE r.recipient_user_id = (SELECT uid FROM me)
),
-- Pending one-offs, plus ones already sent THIS Chicago week (Mon–today).
billed_oneoffs AS (
  SELECT b.send_at, b.sent_at, b.repeat_weekly, qu.name AS requested_by_name
  FROM public.billed_report_email_requests b
  LEFT JOIN public.users qu ON qu.id = b.requested_by
  CROSS JOIN chicago c
  WHERE b.recipient_user_id = (SELECT uid FROM me)
    AND (
      b.sent_at IS NULL
      OR (b.error IS NULL AND (b.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
schedule_day_oneoffs AS (
  SELECT d.send_at, d.sent_at, d.work_date
  FROM public.schedule_day_email_requests d
  CROSS JOIN chicago c
  WHERE d.recipient_user_id = (SELECT uid FROM me)
    AND (
      (d.status = 'pending' AND d.sent_at IS NULL)
      OR (d.status = 'sent' AND d.sent_at IS NOT NULL AND (d.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
setting_list AS (
  SELECT key,
         CASE WHEN value_text ~ '^\s*\[' THEN value_text::jsonb ELSE '[]'::jsonb END AS ids
  FROM public.app_settings
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'estimate_accepted_notify_recipients_v1')
),
-- Per-estimate subscriptions that can still fire an acceptance email.
est_specific AS (
  SELECT e.title, e.created_at
  FROM public.estimates e
  WHERE (SELECT uid FROM me) = ANY(e.accept_notify_user_ids)
    AND e.status IN ('draft', 'sent')
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
                                'sent_at', b.sent_at,
                                'repeat_weekly', b.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(b.requested_by_name), ''), 'scheduled')) AS o
      FROM billed_oneoffs b
      UNION ALL
      SELECT jsonb_build_object('stream', 'schedule_day', 'send_at', d.send_at,
                                'sent_at', d.sent_at,
                                'repeat_weekly', false,
                                'detail', 'for ' || to_char(d.work_date, 'Mon FMDD'))
      FROM schedule_day_oneoffs d
    ) x), '[]'::jsonb),
  'events', jsonb_build_object(
    'paid_in_full', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'paid_job_email_recipients_v1'), false),
    'payment_received', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'payment_made_email_recipients_v1'), false),
    'estimate_accepted_always', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'estimate_accepted_notify_recipients_v1'), false)
  ),
  'estimate_specific', jsonb_build_object(
    'total', COALESCE((SELECT count(*) FROM est_specific), 0),
    'titles', COALESCE((SELECT jsonb_agg(c.t ORDER BY c.created_at DESC) FROM (
        SELECT NULLIF(trim(s.title), '') AS t, s.created_at
        FROM est_specific s
        ORDER BY s.created_at DESC
        LIMIT 5
      ) c WHERE c.t IS NOT NULL), '[]'::jsonb)
  )
);
$$;

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Everything the app is configured to email the calling user (v2.1330): weekly digests, one-off sends addressed to them — pending, plus already-sent rows from the current Chicago Mon–Sun week — and every standing event-stream subscription (Paid in Full, Payment received, Estimate accepted always + per-estimate). Self-scoped; EXECUTE for authenticated.';
