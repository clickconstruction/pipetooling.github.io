SET lock_timeout = '3s';

-- Ready to Bill notifications (v2.1836): a third stream on the paid-job-email
-- rail. Fires when a jobs_ledger row transitions to status = 'ready_to_bill'
-- (any writer — update_job_status, helpers-working-to-RTB, invoice reverts and
-- deletes that land a job back from Billed — the status trigger below is the
-- single choke point). Unlike the paid/payment streams this one is EMAIL
-- and/or WEB PUSH: the edge function reads 'ready_to_bill_notify_channels_v1'
-- and pushes to recipients' push_subscriptions rows when the push channel is
-- on. Recipients are a separate app_settings list
-- ('ready_to_bill_notify_recipients_v1', same JSON-array-of-user-ids shape as
-- the paid streams); dispatch coalesces same-job ready_to_bill rows to the
-- newest pending one.

-- ── Queue: widen the kind CHECK (additive third value) ───────────────────────

ALTER TABLE public.paid_job_email_queue
  DROP CONSTRAINT IF EXISTS paid_job_email_queue_kind_check;

ALTER TABLE public.paid_job_email_queue
  ADD CONSTRAINT paid_job_email_queue_kind_check
  CHECK (kind IN ('paid_in_full', 'payment', 'ready_to_bill'));

COMMENT ON COLUMN public.paid_job_email_queue.kind IS
  'paid_in_full = job hit status=paid (v2.965 stream); payment = a jobs_ledger_payments row landed (v2.1310 stream); ready_to_bill = job hit status=ready_to_bill (v2.1836 stream, email + web push, separate recipient list).';

-- ── Enqueue trigger: any transition INTO ready_to_bill → one queue row ───────

CREATE OR REPLACE FUNCTION public.enqueue_ready_to_bill_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.paid_job_email_queue (job_ledger_id, kind)
  VALUES (NEW.id, 'ready_to_bill');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_ready_to_bill_notification_au ON public.jobs_ledger;

CREATE TRIGGER enqueue_ready_to_bill_notification_au
AFTER UPDATE OF status ON public.jobs_ledger
FOR EACH ROW
WHEN (NEW.status = 'ready_to_bill' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enqueue_ready_to_bill_notification();

COMMENT ON FUNCTION public.enqueue_ready_to_bill_notification() IS
  'Ready to Bill notification stream (v2.1836): every transition into status=ready_to_bill enqueues kind=ready_to_bill (send-backs from Billed included, by design). The paid-job-email edge function fans out email and/or web push per the channels setting.';

-- ── Settings seeds (empty list, both channels on; the Stages gear manages) ───

INSERT INTO public.app_settings (key, value_text)
VALUES ('ready_to_bill_notify_recipients_v1', '[]')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_text)
VALUES ('ready_to_bill_notify_channels_v1', '{"email":true,"push":true}')
ON CONFLICT (key) DO NOTHING;

-- ── Payload RPC (service_role only; the edge function role-gates callers) ────
-- Deliberately small next to get_paid_job_email_payload: job identity, the
-- billable picture (RTB draft bills + payments so far), and who moved it.

CREATE OR REPLACE FUNCTION public.get_ready_to_bill_email_payload(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH job AS (
  SELECT
    j.id,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
    j.job_name,
    j.job_address,
    j.customer_name,
    j.status,
    st.name AS service_type_name,
    COALESCE(j.revenue, 0) AS revenue
  FROM public.jobs_ledger j
  LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = p_job_id
),
rtb_drafts AS (
  SELECT COALESCE(SUM(i.amount), 0) AS total, COUNT(*) AS cnt
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id AND i.status = 'ready_to_bill'
),
pay AS (
  SELECT COALESCE(SUM(p.amount), 0) AS total
  FROM public.jobs_ledger_payments p
  WHERE p.job_id = p_job_id
),
mover AS (
  SELECT COALESCE(NULLIF(trim(u.name), ''), 'someone') AS name,
         e.changed_at,
         e.from_status
  FROM public.job_status_events e
  LEFT JOIN public.users u ON u.id = e.changed_by_user_id
  WHERE e.job_id = p_job_id AND e.to_status = 'ready_to_bill'
  ORDER BY e.changed_at DESC
  LIMIT 1
)
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM job) THEN NULL ELSE jsonb_build_object(
  'job', (SELECT jsonb_build_object(
    'id', j.id,
    'display_number', j.display_number,
    'job_name', j.job_name,
    'job_address', j.job_address,
    'customer_name', j.customer_name,
    'status', j.status,
    'service_type_name', j.service_type_name,
    'revenue', j.revenue
  ) FROM job j),
  'billing', jsonb_build_object(
    'rtb_draft_total', (SELECT total FROM rtb_drafts),
    'rtb_draft_count', (SELECT cnt FROM rtb_drafts),
    'payments_total', (SELECT total FROM pay)
  ),
  'moved_by', (SELECT jsonb_build_object(
    'name', m.name,
    'at', m.changed_at,
    'from_status', m.from_status
  ) FROM mover m)
) END;
$$;

COMMENT ON FUNCTION public.get_ready_to_bill_email_payload(uuid) IS
  'Payload for the Ready to Bill notification (v2.1836): job identity, RTB draft-bill total/count + payments so far, and the latest ready_to_bill transition (who/when/from). service_role only — the paid-job-email edge function role-gates interactive callers.';

REVOKE EXECUTE ON FUNCTION public.get_ready_to_bill_email_payload(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ready_to_bill_email_payload(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_ready_to_bill_email_payload(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_ready_to_bill_email_payload(uuid) TO service_role;

-- ── Email-schedule surfaces learn the stream ─────────────────────────────────
-- Bodies are the LIVE definitions (v2.1400 rule) — last rebuilt by
-- 20260807073000 (v2.1449), reproduced verbatim with only the ready_to_bill
-- additions: setting_list gains the key, events gains 'ready_to_bill', and the
-- global RPC returns 'ready_to_bill_recipients'.

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
setting_list AS (
  SELECT key,
         CASE WHEN value_text ~ '^\s*\[' THEN value_text::jsonb ELSE '[]'::jsonb END AS ids
  FROM public.app_settings
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'estimate_accepted_notify_recipients_v1', 'ready_to_bill_notify_recipients_v1')
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
    ) x), '[]'::jsonb),
  'events', jsonb_build_object(
    'paid_in_full', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'paid_job_email_recipients_v1'), false),
    'payment_received', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'payment_made_email_recipients_v1'), false),
    'estimate_accepted_always', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'estimate_accepted_notify_recipients_v1'), false),
    'ready_to_bill', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'ready_to_bill_notify_recipients_v1'), false)
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

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Everything the app is configured to email the calling user: weekly digests, one-off sends addressed to them, and every standing event-stream subscription (Paid in Full, Payment received, Estimate accepted, Ready to Bill). Self-scoped; EXECUTE for authenticated.';

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
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'ready_to_bill_notify_recipients_v1')
),
setting_people AS (
  SELECT sl.key, jsonb_agg(jsonb_build_object('user_id', u.id, 'name', COALESCE(NULLIF(trim(u.name), ''), u.email)) ORDER BY u.name) AS people
  FROM setting_list sl
  CROSS JOIN LATERAL jsonb_array_elements_text(sl.ids) AS x(uid)
  JOIN public.users u ON u.id::text = x.uid
  GROUP BY sl.key
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
  'ready_to_bill_recipients', COALESCE((SELECT people FROM setting_people WHERE key = 'ready_to_bill_notify_recipients_v1'), '[]'::jsonb),
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

COMMENT ON FUNCTION public.get_global_email_schedule() IS
  'Dev-only org-wide view of every email stream: recurring digests with recipients, the standing event lists (Paid in Full, Payment received, Ready to Bill), and pending one-off sends. Returns NULL for non-devs.';
