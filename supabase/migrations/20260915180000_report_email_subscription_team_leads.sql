SET lock_timeout = '3s';

-- Field report emails: team-lead scope (v2.3480). Owner decision 2026-09-15:
-- a subscription may name individuals OR team leads; office-managed; one email
-- per report. A team-lead pick means "reports from everyone this leader leads,
-- plus the leader's own", resolved at send time from team_leader_assignments
-- so new hires flow in without editing the subscription.
--
--   1. report_email_subscription_team_leads — the sidecar beside
--      report_email_subscription_authors; same RLS (report-email managers).
--   2. list_report_email_team_leads() — the picker's list of leaders with a
--      member count, gated on can_manage_report_email_subscriptions() (a
--      controller may manage report emails but cannot read every
--      team_leader_assignments row — can_manage_team_leader_assignments()
--      is dev/master/assistant only).
--   3. get_my_email_schedule() / get_global_email_schedule(): `team_leads`
--      names beside `authors` on each subscription (bodies from 20260915170000
--      with only that addition).

CREATE TABLE IF NOT EXISTS public.report_email_subscription_team_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.report_email_subscriptions(id) ON DELETE CASCADE,
  leader_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT report_email_subscription_team_leads_unique UNIQUE (subscription_id, leader_user_id)
);

COMMENT ON TABLE public.report_email_subscription_team_leads IS
  'Team leads a subscription is limited to: reports by anyone the leader leads (team_leader_assignments, resolved at send time) or by the leader. Combined with report_email_subscription_authors; ignored when all_authors=true.';

CREATE INDEX IF NOT EXISTS idx_report_email_subscription_team_leads_subscription
  ON public.report_email_subscription_team_leads (subscription_id);
CREATE INDEX IF NOT EXISTS idx_report_email_subscription_team_leads_leader
  ON public.report_email_subscription_team_leads (leader_user_id);

COMMENT ON TABLE public.report_email_subscriptions IS
  'Standing report-email recipients. all_authors=true emails every report; else only reports whose author is in report_email_subscription_authors, or is (or is led by) a leader in report_email_subscription_team_leads. auto_send drives the on-create email.';

ALTER TABLE public.report_email_subscription_team_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Report email managers select team leads" ON public.report_email_subscription_team_leads;
CREATE POLICY "Report email managers select team leads" ON public.report_email_subscription_team_leads
  FOR SELECT USING (public.can_manage_report_email_subscriptions());

DROP POLICY IF EXISTS "Report email managers insert team leads" ON public.report_email_subscription_team_leads;
CREATE POLICY "Report email managers insert team leads" ON public.report_email_subscription_team_leads
  FOR INSERT WITH CHECK (public.can_manage_report_email_subscriptions());

DROP POLICY IF EXISTS "Report email managers delete team leads" ON public.report_email_subscription_team_leads;
CREATE POLICY "Report email managers delete team leads" ON public.report_email_subscription_team_leads
  FOR DELETE USING (public.can_manage_report_email_subscriptions());

-- The picker: every leader who leads at least one person, with the count.
CREATE OR REPLACE FUNCTION public.list_report_email_team_leads()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.can_manage_report_email_subscriptions() THEN '[]'::jsonb ELSE COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', l.leader_user_id,
      'name', COALESCE(NULLIF(trim(u.name), ''), u.email),
      'member_count', l.member_count
    ) ORDER BY u.name)
    FROM (
      SELECT a.leader_user_id, count(DISTINCT a.member_user_id) AS member_count
      FROM public.team_leader_assignments a
      GROUP BY a.leader_user_id
    ) l
    JOIN public.users u ON u.id = l.leader_user_id
    WHERE u.archived_at IS NULL
  ), '[]'::jsonb) END;
$$;

COMMENT ON FUNCTION public.list_report_email_team_leads() IS
  'Report-email managers only (empty list otherwise): every team lead with at least one member, for the Report email recipients picker (v2.3480).';

REVOKE EXECUTE ON FUNCTION public.list_report_email_team_leads() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_report_email_team_leads() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_report_email_team_leads() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_email_schedule()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH me AS (SELECT (SELECT auth.uid()) AS uid),
chicago AS (
  SELECT today,
         (today - ((EXTRACT(ISODOW FROM today)::int - 1)))::date AS monday
  FROM (SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today) t
),
weekly AS (
  SELECT s.name, s.enabled, s.time_local, s.days_of_week, s.timezone,
         r.include_costs, r.activity_scope, r.crew_filter
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
gc_statement_oneoffs AS (
  -- Requester-scoped BY DESIGN (REPORT_SUBSCRIPTIONS.md): GC statements go to
  -- outside AP inboxes with no user row, so the scheduled send lists on the
  -- REQUESTER's schedule labeled with the destination address.
  SELECT g.send_at, g.sent_at, g.repeat_weekly, g.entity_name, g.sent_to
  FROM public.gc_statement_email_requests g
  CROSS JOIN chicago c
  WHERE (
      g.requested_by = (SELECT uid FROM me)
      OR lower(g.sent_to) = (SELECT lower(u.email) FROM public.users u WHERE u.id = (SELECT uid FROM me) AND COALESCE(u.email, '') <> '')
    )
    AND (
      g.sent_at IS NULL
      OR (g.error IS NULL AND (g.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
weekly_movement_oneoffs AS (
  -- Recipient-scoped like billed_report (recipients ARE users for this stream).
  SELECT w.send_at, w.sent_at, w.repeat_weekly, qu.name AS requested_by_name
  FROM public.weekly_movement_email_requests w
  LEFT JOIN public.users qu ON qu.id = w.requested_by
  CROSS JOIN chicago c
  WHERE w.recipient_user_id = (SELECT uid FROM me)
    AND (
      w.sent_at IS NULL
      OR (w.error IS NULL AND (w.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
weekly_money_oneoffs AS (
  -- Recipient-scoped; recipients are dev/controller users (wage-derived data).
  SELECT m.send_at, m.sent_at, m.repeat_weekly, qu.name AS requested_by_name
  FROM public.weekly_money_email_requests m
  LEFT JOIN public.users qu ON qu.id = m.requested_by
  CROSS JOIN chicago c
  WHERE m.recipient_user_id = (SELECT uid FROM me)
    AND (
      m.sent_at IS NULL
      OR (m.error IS NULL AND (m.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
payment_forecast_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2223).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.payment_forecast_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
money_waiting_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2565).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.money_waiting_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
statement_round_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2771).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.statement_round_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
crew_day_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2603).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.crew_day_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
setting_list AS (
  SELECT key,
         CASE WHEN value_text ~ '^\s*\[' THEN value_text::jsonb ELSE '[]'::jsonb END AS ids
  FROM public.app_settings
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'estimate_accepted_notify_recipients_v1')
),
-- Ready to Bill v2 (v2.1844): array of { id, email, push } objects.
rtb_membership AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.app_settings s
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN s.value_text ~ '^\s*\[' THEN s.value_text::jsonb ELSE '[]'::jsonb END
    ) AS e
    WHERE s.key = 'ready_to_bill_notify_recipients_v2'
      AND e ->> 'id' = (SELECT uid FROM me)::text
      AND ((e ->> 'email') IS DISTINCT FROM 'false' OR (e ->> 'push') IS DISTINCT FROM 'false')
  ) AS on_it
),
-- Per-estimate subscriptions that can still fire an acceptance email.
est_specific AS (
  SELECT e.title, e.created_at
  FROM public.estimates e
  WHERE (SELECT uid FROM me) = ANY(e.accept_notify_user_ids)
    AND e.status IN ('draft', 'sent')
),
-- Field report emails (v2.3472): every report_email_subscriptions row addressed
-- to me — by user id, or by an external address that matches my account email
-- (the manager may have typed the address instead of picking the user).
report_email_subs AS (
  SELECT s.id, s.enabled, s.auto_send, s.all_authors,
         COALESCE((
           SELECT jsonb_agg(COALESCE(NULLIF(trim(au.name), ''), au.email) ORDER BY au.name)
           FROM public.report_email_subscription_authors a
           JOIN public.users au ON au.id = a.author_user_id
           WHERE a.subscription_id = s.id
         ), '[]'::jsonb) AS authors,
         COALESCE((
           SELECT jsonb_agg(COALESCE(NULLIF(trim(lu.name), ''), lu.email) ORDER BY lu.name)
           FROM public.report_email_subscription_team_leads t
           JOIN public.users lu ON lu.id = t.leader_user_id
           WHERE t.subscription_id = s.id
         ), '[]'::jsonb) AS team_leads
  FROM public.report_email_subscriptions s
  WHERE s.recipient_user_id = (SELECT uid FROM me)
     OR (
       s.recipient_user_id IS NULL
       AND s.recipient_email IS NOT NULL
       AND lower(trim(s.recipient_email)) = (
         SELECT lower(u.email) FROM public.users u
         WHERE u.id = (SELECT uid FROM me) AND COALESCE(u.email, '') <> ''
       )
     )
)
SELECT jsonb_build_object(
  'weekly', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', w.name,
      'enabled', w.enabled,
      'time_local', to_char(w.time_local, 'HH24:MI'),
      'days_of_week', to_jsonb(w.days_of_week),
      'timezone', w.timezone,
      'include_costs', w.include_costs,
      'activity_scope', w.activity_scope,
      'crew_filter', w.crew_filter
    ) ORDER BY w.time_local) FROM weekly w), '[]'::jsonb),
  'report_emails', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'enabled', r.enabled,
      'auto_send', r.auto_send,
      'all_authors', r.all_authors,
      'authors', r.authors,
      'team_leads', r.team_leads
    ) ORDER BY r.enabled DESC, r.all_authors DESC) FROM report_email_subs r), '[]'::jsonb),
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
      UNION ALL
      SELECT jsonb_build_object('stream', 'gc_statement', 'send_at', g.send_at,
                                'sent_at', g.sent_at,
                                'repeat_weekly', g.repeat_weekly,
                                'detail', COALESCE(NULLIF(trim(g.entity_name), ''), 'Statement') || CHR(32) || CHR(8594) || CHR(32) || g.sent_to)
      FROM gc_statement_oneoffs g
      UNION ALL
      SELECT jsonb_build_object('stream', 'weekly_movement', 'send_at', w.send_at,
                                'sent_at', w.sent_at,
                                'repeat_weekly', w.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(w.requested_by_name), ''), 'scheduled'))
      FROM weekly_movement_oneoffs w
      UNION ALL
      SELECT jsonb_build_object('stream', 'weekly_money', 'send_at', m.send_at,
                                'sent_at', m.sent_at,
                                'repeat_weekly', m.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(m.requested_by_name), ''), 'scheduled'))
      FROM weekly_money_oneoffs m
      UNION ALL
      SELECT jsonb_build_object('stream', 'payment_forecast', 'send_at', f.send_at,
                                'sent_at', f.sent_at,
                                'repeat_weekly', f.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(f.requested_by_name), ''), 'scheduled'))
      FROM payment_forecast_oneoffs f
      UNION ALL
      SELECT jsonb_build_object('stream', 'money_waiting', 'send_at', mw.send_at,
                                'sent_at', mw.sent_at,
                                'repeat_weekly', mw.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(mw.requested_by_name), ''), 'scheduled'))
      FROM money_waiting_oneoffs mw
      UNION ALL
      SELECT jsonb_build_object('stream', 'crew_day', 'send_at', cd.send_at,
                                'sent_at', cd.sent_at,
                                'repeat_weekly', cd.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(cd.requested_by_name), ''), 'scheduled'))
      FROM crew_day_oneoffs cd
      UNION ALL
      SELECT jsonb_build_object('stream', 'statement_round', 'send_at', sr.send_at,
                                'sent_at', sr.sent_at,
                                'repeat_weekly', sr.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(sr.requested_by_name), ''), 'scheduled'))
      FROM statement_round_oneoffs sr
    ) x), '[]'::jsonb),
  'events', jsonb_build_object(
    'paid_in_full', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'paid_job_email_recipients_v1'), false),
    'payment_received', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'payment_made_email_recipients_v1'), false),
    'estimate_accepted_always', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'estimate_accepted_notify_recipients_v1'), false),
    'ready_to_bill', COALESCE((SELECT on_it FROM rtb_membership), false)
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
$function$;

CREATE OR REPLACE FUNCTION public.get_global_email_schedule()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (SELECT public.is_dev() AS ok),
setting_list AS (
  SELECT key,
         CASE WHEN value_text ~ '^\s*\[' THEN value_text::jsonb ELSE '[]'::jsonb END AS ids
  FROM public.app_settings
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1')
),
setting_people AS (
  SELECT sl.key, jsonb_agg(jsonb_build_object('user_id', u.id, 'name', COALESCE(NULLIF(trim(u.name), ''), u.email)) ORDER BY u.name) AS people
  FROM setting_list sl
  CROSS JOIN LATERAL jsonb_array_elements_text(sl.ids) AS x(uid)
  JOIN public.users u ON u.id::text = x.uid
  GROUP BY sl.key
),
-- Ready to Bill v2 (v2.1844): per-person channel flags ride along.
rtb_people AS (
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'name', COALESCE(NULLIF(trim(u.name), ''), u.email),
    'email', (e ->> 'email') IS DISTINCT FROM 'false',
    'push', (e ->> 'push') IS DISTINCT FROM 'false'
  ) ORDER BY u.name) AS people
  FROM public.app_settings s
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN s.value_text ~ '^\s*\[' THEN s.value_text::jsonb ELSE '[]'::jsonb END
  ) AS e
  JOIN public.users u ON u.id::text = e ->> 'id'
  WHERE s.key = 'ready_to_bill_notify_recipients_v2'
    AND ((e ->> 'email') IS DISTINCT FROM 'false' OR (e ->> 'push') IS DISTINCT FROM 'false')
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE jsonb_build_object(
  'report_schedules', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'enabled', s.enabled,
      'time_local', to_char(s.time_local, 'HH24:MI'),
      'days_of_week', to_jsonb(s.days_of_week),
      'timezone', s.timezone,
      'recipients', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'row_id', r.id,
          'user_id', u.id,
          'name', COALESCE(NULLIF(trim(u.name), ''), u.email),
          'include_costs', r.include_costs
        ) ORDER BY u.name)
        FROM public.recurring_job_report_schedule_recipients r
        JOIN public.users u ON u.id = r.recipient_user_id
        WHERE r.schedule_id = s.id
      ), '[]'::jsonb)
    ) ORDER BY s.name)
    FROM public.recurring_job_report_schedules s
  ), '[]'::jsonb),
  'paid_recipients', COALESCE((SELECT people FROM setting_people WHERE key = 'paid_job_email_recipients_v1'), '[]'::jsonb),
  'payment_recipients', COALESCE((SELECT people FROM setting_people WHERE key = 'payment_made_email_recipients_v1'), '[]'::jsonb),
  'ready_to_bill_recipients', COALESCE((SELECT people FROM rtb_people), '[]'::jsonb),
  'report_email_subscriptions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'recipient_name', COALESCE(NULLIF(trim(u.name), ''), u.email, NULLIF(trim(s.recipient_email), ''), '—'),
      'external', s.recipient_user_id IS NULL,
      'label', NULLIF(trim(s.label), ''),
      'enabled', s.enabled,
      'auto_send', s.auto_send,
      'all_authors', s.all_authors,
      'authors', COALESCE((
        SELECT jsonb_agg(COALESCE(NULLIF(trim(au.name), ''), au.email) ORDER BY au.name)
        FROM public.report_email_subscription_authors a
        JOIN public.users au ON au.id = a.author_user_id
        WHERE a.subscription_id = s.id
      ), '[]'::jsonb),
      'team_leads', COALESCE((
        SELECT jsonb_agg(COALESCE(NULLIF(trim(lu.name), ''), lu.email) ORDER BY lu.name)
        FROM public.report_email_subscription_team_leads t
        JOIN public.users lu ON lu.id = t.leader_user_id
        WHERE t.subscription_id = s.id
      ), '[]'::jsonb)
    ) ORDER BY s.enabled DESC, COALESCE(NULLIF(trim(u.name), ''), u.email, s.recipient_email))
    FROM public.report_email_subscriptions s
    LEFT JOIN public.users u ON u.id = s.recipient_user_id
  ), '[]'::jsonb),
  'billed_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', b.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', b.send_at,
      'repeat_weekly', b.repeat_weekly
    ) ORDER BY b.send_at)
    FROM public.billed_report_email_requests b
    JOIN public.users ru ON ru.id = b.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = b.requested_by
    WHERE b.sent_at IS NULL
  ), '[]'::jsonb),
  'gc_statement_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', g.id,
      'entity_name', g.entity_name,
      'sent_to', g.sent_to,
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', g.send_at,
      'repeat_weekly', g.repeat_weekly
    ) ORDER BY g.send_at)
    FROM public.gc_statement_email_requests g
    LEFT JOIN public.users qu ON qu.id = g.requested_by
    WHERE g.sent_at IS NULL
  ), '[]'::jsonb),
  'weekly_movement_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', w.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', w.send_at,
      'repeat_weekly', w.repeat_weekly
    ) ORDER BY w.send_at)
    FROM public.weekly_movement_email_requests w
    JOIN public.users ru ON ru.id = w.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = w.requested_by
    WHERE w.sent_at IS NULL
  ), '[]'::jsonb),
  'weekly_money_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', m.send_at,
      'repeat_weekly', m.repeat_weekly
    ) ORDER BY m.send_at)
    FROM public.weekly_money_email_requests m
    JOIN public.users ru ON ru.id = m.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = m.requested_by
    WHERE m.sent_at IS NULL
  ), '[]'::jsonb),
  'payment_forecast_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.payment_forecast_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'money_waiting_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.money_waiting_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'statement_round_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.statement_round_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'crew_day_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.crew_day_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'schedule_day_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', d.id,
      'recipient_name', COALESCE(NULLIF(trim(u.name), ''), u.email),
      'send_at', d.send_at,
      'work_date', d.work_date
    ) ORDER BY d.send_at)
    FROM public.schedule_day_email_requests d
    JOIN public.users u ON u.id = d.recipient_user_id
    WHERE d.status = 'pending' AND d.sent_at IS NULL
  ), '[]'::jsonb)
) END;
$function$;

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Self-scoped: every email stream configured to reach auth.uid() — weekly digests (with activity scope + crew filter), pending one-offs across all scheduled streams, event streams, per-estimate subscriptions, and the field-report email subscriptions addressed to the caller (authors + team leads, v2.3480).';
COMMENT ON FUNCTION public.get_global_email_schedule() IS
  'Dev-only: every stream''s recipients and pending sends for the Settings → Email streams panel; NULL for non-devs. report_email_subscriptions carries authors + team_leads (v2.3480).';

-- Required after every CREATE TABLE: block writes from read-only (training mode) users.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
