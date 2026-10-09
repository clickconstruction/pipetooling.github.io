SET lock_timeout = '3s';

-- GC mode, Owner Billing's O7b: the Monday money email, a Report Subscriptions stream (gc_money_monday,
-- docs/REPORT_SUBSCRIPTIONS.md). The money team (gc_money_team(): dev, the leaders, the controller) asks for it for
-- themselves or each other, a weekday and a time each, weekly; the gc-money-monday-email function sends each due row
-- from get_gc_money_monday_payload(), rebuilt at send time. No six weeks line yet (the lead's call 2, 2026-10-08).

-- 1) The requests: one row per send, a weekly chain re-inserting itself on each good send (the house pattern).
CREATE TABLE IF NOT EXISTS public.gc_money_monday_email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL,
  repeat_weekly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  attempts int NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.gc_money_monday_email_requests IS
  'GC mode (O7b, v2.5024): requested sends of the Monday money email (gc_money_monday Report Subscriptions stream). The money team asks for a money-team recipient; gc-money-monday-email (pg_cron, the :03 lane) sends each due row from get_gc_money_monday_payload(), rebuilt at send time, and a weekly row re-inserts itself +7 days.';

CREATE INDEX IF NOT EXISTS idx_gc_money_monday_email_requests_due
  ON public.gc_money_monday_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.gc_money_monday_email_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_money_monday_email_requests_insert ON public.gc_money_monday_email_requests;
CREATE POLICY gc_money_monday_email_requests_insert ON public.gc_money_monday_email_requests
  FOR INSERT TO authenticated WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND (SELECT public.gc_money_team())
    AND EXISTS (
      SELECT 1 FROM public.users r
      WHERE r.id = recipient_user_id AND r.role IN ('dev', 'master_technician', 'controller')
    )
  );

DROP POLICY IF EXISTS gc_money_monday_email_requests_read ON public.gc_money_monday_email_requests;
CREATE POLICY gc_money_monday_email_requests_read ON public.gc_money_monday_email_requests
  FOR SELECT TO authenticated USING (
    requested_by = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid()) OR (SELECT public.is_dev())
  );

-- The requester or the recipient stops a pending send; a dev any.
DROP POLICY IF EXISTS gc_money_monday_email_requests_cancel ON public.gc_money_monday_email_requests;
CREATE POLICY gc_money_monday_email_requests_cancel ON public.gc_money_monday_email_requests
  FOR DELETE TO authenticated USING (
    ((requested_by = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid())) AND sent_at IS NULL)
    OR (SELECT public.is_dev())
  );

-- No client UPDATE: only the service-role function stamps rows.
REVOKE ALL ON TABLE public.gc_money_monday_email_requests FROM anon;
REVOKE UPDATE, TRUNCATE ON TABLE public.gc_money_monday_email_requests FROM authenticated;

-- 2) The payload, the Money lens's Who owes us as the window reads it (allJobsMoney's owed, ownerPayDue), and last
-- week's sends and certificates. The jobs that are ours, as the board stages them: buyout and building, with closed
-- read as building. Each pay application still open: its certificate, else what we asked, less the payments on its
-- bill; paid on the day a payment closed it (billMoney). Its due day by the window's rule (the lead's call 4): the
-- customer's newest promise made since the certificate, else the certificate's day (or the send's) plus the customer's
-- usual days to pay (get_billed_customer_pay_speeds' per-payer median, inlined: its gate answers NULL to the service
-- role), else plus the contract's days to pay (owner_pay_days). Late first, then on time, then waiting on the
-- architect, the biggest first. Last week is the previous Monday to Sunday, Central. Service role only.
CREATE OR REPLACE FUNCTION public.get_gc_money_monday_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH today AS (
  SELECT public.app_today() AS d
),
week AS (
  SELECT (t.d - (EXTRACT(ISODOW FROM t.d)::int - 1) - 7)::date AS from_d,
         (t.d - (EXTRACT(ISODOW FROM t.d)::int - 1) - 1)::date AS to_d
  FROM today t
),
ours AS (
  SELECT g.project_id, g.billing_job_id, g.owner_pay_days, p.name AS project, p.customer_id,
         COALESCE(c.name, '') AS customer, COALESCE(a.name, '') AS architect
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  LEFT JOIN public.customers c ON c.id = p.customer_id
  LEFT JOIN public.customers a ON a.id = g.architect_customer_id
  WHERE g.stage IN ('buyout', 'building', 'closed')
),
speeds AS (
  SELECT s.payer_id AS customer_id, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.gap_days))::int AS median_days
  FROM public.pay_speed_samples() s
  WHERE s.payer_id IS NOT NULL
  GROUP BY s.payer_id
),
apps AS (
  SELECT o.*, a.id AS pay_app_id, a.number, a.final, a.sent_on, a.due, a.certified, a.certified_on, a.invoice_id,
         COALESCE(a.certified, a.due) AS claimed
  FROM ours o
  JOIN public.gc_owner_pay_apps a ON a.project_id = o.project_id
),
billed AS (
  SELECT ap.*, i.id AS bill_id, i.status AS bill_status,
         COALESCE(pm.paid, 0) AS paid,
         CASE
           WHEN i.id IS NULL THEN NULL
           WHEN pm.full_on IS NOT NULL THEN pm.full_on
           WHEN i.status = 'paid' THEN pm.last_on
         END AS paid_on
  FROM apps ap
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = ap.invoice_id AND i.job_id = ap.billing_job_id
  LEFT JOIN LATERAL (
    SELECT sum(x.amount) AS paid,
           min(x.paid_on) FILTER (WHERE x.running >= i.amount - 0.005) AS full_on,
           max(x.paid_on) AS last_on
    FROM (
      SELECT p.paid_on, p.amount,
             sum(p.amount) OVER (ORDER BY p.paid_on, p.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
      FROM public.jobs_ledger_payments p
      WHERE p.invoice_id = i.id AND p.job_id = ap.billing_job_id AND p.paid_on IS NOT NULL
    ) x
  ) pm ON i.id IS NOT NULL
),
promised AS (
  SELECT b.pay_app_id, pr.promised_date AS by_d,
         lead((pr.created_at AT TIME ZONE 'America/Chicago')::date) OVER w AS next_made_on,
         row_number() OVER (PARTITION BY b.pay_app_id ORDER BY pr.created_at DESC, pr.id DESC) AS rn_desc
  FROM billed b
  JOIN public.job_payment_promises pr ON pr.job_id = b.billing_job_id AND pr.voided_at IS NULL
  WHERE b.invoice_id IS NOT NULL
    AND b.certified_on IS NOT NULL
    AND (pr.created_at AT TIME ZONE 'America/Chicago')::date >= b.certified_on
    AND (b.paid_on IS NULL OR (pr.created_at AT TIME ZONE 'America/Chicago')::date < b.paid_on)
  WINDOW w AS (PARTITION BY b.pay_app_id ORDER BY pr.created_at, pr.id)
),
promise AS (
  SELECT pay_app_id,
         max(by_d) FILTER (WHERE rn_desc = 1) AS newest_by,
         count(*) FILTER (WHERE rn_desc > 1 AND next_made_on > by_d)::int AS missed
  FROM promised
  GROUP BY pay_app_id
),
due AS (
  SELECT b.*, pr.newest_by, COALESCE(pr.missed, 0) AS missed,
         CASE WHEN b.paid_on IS NOT NULL THEN 0 ELSE greatest(0, b.claimed - b.paid) END AS open,
         COALESCE(
           pr.newest_by,
           CASE WHEN COALESCE(sp.median_days, b.owner_pay_days) IS NULL THEN NULL
                ELSE COALESCE(b.certified_on, b.sent_on) + COALESCE(sp.median_days, b.owner_pay_days) END
         ) AS due_on
  FROM billed b
  LEFT JOIN promise pr ON pr.pay_app_id = b.pay_app_id
  LEFT JOIN speeds sp ON sp.customer_id = b.customer_id
),
owed AS (
  SELECT d.*,
         CASE WHEN d.due_on IS NULL THEN 0 ELSE greatest(0, (SELECT t.d FROM today t) - d.due_on) END AS days_late
  FROM due d
  WHERE d.paid_on IS NULL AND d.open > 0.005
)
SELECT jsonb_build_object(
  'today', (SELECT t.d FROM today t),
  'weekFrom', (SELECT w.from_d FROM week w),
  'weekTo', (SELECT w.to_d FROM week w),
  'bills', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'projectId', o.project_id,
      'project', o.project,
      'customer', o.customer,
      'architect', o.architect,
      'number', o.number,
      'final', o.final,
      'sentOn', o.sent_on,
      'certified', o.certified,
      'certifiedOn', o.certified_on,
      'open', round(o.open, 2),
      'dueOn', o.due_on,
      'promised', o.newest_by IS NOT NULL,
      'daysLate', o.days_late,
      'missed', o.missed,
      'waitingOnArchitect', o.certified IS NULL
    ) ORDER BY
      CASE WHEN o.days_late > 0 THEN 0 WHEN o.certified IS NULL THEN 2 ELSE 1 END,
      o.days_late DESC, o.open DESC, o.project, o.number)
    FROM owed o
  ), '[]'::jsonb),
  'sent', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('project', ap.project, 'number', ap.number, 'final', ap.final, 'due', ap.due, 'sentOn', ap.sent_on)
      ORDER BY ap.sent_on, ap.project, ap.number)
    FROM apps ap, week w
    WHERE ap.sent_on BETWEEN w.from_d AND w.to_d
  ), '[]'::jsonb),
  'certified', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('project', ap.project, 'number', ap.number, 'final', ap.final, 'certified', ap.certified, 'certifiedOn', ap.certified_on)
      ORDER BY ap.certified_on, ap.project, ap.number)
    FROM apps ap, week w
    WHERE ap.certified IS NOT NULL AND ap.certified_on BETWEEN w.from_d AND w.to_d
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.get_gc_money_monday_payload() IS
  'GC mode (O7b, v2.5024): the Monday money email''s payload, rebuilt at send time. bills: every pay application still open on the jobs that are ours, as the Money lens''s Who owes us reads it (allJobsMoney, ownerPayDue: the newest promise since the certificate, else the customer''s median days to pay, else owner_pay_days), late first; sent and certified: last week''s, Monday to Sunday, Central. Service role only.';

REVOKE ALL ON FUNCTION public.get_gc_money_monday_payload() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gc_money_monday_payload() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_gc_money_monday_payload() TO service_role;

-- 3) My email schedule and Email streams list the stream: get_my_email_schedule and get_global_email_schedule restated
-- word for word from 20260915180000, with gc_money_monday added beside crew_day.

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
      UNION ALL
      SELECT jsonb_build_object('stream', 'gc_money_monday', 'send_at', gm.send_at,
                                'sent_at', gm.sent_at,
                                'repeat_weekly', gm.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(gm.requested_by_name), ''), 'scheduled'))
      FROM gc_money_monday_oneoffs gm
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
$function$;

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Self-scoped: every email stream configured to reach auth.uid() — weekly digests (with activity scope + crew filter), pending one-offs across all scheduled streams, event streams, per-estimate subscriptions, and the field-report email subscriptions addressed to the caller (authors + team leads, v2.3480).';
COMMENT ON FUNCTION public.get_global_email_schedule() IS
  'Dev-only: every stream''s recipients and pending sends for the Settings → Email streams panel; NULL for non-devs. report_email_subscriptions carries authors + team_leads (v2.3480).';

-- 4) The dispatcher every 5 minutes on the :03 lane, co-riding weekly-movement-email-dispatch: the least-active of the
-- five lanes in cron.job on 2026-10-09 (docs/REPORT_SUBSCRIPTIONS.md, the stagger rule of 20260821010000). Vault
-- PROJECT_URL and CRON_SECRET, uppercase.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gc-money-monday-email';

SELECT cron.schedule(
  'gc-money-monday-email',
  '3-58/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gc-money-monday-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Required after every CREATE TABLE: the training-mode write blocks and the digital twins' fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
