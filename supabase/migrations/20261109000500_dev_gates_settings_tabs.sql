SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 1, v2.6753. On 2026-11-08 the owner took every recommendation of the audit
-- table in to-dos/dev-gates/README.md as written. This PR opens the Settings tabs and company cards of rows 4, 5,
-- 14, 15, 17, 18 and 32; the client lines alone would not open them, since each writes rows only a dev could write:
--   row 5  Emails & reports — the streams' recipient lists and the two signed-agreement switches in app_settings, the
--          report schedules' on/off and their recipients, and get_global_email_schedule, which answered NULL to anyone
--          but a dev; now the owner too (is_master_or_dev()).
--   row 14 Office address — app_settings.office_address_v1, the owner too.
--   row 15 Map default view — app_settings.map_default_view_v1, the office (is_office_staff()).
--   rows 18, 32  Pin money cards for others, Pin for someone — user_pinned_tabs rows of other people, the owner too.
-- Rows 4 and 17 are client lines alone (What the team sees reads what the owner may already read; the salaried
-- workday pointer is a link). Additive and idempotent: no table is created, so no fence call is owed. The policies are
-- key-scoped, the shape every Settings switch the owner holds already uses (master_or_dev_update_*); the dev's
-- "Devs can manage app settings" policy stands beside them.

-- 1) Emails & reports (row 5): the recipient lists and switches the Email streams section upserts.
DROP POLICY IF EXISTS master_or_dev_insert_email_streams ON public.app_settings;
CREATE POLICY master_or_dev_insert_email_streams
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (key = ANY (ARRAY['paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'portal_request_email_recipients_v1', 'ready_to_bill_notify_recipients_v2', 'signed_agreements_notify_recipients_v1', 'signed_agreements_auto_create_job_estimates', 'signed_agreements_auto_create_job_bids']) AND public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_update_email_streams ON public.app_settings;
CREATE POLICY master_or_dev_update_email_streams
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = ANY (ARRAY['paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'portal_request_email_recipients_v1', 'ready_to_bill_notify_recipients_v2', 'signed_agreements_notify_recipients_v1', 'signed_agreements_auto_create_job_estimates', 'signed_agreements_auto_create_job_bids']) AND public.is_master_or_dev())
  WITH CHECK (key = ANY (ARRAY['paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'portal_request_email_recipients_v1', 'ready_to_bill_notify_recipients_v2', 'signed_agreements_notify_recipients_v1', 'signed_agreements_auto_create_job_estimates', 'signed_agreements_auto_create_job_bids']) AND public.is_master_or_dev());

-- The report schedules' on/off switch and a recipient's removal: a dev or the owner, on any stream (the office's own
-- scope rule, recurring_job_report_schedules_update_dma, stands beside this one).
DROP POLICY IF EXISTS master_or_dev_update_recurring_job_report_schedules ON public.recurring_job_report_schedules;
CREATE POLICY master_or_dev_update_recurring_job_report_schedules
  ON public.recurring_job_report_schedules
  FOR UPDATE
  TO authenticated
  USING (public.is_master_or_dev())
  WITH CHECK (public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_delete_recurring_job_report_recipients ON public.recurring_job_report_schedule_recipients;
CREATE POLICY master_or_dev_delete_recurring_job_report_recipients
  ON public.recurring_job_report_schedule_recipients
  FOR DELETE
  TO authenticated
  USING (public.is_master_or_dev());

-- 2) Office address (row 14): the shop's address the bid distances measure from. The block upserts and clears it.
DROP POLICY IF EXISTS master_or_dev_insert_office_address ON public.app_settings;
CREATE POLICY master_or_dev_insert_office_address
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (key = 'office_address_v1' AND public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_update_office_address ON public.app_settings;
CREATE POLICY master_or_dev_update_office_address
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'office_address_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'office_address_v1' AND public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_delete_office_address ON public.app_settings;
CREATE POLICY master_or_dev_delete_office_address
  ON public.app_settings
  FOR DELETE
  TO authenticated
  USING (key = 'office_address_v1' AND public.is_master_or_dev());

-- 3) Map default view (row 15): where the Map opens, a convenience the office sets. The block upserts and clears it.
DROP POLICY IF EXISTS office_insert_map_default_view ON public.app_settings;
CREATE POLICY office_insert_map_default_view
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (key = 'map_default_view_v1' AND public.is_office_staff());

DROP POLICY IF EXISTS office_update_map_default_view ON public.app_settings;
CREATE POLICY office_update_map_default_view
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'map_default_view_v1' AND public.is_office_staff())
  WITH CHECK (key = 'map_default_view_v1' AND public.is_office_staff());

DROP POLICY IF EXISTS office_delete_map_default_view ON public.app_settings;
CREATE POLICY office_delete_map_default_view
  ON public.app_settings
  FOR DELETE
  TO authenticated
  USING (key = 'map_default_view_v1' AND public.is_office_staff());

-- 4) Pins on other people's dashboards (rows 18 and 32): Settings → Your dashboard's money cards for a leader, and the
-- pin footer's Pin for someone. The dev's three any-row policies stand; the owner gains the same three.
DROP POLICY IF EXISTS master_or_dev_select_any_pinned_tab ON public.user_pinned_tabs;
CREATE POLICY master_or_dev_select_any_pinned_tab
  ON public.user_pinned_tabs
  FOR SELECT
  TO authenticated
  USING (public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_insert_any_pinned_tab ON public.user_pinned_tabs;
CREATE POLICY master_or_dev_insert_any_pinned_tab
  ON public.user_pinned_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_delete_any_pinned_tab ON public.user_pinned_tabs;
CREATE POLICY master_or_dev_delete_any_pinned_tab
  ON public.user_pinned_tabs
  FOR DELETE
  TO authenticated
  USING (public.is_master_or_dev());

-- 5) get_global_email_schedule (row 5): restated word for word from 20261106233000 with one change, the gate reads
-- is_master_or_dev() so the owner's Emails & reports tab fills; anyone else still reads NULL.
CREATE OR REPLACE FUNCTION public.get_global_email_schedule()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (SELECT public.is_master_or_dev() AS ok),
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
  'The owner''s and a dev''s (punch list #188 row 5, v2.6753; a dev''s alone before): every stream''s recipients and pending sends for Settings → Emails & reports; NULL for anyone else. report_email_subscriptions carries authors (v2.3480; the team-lead scope went with the Team leads list, v2.5088).';
