SET lock_timeout = '3s';

-- Crew Day → email stream (v2.2603): the Dashboard Crew Day section (v2.2602)
-- becomes a REPORT_SUBSCRIPTIONS stream — an end-of-day "what everyone did
-- today" email, rebuilt fresh at send time and grouped by job in the
-- dispatcher. Built for superintendents (they can schedule their own copies);
-- office roles can schedule for any eligible recipient.
--
-- Pieces (the money-waiting shape, 20260901120000):
--   * crew_day_email_requests — one row per requested send (repeat_weekly
--     chains re-enqueue +7d on success);
--   * get_crew_day_payload_for_user(p_user_id, p_day) — service-role payload:
--     the v2.2602 get_crew_day_payload scoping computed for the RECIPIENT
--     (service role has no auth.uid(), and can_access_project_row reads
--     auth.uid() — so the superintendent branch scopes directly via
--     project_superintendents, the assignment-only rule since v2.921);
--   * cron registration co-riding the :04 lane (least-active lane per the
--     v2.1919 stagger — same call as money-waiting/payment-forecast; all
--     no-op with one indexed query on empty ticks);
--   * get_my_email_schedule / get_global_email_schedule gain a crew_day
--     branch (bodies verbatim from 20260901120000).
--
-- Hours only, never wages — same payload rule as the section.

-- ── Requests table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_day_email_requests (
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

COMMENT ON TABLE public.crew_day_email_requests IS
  'Requested sends of the Crew Day email (v2.2603). Crew-day-eligible users insert; the crew-day-email-dispatch edge function (pg_cron */5) processes rows with send_at <= now(), rebuilds that recipient''s crew day fresh, and stamps sent_at/error. repeat_weekly rows re-enqueue +7d on successful send. The emailed day is the send''s Chicago calendar day.';

CREATE INDEX IF NOT EXISTS idx_crew_day_email_requests_due
  ON public.crew_day_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.crew_day_email_requests ENABLE ROW LEVEL SECURITY;

-- Crew-day-eligible roles insert their own requests, and only for eligible
-- recipients (mirrors isCrewDayRole / the payload RPC's role gate — the data
-- must never be addressed to a field role).
DROP POLICY IF EXISTS "Eligible users insert own crew day email requests" ON public.crew_day_email_requests;
CREATE POLICY "Eligible users insert own crew day email requests" ON public.crew_day_email_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')
    )
    AND EXISTS (
      SELECT 1 FROM public.users r
      WHERE r.id = recipient_user_id
        AND r.role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')
    )
  );

-- Creators see their own requests (the modal's pending list); devs see all.
DROP POLICY IF EXISTS "Creators and devs read crew day email requests" ON public.crew_day_email_requests;
CREATE POLICY "Creators and devs read crew day email requests" ON public.crew_day_email_requests
  FOR SELECT USING (requested_by = (SELECT auth.uid()) OR public.is_dev());

-- Cancel = creator deletes an UNSENT row (sent rows are audit history; devs may clean up).
DROP POLICY IF EXISTS "Creators cancel own unsent crew day email requests" ON public.crew_day_email_requests;
CREATE POLICY "Creators cancel own unsent crew day email requests" ON public.crew_day_email_requests
  FOR DELETE USING (
    (requested_by = (SELECT auth.uid()) AND sent_at IS NULL) OR public.is_dev()
  );

-- No client UPDATE policy — only the service-role edge function stamps rows.

-- ── Payload RPC (service_role only) ──────────────────────────────────────────
--
-- Fidelity note: mirrors get_crew_day_payload (20260901215024) with the
-- caller replaced by p_user_id. The one substantive difference: the
-- superintendent branch cannot use can_access_project_row (it reads
-- auth.uid(), NULL under service role), so it scopes directly via
-- project_superintendents — the assignment-only access rule (v2.921+).
-- Keep the two functions in sync when either changes.

CREATE OR REPLACE FUNCTION public.get_crew_day_payload_for_user(p_user_id uuid, p_day date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_company boolean;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_day IS NULL THEN
    RETURN jsonb_build_object('error', 'bad_request');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF v_role IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    v_company := true;
  ELSIF v_role = 'superintendent' THEN
    v_company := false;
  ELSE
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  WITH day_sessions AS (
    SELECT cs.user_id, cs.job_ledger_id AS job_id, cs.clocked_in_at, cs.clocked_out_at
    FROM public.clock_sessions cs
    WHERE cs.work_date = p_day
      AND cs.revoked_at IS NULL
      AND cs.rejected_at IS NULL
  ),
  day_blocks AS (
    SELECT b.assignee_user_id AS user_id, b.job_id, b.bid_id, b.time_start, b.time_end, b.note
    FROM public.job_schedule_blocks b
    WHERE b.work_date = p_day
  ),
  day_reports AS (
    SELECT r.id, r.created_by_user_id AS user_id, r.job_ledger_id AS job_id,
           r.created_at, rt.name AS template_name, r.field_values
    FROM public.reports r
    JOIN public.report_templates rt ON rt.id = r.template_id
    WHERE (r.created_at AT TIME ZONE 'America/Chicago')::date = p_day
      AND r.job_ledger_id IS NOT NULL
  ),
  involved_job_ids AS (
    SELECT DISTINCT x.job_id FROM (
      SELECT s.job_id FROM day_sessions s WHERE s.job_id IS NOT NULL
      UNION ALL
      SELECT b.job_id FROM day_blocks b WHERE b.job_id IS NOT NULL
      UNION ALL
      SELECT r.job_id FROM day_reports r
    ) x
  ),
  allowed_job_ids AS (
    SELECT j.job_id
    FROM involved_job_ids j
    JOIN public.jobs_ledger jl ON jl.id = j.job_id
    WHERE v_company
       OR (jl.project_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.project_superintendents ps
         WHERE ps.project_id = jl.project_id AND ps.superintendent_id = p_user_id
       ))
       OR EXISTS (
         SELECT 1 FROM public.jobs_ledger_team_members jtm
         WHERE jtm.job_id = jl.id AND jtm.user_id = p_user_id
       )
  ),
  scoped_sessions AS (
    SELECT s.* FROM day_sessions s
    WHERE v_company
       OR (s.job_id IS NOT NULL AND s.job_id IN (SELECT a.job_id FROM allowed_job_ids a))
  ),
  scoped_blocks AS (
    SELECT b.* FROM day_blocks b
    WHERE v_company
       OR (b.job_id IS NOT NULL AND b.job_id IN (SELECT a.job_id FROM allowed_job_ids a))
  ),
  scoped_reports AS (
    SELECT r.* FROM day_reports r
    WHERE v_company
       OR r.job_id IN (SELECT a.job_id FROM allowed_job_ids a)
  ),
  day_pct_notes AS (
    SELECT n.job_id, n.body, n.created_at
    FROM public.jobs_ledger_thread_notes n
    WHERE n.job_id IN (SELECT a.job_id FROM allowed_job_ids a)
      AND (n.created_at AT TIME ZONE 'America/Chicago')::date = p_day
      AND n.body LIKE '%\% complete%'
  )
  SELECT jsonb_build_object(
    'day', to_char(p_day, 'YYYY-MM-DD'),
    'sessions', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'user_id', s.user_id,
        'job_id', s.job_id,
        'clocked_in_at', s.clocked_in_at,
        'clocked_out_at', s.clocked_out_at
      ) ORDER BY s.clocked_in_at) FROM scoped_sessions s),
      '[]'::jsonb),
    'blocks', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'user_id', b.user_id,
        'job_id', b.job_id,
        'bid_id', b.bid_id,
        'time_start', b.time_start,
        'time_end', b.time_end,
        'note', b.note
      ) ORDER BY b.time_start) FROM scoped_blocks b),
      '[]'::jsonb),
    'reports', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'job_id', r.job_id,
        'created_at', r.created_at,
        'template_name', r.template_name,
        'field_values', r.field_values
      ) ORDER BY r.created_at) FROM scoped_reports r),
      '[]'::jsonb),
    'pct_notes', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'job_id', n.job_id,
        'body', n.body,
        'created_at', n.created_at
      ) ORDER BY n.created_at) FROM day_pct_notes n),
      '[]'::jsonb),
    'users', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name))
       FROM public.users u
       WHERE u.id IN (
         SELECT s.user_id FROM scoped_sessions s
         UNION SELECT b.user_id FROM scoped_blocks b
         UNION SELECT r.user_id FROM scoped_reports r
       )),
      '[]'::jsonb),
    'jobs', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', jl.id,
        'hcp_number', jl.hcp_number,
        'click_number', jl.click_number,
        'job_name', jl.job_name,
        'job_address', jl.job_address,
        'status', jl.status,
        'pct_complete', jl.pct_complete
      ))
       FROM public.jobs_ledger jl
       WHERE jl.id IN (SELECT a.job_id FROM allowed_job_ids a)),
      '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_crew_day_payload_for_user(uuid, date) IS
  'Crew Day email payload for crew-day-email-dispatch (v2.2603). Service-role only. get_crew_day_payload (v2.2602) computed for the RECIPIENT: office roles company-wide; superintendent scoped via project_superintendents + jobs_ledger_team_members; other roles {error:forbidden}. Keep in sync with get_crew_day_payload.';

REVOKE EXECUTE ON FUNCTION public.get_crew_day_payload_for_user(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_crew_day_payload_for_user(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_crew_day_payload_for_user(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_crew_day_payload_for_user(uuid, date) TO service_role;

-- ── pg_cron: dispatch every 5 minutes (co-rides the :04 lane — see header note).

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'crew-day-email-dispatch';

SELECT cron.schedule(
  'crew-day-email-dispatch',
  '4-59/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/crew-day-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ── Schedule surfaces: get_my_email_schedule() + get_global_email_schedule()
-- gain a crew_day branch. Bodies are the LIVE definitions (v2.1400 rule) —
-- last rebuilt by 20260901120000 (v2.2565), reproduced verbatim with only the
-- crew_day additions.

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

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Everything the app is configured to email the calling user: weekly digests, one-off sends addressed to them (incl. payment_forecast v2.2223, money_waiting v2.2565, crew_day v2.2603), and every standing event-stream subscription (Paid in Full, Payment received, Estimate accepted, Ready to Bill v2 per-person channels). Self-scoped; EXECUTE for authenticated.';

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

COMMENT ON FUNCTION public.get_global_email_schedule() IS
  'Dev-only org-wide view of every email stream: recurring digests with recipients, the standing event lists (Paid in Full, Payment received, Ready to Bill with per-person email/push flags), and pending one-off sends (incl. payment_forecast v2.2223, money_waiting v2.2565, crew_day v2.2603). Returns NULL for non-devs.';


-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
