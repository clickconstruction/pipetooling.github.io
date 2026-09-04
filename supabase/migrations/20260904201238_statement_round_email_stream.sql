SET lock_timeout = '3s';

-- Statement round nudges + email stream (v2.2771). Owner ask: the sender's only
-- prompt was a Pipeline card nobody sees unless they open the board. Three
-- pieces here, all read-side except the request table:
--
--   1. get_gc_statement_email_payload gains `row_key` per row (invoice id for
--      invoice rows, job id for shells — the client's GcReviewRow.key), so a
--      server-side caller can diff a group against a certification snapshot
--      the way gcGroupCertStatus does. Body is the LIVE prod definition
--      (pg_get_functiondef, v2.1400 rule) with only the key added.
--   2. get_statement_round_for_user(p_user_id) — service-role payload: the
--      v2.2072 round (buildStatementRound) computed server-side for one
--      sender: GC groups >= $10,000, cert status by snapshot diff, this
--      week's marks, sender = customers.statement_sender_user_id else the
--      modal Account Man over the group's rows. get_my_statement_round() is
--      the self-scoped wrapper (office roles) behind the Dashboard Needs You
--      row. Fidelity is checked against the GC Review panel before first use.
--   3. statement_round_email_requests + pg_cron + schedule-surface branches —
--      the `statement_round` REPORT_SUBSCRIPTIONS stream: a morning email of
--      the recipient's round, rebuilt fresh at send time by
--      statement-round-email-dispatch. Co-rides the :02 lane with
--      gc-statement-email-dispatch (one tenant there vs four on :04).
--
-- Weeks are Monday-keyed in America/Chicago, matching gcReviewWeekStartYmd.

-- ── 1. Payload RPC: add row_key (live body + one field) ──────────────────────

CREATE OR REPLACE FUNCTION public.get_gc_statement_email_payload(p_group_by text DEFAULT 'gc'::text, p_entity_id uuid DEFAULT NULL::uuid, p_include_collections boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT CASE WHEN p_group_by = 'development' THEN 'development' ELSE 'gc' END AS group_by
),
billed_inv AS (
  SELECT i.id, i.job_id, i.amount, i.billed_at, i.estimated_bill_date,
         i.id AS row_key,
         j.hcp_number, j.click_number, j.job_name, j.job_address, j.customer_name,
         CASE WHEN (SELECT group_by FROM params) = 'development' THEN j.development_id ELSE j.gc_customer_id END AS entity_id,
         (j.status = 'billed' AND j.collections_at IS NOT NULL) AS in_collections
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.status = 'billed'
    AND j.status <> 'paid'
),
shell_jobs AS (
  SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.customer_name,
         j.id AS row_key,
         j.revenue, j.payments_made,
         CASE WHEN (SELECT group_by FROM params) = 'development' THEN j.development_id ELSE j.gc_customer_id END AS entity_id,
         (j.collections_at IS NOT NULL) AS in_collections
  FROM public.jobs_ledger j
  WHERE j.status = 'billed'
    AND NOT EXISTS (
      SELECT 1 FROM public.jobs_ledger_invoices i
      WHERE i.job_id = j.id AND i.status = 'billed'
    )
),
inv_applied AS (
  SELECT p.invoice_id, COALESCE(SUM(p.amount), 0) AS applied
  FROM public.jobs_ledger_payments p
  WHERE p.invoice_id IS NOT NULL
  GROUP BY p.invoice_id
),
chicago_today AS (
  SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today
),
rows_all AS (
  SELECT
    i.job_id,
    i.row_key,
    i.entity_id,
    i.in_collections,
    COALESCE(NULLIF(trim(i.hcp_number), ''), i.click_number) AS display_number,
    i.job_name,
    i.job_address,
    i.customer_name,
    COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) AS ref_date,
    (i.billed_at IS NULL AND i.estimated_bill_date IS NOT NULL) AS ref_is_estimate,
    GREATEST(0, COALESCE(i.amount, 0) - COALESCE(a.applied, 0)) AS remaining
  FROM billed_inv i
  LEFT JOIN inv_applied a ON a.invoice_id = i.id
  UNION ALL
  SELECT
    j.id,
    j.row_key,
    j.entity_id,
    j.in_collections,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number),
    j.job_name,
    j.job_address,
    j.customer_name,
    NULL::date,
    false,
    COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0)
  FROM shell_jobs j
),
rows_scoped AS (
  SELECT r.*,
         CASE WHEN r.ref_date IS NOT NULL AND r.ref_date <= ct.today
              THEN (ct.today - r.ref_date)
              ELSE NULL END AS age_days
  FROM rows_all r
  CROSS JOIN chicago_today ct
  WHERE (r.in_collections = false OR p_include_collections)
    AND (p_entity_id IS NULL OR r.entity_id = p_entity_id)
),
rows_named AS (
  SELECT r.*,
         CASE WHEN (SELECT group_by FROM params) = 'development'
              THEN (SELECT NULLIF(trim(d.name), '') FROM public.developments d WHERE d.id = r.entity_id)
              ELSE (SELECT NULLIF(trim(c.name), '') FROM public.customers c WHERE c.id = r.entity_id)
         END AS entity_name
  FROM rows_scoped r
),
grouped AS (
  SELECT
    r.entity_id,
    CASE WHEN r.entity_id IS NULL THEN
           CASE WHEN (SELECT group_by FROM params) = 'development' THEN 'No development set' ELSE 'No GC set' END
         ELSE COALESCE(MAX(r.entity_name), CHR(8212)) -- em dash: entity row missing/unnamed
    END AS entity_name,
    (r.entity_id IS NULL) AS is_no_entity,
    COUNT(DISTINCT r.job_id) AS job_count,
    round(SUM(r.remaining)::numeric, 2) AS subtotal,
    MAX(r.age_days) AS oldest_age_days,
    jsonb_agg(jsonb_build_object(
      'job_id', r.job_id,
      'row_key', r.row_key,
      'display_number', r.display_number,
      'job_name', r.job_name,
      'job_address', r.job_address,
      'customer_name', r.customer_name,
      'ref_date', r.ref_date,
      'ref_is_estimate', r.ref_is_estimate,
      'age_days', r.age_days,
      'remaining', round(r.remaining::numeric, 2),
      'in_collections', r.in_collections
    ) ORDER BY NULLIF(lower(trim(r.job_address)), '') ASC NULLS LAST, r.age_days DESC NULLS LAST, r.remaining DESC) AS rows
  FROM rows_named r
  GROUP BY r.entity_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'group_by', (SELECT group_by FROM params),
  'include_collections', p_include_collections,
  'grand_total', COALESCE((SELECT round(SUM(subtotal)::numeric, 2) FROM grouped), 0),
  'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'entity_id', g.entity_id,
      'entity_name', g.entity_name,
      'is_no_entity', g.is_no_entity,
      'job_count', g.job_count,
      'subtotal', g.subtotal,
      'oldest_age_days', g.oldest_age_days,
      'rows', g.rows
    ) ORDER BY g.is_no_entity ASC, g.subtotal DESC, g.entity_name ASC) FROM grouped g), '[]'::jsonb)
);
$function$;

-- ── 2. Round payload: service-role per-user + self-scoped wrapper ─────────────

CREATE OR REPLACE FUNCTION public.get_statement_round_for_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH chicago AS (
  SELECT today,
         (today - ((EXTRACT(ISODOW FROM today)::int - 1)))::date AS monday
  FROM (SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today) t
),
payload AS (
  SELECT public.get_gc_statement_email_payload('gc', NULL, false) AS p
),
groups AS (
  SELECT (g->>'entity_id')::uuid AS gc_id,
         g->>'entity_name' AS gc_name,
         (g->>'subtotal')::numeric AS subtotal,
         (g->>'job_count')::int AS job_count,
         NULLIF(g->>'oldest_age_days', '')::int AS oldest_age_days,
         COALESCE(g->'rows', '[]'::jsonb) AS rows
  FROM payload, jsonb_array_elements(p->'groups') g
  WHERE COALESCE((g->>'is_no_entity')::boolean, true) = false
    AND g->>'entity_id' IS NOT NULL
    AND (g->>'subtotal')::numeric >= 10000
),
latest_cert AS (
  SELECT DISTINCT ON (c.gc_customer_id)
         c.gc_customer_id, c.total, c.snapshot, c.certified_by_name, c.certified_at
  FROM public.gc_review_certifications c
  CROSS JOIN chicago ch
  WHERE c.week_start = ch.monday
  ORDER BY c.gc_customer_id, c.certified_at DESC
),
cert_state AS (
  -- Mirrors gcGroupCertStatus: no cert → uncertified; unreadable snapshot →
  -- compare totals; else the row set (key + remaining cents) must match.
  SELECT g.gc_id,
         CASE
           WHEN c.gc_customer_id IS NULL THEN 'uncertified'
           WHEN c.snapshot IS NULL OR jsonb_typeof(c.snapshot->'rows') <> 'array' THEN
             CASE WHEN round(g.subtotal * 100) = round(COALESCE(c.total, 0) * 100) THEN 'certified' ELSE 'changed' END
           WHEN (SELECT count(DISTINCT s->>'key') FROM jsonb_array_elements(c.snapshot->'rows') s) <> jsonb_array_length(g.rows) THEN 'changed'
           WHEN EXISTS (
             SELECT 1 FROM jsonb_array_elements(g.rows) r
             WHERE NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements(c.snapshot->'rows') s
               WHERE s->>'key' = r->>'row_key'
                 AND round((s->>'remaining')::numeric * 100) = round((r->>'remaining')::numeric * 100)
             )
           ) THEN 'changed'
           ELSE 'certified'
         END AS cert_state,
         c.certified_by_name
  FROM groups g
  LEFT JOIN latest_cert c ON c.gc_customer_id = g.gc_id
),
marks AS (
  SELECT m.gc_customer_id, m.action, m.acted_by
  FROM public.gc_statement_round_marks m
  CROSS JOIN chicago ch
  WHERE m.week_start = ch.monday
),
-- Account Man fallback: the most common account_manager_user_id over the
-- group's rows (deriveGcAccountMen tallies per row, not per job).
am AS (
  SELECT g.gc_id, jl.account_manager_user_id AS am_id, count(*) AS n
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(g.rows) r
  JOIN public.jobs_ledger jl ON jl.id = (r->>'job_id')::uuid
  WHERE jl.account_manager_user_id IS NOT NULL
  GROUP BY g.gc_id, jl.account_manager_user_id
),
am_best AS (
  SELECT DISTINCT ON (gc_id) gc_id, am_id FROM am ORDER BY gc_id, n DESC, am_id
),
items AS (
  SELECT g.gc_id, g.gc_name, g.subtotal, g.job_count, g.oldest_age_days,
         COALESCE(c.statement_sender_user_id, ab.am_id) AS sender_user_id,
         cs.cert_state, cs.certified_by_name,
         CASE
           WHEN m.action IS NOT NULL THEN m.action
           WHEN cs.cert_state <> 'certified' THEN 'needs_certify'
           WHEN COALESCE(c.statement_sender_user_id, ab.am_id) IS NULL THEN 'needs_sender'
           ELSE 'ready'
         END AS state
  FROM groups g
  LEFT JOIN public.customers c ON c.id = g.gc_id
  LEFT JOIN am_best ab ON ab.gc_id = g.gc_id
  LEFT JOIN cert_state cs ON cs.gc_id = g.gc_id
  LEFT JOIN marks m ON m.gc_customer_id = g.gc_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'week_start', to_char((SELECT monday FROM chicago), 'YYYY-MM-DD'),
  'user_id', p_user_id,
  'ready', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'gc_id', i.gc_id,
      'gc_name', i.gc_name,
      'amount', round(i.subtotal, 2),
      'job_count', i.job_count,
      'oldest_age_days', i.oldest_age_days,
      'certified_by_name', i.certified_by_name
    ) ORDER BY i.subtotal DESC, i.gc_name)
    FROM items i
    WHERE i.state = 'ready' AND i.sender_user_id = p_user_id
  ), '[]'::jsonb),
  'held', jsonb_build_object(
    'count', (SELECT count(*) FROM items WHERE state = 'needs_certify'),
    'total', COALESCE((SELECT round(sum(subtotal), 2) FROM items WHERE state = 'needs_certify'), 0)
  ),
  'assigned_to_me', (SELECT count(*) FROM items WHERE sender_user_id = p_user_id),
  'sent_by_me', (SELECT count(*) FROM items WHERE state = 'sent' AND sender_user_id = p_user_id)
);
$function$;

COMMENT ON FUNCTION public.get_statement_round_for_user(uuid) IS
  'One sender''s personal statement round (v2.2771), server-side mirror of buildStatementRound/summarizeStatementRound: GC groups >= $10,000 (active billing only), certified this week (snapshot diff = gcGroupCertStatus), unmarked, assigned to p_user_id (customers.statement_sender_user_id, else the group''s Account Man). Service-role only — the statement_round email dispatcher and get_my_statement_round() call it.';

REVOKE EXECUTE ON FUNCTION public.get_statement_round_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_statement_round_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_statement_round_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_statement_round_for_user(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_statement_round()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    THEN public.get_statement_round_for_user((SELECT auth.uid()))
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.get_my_statement_round() IS
  'Self-scoped statement round for the Dashboard Needs You row (v2.2771): get_statement_round_for_user(auth.uid()) for office roles, NULL otherwise.';

REVOKE EXECUTE ON FUNCTION public.get_my_statement_round() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_statement_round() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_statement_round() TO authenticated;

-- ── 3. Request table (crew_day shape, office-only both sides) ────────────────

CREATE TABLE IF NOT EXISTS public.statement_round_email_requests (
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

COMMENT ON TABLE public.statement_round_email_requests IS
  'Requested sends of the "Your statement round" email (v2.2771). Office roles insert for themselves or another office user; statement-round-email-dispatch (pg_cron */5, :02 lane) processes rows with send_at <= now(), rebuilds the RECIPIENT''s round fresh via get_statement_round_for_user, and stamps sent_at/error. repeat_weekly rows re-enqueue +7d on successful send; cancelling the pending row ends the chain.';

CREATE INDEX IF NOT EXISTS idx_statement_round_email_requests_due
  ON public.statement_round_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.statement_round_email_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office users insert statement round email requests" ON public.statement_round_email_requests;
CREATE POLICY "Office users insert statement round email requests" ON public.statement_round_email_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    AND EXISTS (
      SELECT 1 FROM public.users r
      WHERE r.id = recipient_user_id
        AND r.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
  );

-- Requester and recipient both see the row (the GC Review block lists the
-- signed-in sender's own chains whoever set them up); devs see all.
DROP POLICY IF EXISTS "Requester recipient devs read statement round email requests" ON public.statement_round_email_requests;
CREATE POLICY "Requester recipient devs read statement round email requests" ON public.statement_round_email_requests
  FOR SELECT USING (
    requested_by = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid()) OR public.is_dev()
  );

-- Cancel = requester or recipient deletes an UNSENT row; devs may clean up.
DROP POLICY IF EXISTS "Requester recipient cancel unsent statement round email requests" ON public.statement_round_email_requests;
CREATE POLICY "Requester recipient cancel unsent statement round email requests" ON public.statement_round_email_requests
  FOR DELETE USING (
    ((requested_by = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid())) AND sent_at IS NULL)
    OR public.is_dev()
  );

-- No client UPDATE policy — only the service-role edge function stamps rows.

-- ── pg_cron: dispatch every 5 minutes (co-rides the :02 lane with gc-statement-email-dispatch).

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'statement-round-email-dispatch';

SELECT cron.schedule(
  'statement-round-email-dispatch',
  '2-57/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/statement-round-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ── Schedule surfaces: get_my_email_schedule() + get_global_email_schedule()
-- gain a statement_round branch. Bodies are the LIVE definitions (v2.1400
-- rule, pulled with pg_get_functiondef on 2026-09-04 and diffed clean against
-- 20260901220804), reproduced verbatim with only the statement_round additions.

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
  'Everything the app is configured to email the calling user: weekly digests, one-off sends addressed to them (incl. payment_forecast v2.2223, money_waiting v2.2565, crew_day v2.2603, statement_round v2.2771), and every standing event-stream subscription (Paid in Full, Payment received, Estimate accepted, Ready to Bill v2 per-person channels). Self-scoped; EXECUTE for authenticated.';

COMMENT ON FUNCTION public.get_global_email_schedule() IS
  'Dev-only org-wide view of every email stream: recurring digests with recipients, the standing event lists (Paid in Full, Payment received, Ready to Bill with per-person email/push flags), and pending one-off sends (incl. payment_forecast v2.2223, money_waiting v2.2565, crew_day v2.2603, statement_round v2.2771). Returns NULL for non-devs.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
