SET lock_timeout = '3s';

-- Your people's week: the Monday email (punch list #273, PR 5, v2.6603). Taunya's goal 4 of 2026-11-06: "weekly email
-- reports that users can subscribe to showing each of the people they list and the progress they made on jobs and
-- checklist items in one neat report." A Report Subscriptions stream, people_week (docs/REPORT_SUBSCRIPTIONS.md):
--
--   1. people_week_email_requests: one row per scheduled send, the recipient (the requester themself), the people they
--      picked, send_at, repeat_weekly; a weekly row re-inserts itself +7 days on a successful send. The office roles pick
--      anyone; everyone else may list only themselves (the second look's pick 5).
--   2. get_people_week_payload(recipient, people, week_start): the week just finished for each person, rebuilt fresh at
--      send time by the service role: the cards that moved or finished (from → to percent, the lines ticked, the photos,
--      the last what-is-left words), the roadmap tasks among them with their stage and roadmap, the jobs the person
--      clocked on with the job's percent and their reports that week, and the cards stuck past a month with no move.
--   3. get_my_email_schedule and get_global_email_schedule restated word for word from 20261010022000 with people_week
--      beside gc_money_monday, so the stream lists on Settings → My email schedule and the dev's Email streams.
--   4. The cron people-week-email on the :02 lane (the least busy with gc-statement and statement-round, read off
--      cron.job on 2026-11-06), every five minutes, draining the due rows.

-- 1. The request table.
CREATE TABLE IF NOT EXISTS public.people_week_email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  people_user_ids uuid[] NOT NULL,
  send_at timestamptz NOT NULL,
  repeat_weekly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  attempts int NOT NULL DEFAULT 0,
  CONSTRAINT people_week_email_requests_people_count CHECK (cardinality(people_user_ids) BETWEEN 1 AND 50)
);
COMMENT ON TABLE public.people_week_email_requests IS
  'Task cards (#273, v2.6603): requested sends of Your people''s week (the people_week Report Subscriptions stream). A person asks for themself with the people they picked; people-week-email (pg_cron, the :02 lane) sends each due row from get_people_week_payload(), rebuilt at send time, and a weekly row re-inserts itself +7 days.';

CREATE INDEX IF NOT EXISTS idx_people_week_email_requests_due
  ON public.people_week_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.people_week_email_requests ENABLE ROW LEVEL SECURITY;

-- The person subscribes themself. The office roles pick anyone; everyone else lists only themselves.
DROP POLICY IF EXISTS people_week_email_requests_insert ON public.people_week_email_requests;
CREATE POLICY people_week_email_requests_insert ON public.people_week_email_requests
  FOR INSERT TO authenticated WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND recipient_user_id = (SELECT auth.uid())
    AND (
      (SELECT public.is_dev_or_master_or_assistant())
      OR people_user_ids = ARRAY[(SELECT auth.uid())]
    )
  );

DROP POLICY IF EXISTS people_week_email_requests_read ON public.people_week_email_requests;
CREATE POLICY people_week_email_requests_read ON public.people_week_email_requests
  FOR SELECT TO authenticated USING (
    requested_by = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid()) OR (SELECT public.is_dev())
  );

-- The requester or the recipient stops a pending send; a dev any.
DROP POLICY IF EXISTS people_week_email_requests_cancel ON public.people_week_email_requests;
CREATE POLICY people_week_email_requests_cancel ON public.people_week_email_requests
  FOR DELETE TO authenticated USING (
    ((requested_by = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid())) AND sent_at IS NULL)
    OR (SELECT public.is_dev())
  );

-- No client UPDATE: only the service-role function stamps rows.
REVOKE ALL ON TABLE public.people_week_email_requests FROM anon;
REVOKE UPDATE, TRUNCATE ON TABLE public.people_week_email_requests FROM authenticated;

-- 2. The payload, rebuilt at send time by the service role. The week is Monday to Sunday, p_week_start its Monday.
CREATE OR REPLACE FUNCTION public.get_people_week_payload(p_recipient uuid, p_people uuid[], p_week_start date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH b AS (
  SELECT p_week_start AS ws,
         (p_week_start + 7) AS we,
         (p_week_start + 6) AS last_day,
         (p_week_start::timestamp AT TIME ZONE 'America/Chicago') AS ws_ts,
         ((p_week_start + 7)::timestamp AT TIME ZONE 'America/Chicago') AS we_ts
),
people AS (
  SELECT u.id, COALESCE(NULLIF(trim(u.name), ''), u.email, 'Someone') AS name
  FROM public.users u
  WHERE u.id = ANY (p_people) AND u.archived_at IS NULL
),
cards AS (
  -- The one-off and roadmap cards each person is on, open or done this week.
  SELECT a.user_id, i.id AS instance_id, i.checklist_item_id, it.title, i.scheduled_date, i.completed_at, i.percent_complete, it.roadmap_group_task_id
  FROM public.checklist_instance_assignees a
  JOIN public.checklist_instances i ON i.id = a.checklist_instance_id
  JOIN public.checklist_items it ON it.id = i.checklist_item_id
  CROSS JOIN b
  WHERE a.user_id = ANY (p_people)
    AND (it.repeat_type = 'once' OR it.roadmap_group_task_id IS NOT NULL)
    AND (i.completed_at IS NULL OR i.completed_at >= b.ws_ts)
    AND i.scheduled_date < b.we
),
moves AS (
  SELECT e.instance_id, e.created_at, e.event_type, e.percent, e.body
  FROM public.checklist_instance_events e
  WHERE e.instance_id IN (SELECT instance_id FROM cards)
    AND e.event_type IN ('progress', 'criterion', 'completed', 'reopened')
),
card_rows AS (
  SELECT c.user_id, c.instance_id, c.checklist_item_id, c.title, c.scheduled_date, c.completed_at, c.percent_complete, c.roadmap_group_task_id,
    COALESCE((SELECT m.percent FROM moves m CROSS JOIN b WHERE m.instance_id = c.instance_id AND m.event_type = 'progress' AND m.percent IS NOT NULL AND m.created_at < b.ws_ts ORDER BY m.created_at DESC LIMIT 1), 0) AS from_percent,
    CASE WHEN c.completed_at IS NOT NULL THEN 100 ELSE COALESCE(c.percent_complete, 0) END AS to_percent,
    (c.completed_at IS NOT NULL AND c.completed_at >= b.ws_ts AND c.completed_at < b.we_ts) AS done_this_week,
    EXISTS (SELECT 1 FROM moves m WHERE m.instance_id = c.instance_id AND m.created_at >= b.ws_ts AND m.created_at < b.we_ts) AS moved_this_week,
    (SELECT count(*)::int FROM public.task_criteria tc WHERE tc.retired_at IS NULL AND (tc.checklist_item_id = c.checklist_item_id OR (c.roadmap_group_task_id IS NOT NULL AND tc.roadmap_task_id = c.roadmap_group_task_id))) AS lines_total,
    (SELECT count(*)::int FROM public.task_criteria_checks k JOIN public.task_criteria tc ON tc.id = k.criterion_id WHERE k.instance_id = c.instance_id AND tc.retired_at IS NULL) AS lines_ticked,
    (SELECT count(*)::int FROM public.task_photos p WHERE p.instance_id = c.instance_id AND p.taken_at >= b.ws_ts AND p.taken_at < b.we_ts) AS photos,
    (SELECT m.body FROM moves m WHERE m.instance_id = c.instance_id AND m.event_type = 'progress' AND m.body <> '' AND m.created_at >= b.ws_ts AND m.created_at < b.we_ts ORDER BY m.created_at DESC LIMIT 1) AS last_words
  FROM cards c
  CROSS JOIN b
),
roadmap_rows AS (
  SELECT cr.user_id, cr.title AS task_title, g.title AS stage_title, r.title AS roadmap_title, cr.to_percent, cr.done_this_week
  FROM card_rows cr
  JOIN public.checklist_tech_tree_group_tasks t ON t.id = cr.roadmap_group_task_id
  JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
  JOIN public.checklist_tech_tree_roadmaps r ON r.id = g.roadmap_id
  WHERE cr.done_this_week OR cr.moved_this_week
),
job_rows AS (
  -- The jobs the person clocked on this week, the job's percent now, and the reports they filed on it.
  SELECT cs.user_id, j.id AS job_id,
    COALESCE(NULLIF(trim(j.hcp_number), ''), '') AS hcp_number,
    COALESCE(NULLIF(trim(j.customer_name), ''), '') AS customer_name,
    j.pct_complete,
    count(DISTINCT cs.id)::int AS sessions,
    (SELECT count(*)::int FROM public.reports rp CROSS JOIN b WHERE rp.job_ledger_id = j.id AND rp.created_by_user_id = cs.user_id AND rp.created_at >= b.ws_ts AND rp.created_at < b.we_ts) AS reports
  FROM public.clock_sessions cs
  JOIN public.jobs_ledger j ON j.id = cs.job_ledger_id
  CROSS JOIN b
  WHERE cs.user_id = ANY (p_people)
    AND cs.clocked_in_at >= b.ws_ts AND cs.clocked_in_at < b.we_ts
    AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
  GROUP BY cs.user_id, j.id, j.hcp_number, j.customer_name, j.pct_complete
),
stuck_rows AS (
  -- Review's red line: an open card past a month with no move this week.
  SELECT cr.user_id, cr.title, (b.last_day - cr.scheduled_date) AS age_days
  FROM card_rows cr
  CROSS JOIN b
  WHERE cr.completed_at IS NULL AND NOT cr.moved_this_week AND (b.last_day - cr.scheduled_date) >= 31
)
SELECT jsonb_build_object(
  'week_start', (SELECT ws FROM b),
  'week_end', (SELECT last_day FROM b),
  'people', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', p.id,
      'name', p.name,
      'open', (SELECT count(*)::int FROM card_rows cr WHERE cr.user_id = p.id AND cr.completed_at IS NULL),
      'done', (SELECT count(*)::int FROM card_rows cr WHERE cr.user_id = p.id AND cr.done_this_week),
      'moved', (SELECT count(*)::int FROM card_rows cr WHERE cr.user_id = p.id AND cr.moved_this_week AND NOT cr.done_this_week),
      'photos', (SELECT COALESCE(sum(cr.photos), 0)::int FROM card_rows cr WHERE cr.user_id = p.id),
      'cards', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'title', cr.title, 'from_percent', cr.from_percent, 'to_percent', cr.to_percent, 'done', cr.done_this_week,
          'lines_ticked', cr.lines_ticked, 'lines_total', cr.lines_total, 'photos', cr.photos, 'last_words', cr.last_words
        ) ORDER BY cr.done_this_week DESC, cr.to_percent DESC, cr.title)
        FROM card_rows cr WHERE cr.user_id = p.id AND (cr.done_this_week OR cr.moved_this_week)
      ), '[]'::jsonb),
      'roadmap', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('task_title', rr.task_title, 'stage_title', rr.stage_title, 'roadmap_title', rr.roadmap_title, 'percent', rr.to_percent, 'done', rr.done_this_week) ORDER BY rr.roadmap_title, rr.stage_title, rr.task_title)
        FROM roadmap_rows rr WHERE rr.user_id = p.id
      ), '[]'::jsonb),
      'jobs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('hcp_number', jr.hcp_number, 'customer_name', jr.customer_name, 'pct_complete', jr.pct_complete, 'sessions', jr.sessions, 'reports', jr.reports) ORDER BY jr.hcp_number)
        FROM job_rows jr WHERE jr.user_id = p.id
      ), '[]'::jsonb),
      'stuck', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('title', sr.title, 'age_days', sr.age_days) ORDER BY sr.age_days DESC)
        FROM stuck_rows sr WHERE sr.user_id = p.id
      ), '[]'::jsonb)
    ) ORDER BY p.name)
    FROM people p
  ), '[]'::jsonb)
);
$$;
COMMENT ON FUNCTION public.get_people_week_payload(uuid, uuid[], date) IS
  'Task cards (#273, v2.6603): Your people''s week for the people-week-email dispatcher, rebuilt at send time: per person the cards done or moved (from → to percent, lines, photos, the last what-is-left words), the roadmap tasks among them, the jobs they clocked on, and the cards stuck past a month. Service role only.';
REVOKE ALL ON FUNCTION public.get_people_week_payload(uuid, uuid[], date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_people_week_payload(uuid, uuid[], date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_week_payload(uuid, uuid[], date) TO service_role;

-- 3. My email schedule and Email streams list the stream: get_global_email_schedule and get_my_email_schedule restated
-- word for word from 20261010022000, with people_week added beside gc_money_monday.

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
  'people_week_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly,
      'people_count', cardinality(f.people_user_ids)
    ) ORDER BY f.send_at)
    FROM public.people_week_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'gc_money_monday_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.gc_money_monday_email_requests f
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
$function$
;

COMMENT ON FUNCTION public.get_global_email_schedule() IS
  'Dev-only: every stream''s recipients and pending sends for the Settings → Email streams panel; NULL for non-devs. report_email_subscriptions carries authors (v2.3480; the team-lead scope went with the Team leads list, v2.5088).';

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
people_week_oneoffs AS (
  -- Recipient-scoped like gc_money_monday (punch list #273, v2.6603): the person subscribes themself.
  SELECT f.send_at, f.sent_at, f.repeat_weekly, cardinality(f.people_user_ids) AS people_count
  FROM public.people_week_email_requests f
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
gc_money_monday_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.5024); recipients are the money team.
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.gc_money_monday_email_requests f
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
         ), '[]'::jsonb) AS authors
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
      'authors', r.authors
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
      UNION ALL
      SELECT jsonb_build_object('stream', 'gc_money_monday', 'send_at', gm.send_at,
                                'sent_at', gm.sent_at,
                                'repeat_weekly', gm.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(gm.requested_by_name), ''), 'scheduled'))
      FROM gc_money_monday_oneoffs gm
      UNION ALL
      SELECT jsonb_build_object('stream', 'people_week', 'send_at', pw.send_at,
                                'sent_at', pw.sent_at,
                                'repeat_weekly', pw.repeat_weekly,
                                'detail', pw.people_count || ' ' || CASE WHEN pw.people_count = 1 THEN 'person' ELSE 'people' END)
      FROM people_week_oneoffs pw
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
$function$
;

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Self-scoped: every email stream configured to reach auth.uid() — weekly digests (with activity scope + crew filter), pending one-offs across all scheduled streams, event streams, per-estimate subscriptions, and the field-report email subscriptions addressed to the caller (authors, v2.3480; the team-lead scope went with the Team leads list, v2.5088).';

-- 4. The cron: the :02 lane, every five minutes, draining the due rows. Unscheduled first, so a second run leaves one row.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'people-week-email';

SELECT cron.schedule(
  'people-week-email',
  '2-57/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/people-week-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.people_week_email_requests WHERE sent_at IS NULL AND send_at <= now() AND attempts < 5);
  $$
);

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal on the new table.
select public.apply_read_only_write_blocks();
select public.apply_read_only_stmt_blocks();
select public.apply_digital_twin_write_blocks();
select public.apply_archived_read_blocks();
