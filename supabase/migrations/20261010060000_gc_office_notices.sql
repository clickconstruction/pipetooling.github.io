SET lock_timeout = '3s';

-- GC mode, Owner Billing's O10a (v2.5137): the office's notices, their record and what is due. Three emails nobody
-- presses: the project manager two days before bill day (the 25th), the architect three days after a pay application
-- went with no certificate yet, and the project manager at five. gc-office-notices (O10b) reads what is due today from
-- get_gc_office_notices_due() and writes the notice's row here before it sends, so each goes once. They go to the
-- project manager only when a real account on the money team, since they carry the bill's money; otherwise to the
-- company's owner. The switch, app_settings gc_office_notices_on_v1, starts 'false'; on, it holds the day it went on,
-- and only a pay application sent since that day hears, so turning it on fires no backlog (the lead's rule). The owner
-- and dev flip it in Settings (O8c's pattern, 20261010042000). Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.gc_office_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT gc_office_notices_kind_known CHECK (kind IN ('bill_day', 'certify_reminder', 'certify_late')),
  -- What it is about: the bill day for bill_day, the pay application for the other two.
  bill_day date,
  pay_app_id uuid REFERENCES public.gc_owner_pay_apps(id) ON DELETE CASCADE,
  -- Who heard it: one of ours, or the architect (a customer record), and the address it went to.
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient_email text NOT NULL
    CONSTRAINT gc_office_notices_address_said CHECK (btrim(recipient_email) <> ''),
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_office_notices_about CHECK (
    (kind = 'bill_day' AND bill_day IS NOT NULL AND pay_app_id IS NULL)
    OR (kind <> 'bill_day' AND pay_app_id IS NOT NULL AND bill_day IS NULL))
);

-- Once each: a project's bill day, and each kind on a pay application. The function's insert skips a row that exists.
CREATE UNIQUE INDEX IF NOT EXISTS gc_office_notices_bill_day_once
  ON public.gc_office_notices (project_id, bill_day) WHERE kind = 'bill_day';
CREATE UNIQUE INDEX IF NOT EXISTS gc_office_notices_pay_app_once
  ON public.gc_office_notices (pay_app_id, kind) WHERE pay_app_id IS NOT NULL;

COMMENT ON TABLE public.gc_office_notices IS
  'GC mode (v2.5137, Owner Billing O10a): one row per office notice sent by gc-office-notices (bill_day, certify_reminder, certify_late), written before its send so the unique indexes make each go once. The service role writes; the money team reads.';

ALTER TABLE public.gc_office_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_office_notices_money_read ON public.gc_office_notices;
CREATE POLICY gc_office_notices_money_read ON public.gc_office_notices FOR SELECT TO authenticated
  USING ((SELECT public.gc_money_team()));
REVOKE ALL ON TABLE public.gc_office_notices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_office_notices FROM authenticated;

-- What is due on a day (today unless the bed names one), for the service role: each notice not sent yet, with what
-- its words need. A pay application's notices go only for one sent since the switch's day (p_since, else the switch's
-- own value when it is a date; none while off). The money team's
-- roles are named here as gc_money_team() names them (access.test.ts holds the two lists together); the bill day is
-- OWNER_BILL_DAY's 25th (ownerBillingNotices.test.ts holds them together).
CREATE OR REPLACE FUNCTION public.get_gc_office_notices_due(p_today date DEFAULT NULL, p_since date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH bill AS (
  SELECT t.d,
         CASE WHEN EXTRACT(DAY FROM t.d) <= 25
              THEN make_date(EXTRACT(YEAR FROM t.d)::int, EXTRACT(MONTH FROM t.d)::int, 25)
              ELSE (make_date(EXTRACT(YEAR FROM t.d)::int, EXTRACT(MONTH FROM t.d)::int, 25) + interval '1 month')::date
         END AS on_d,
         coalesce(p_since, (
           SELECT CASE WHEN s.value_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(s.value_text, 'date')
                       THEN s.value_text::date END
           FROM public.app_settings s WHERE s.key = 'gc_office_notices_on_v1')) AS since
  FROM (SELECT coalesce(p_today, public.app_today()) AS d) t
),
ours AS (
  SELECT g.project_id, g.stage, g.billing_job_id, g.architect_customer_id, g.owner_contract_signed_on,
         p.name AS project, a.name AS architect,
         rp.id AS pm_id, rp.name AS pm_name, rp.email AS pm_email,
         COALESCE(mp.id, public.company_owner_user_id()) AS office_user_id
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  LEFT JOIN public.customers a ON a.id = g.architect_customer_id
  LEFT JOIN public.users rp ON rp.id = g.project_manager_user_id
    AND NOT rp.is_sample AND NOT rp.is_digital_twin AND rp.archived_at IS NULL
  LEFT JOIN public.users mp ON mp.id = rp.id AND mp.role IN ('dev', 'master_technician', 'controller')
),
office AS (
  SELECT o.*, u.name AS office_name, u.email AS office_email
  FROM ours o
  JOIN public.users u ON u.id = o.office_user_id
    AND NOT u.is_sample AND NOT u.is_digital_twin AND u.archived_at IS NULL
),
bill_days AS (
  SELECT jsonb_build_object(
    'kind', 'bill_day', 'projectId', o.project_id, 'project', o.project, 'billingJobId', o.billing_job_id,
    'billDay', b.on_d,
    'number', (SELECT count(*) + 1 FROM public.gc_owner_pay_apps x WHERE x.project_id = o.project_id),
    'waiversOwed', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('company', c.name, 'draws', w.draws, 'final', w.final) ORDER BY c.name), '[]'::jsonb)
      FROM (
        SELECT s.company_id,
               coalesce(array_agg(d.number ORDER BY d.number) FILTER (WHERE NOT d.final), '{}') AS draws,
               bool_or(d.final) AS final
        FROM public.gc_draws d
        JOIN public.gc_sows s ON s.id = d.sow_id
        JOIN public.gc_trade_packages k ON k.id = s.package_id
        WHERE k.project_id = o.project_id AND d.status = 'paid' AND d.waiver = 'conditional'
        GROUP BY s.company_id
      ) w
      JOIN public.gc_companies c ON c.id = w.company_id),
    'to', jsonb_build_object('userId', o.office_user_id, 'name', o.office_name, 'email', o.office_email)
  ) AS notice
  FROM office o CROSS JOIN bill b
  WHERE o.stage = 'building'
    AND o.owner_contract_signed_on IS NOT NULL
    AND b.on_d - b.d BETWEEN 1 AND 2
    AND NOT EXISTS (SELECT 1 FROM public.gc_owner_pay_apps x WHERE x.project_id = o.project_id AND (x.period_to >= b.on_d OR x.final))
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'bill_day' AND n.project_id = o.project_id AND n.bill_day = b.on_d)
),
waiting AS (
  SELECT o.project_id, o.project, o.billing_job_id, o.architect_customer_id, o.architect, o.pm_name, o.pm_email,
         o.office_user_id, a.id AS pay_app_id, a.number, a.final, a.due, a.sent_on, b.d
  FROM ours o
  JOIN public.gc_owner_pay_apps a ON a.project_id = o.project_id
  CROSS JOIN bill b
  WHERE a.sent_on IS NOT NULL AND a.certified_on IS NULL
    AND b.since IS NOT NULL AND a.sent_on >= b.since
),
reminders AS (
  SELECT jsonb_build_object(
    'kind', 'certify_reminder', 'projectId', w.project_id, 'project', w.project, 'billingJobId', w.billing_job_id,
    'payAppId', w.pay_app_id, 'number', w.number, 'final', w.final, 'due', w.due, 'sentOn', w.sent_on,
    'to', jsonb_build_object('customerId', w.architect_customer_id, 'name', w.architect),
    'replyTo', jsonb_build_object('name', w.pm_name, 'email', w.pm_email)
  ) AS notice
  FROM waiting w
  WHERE w.architect_customer_id IS NOT NULL
    AND w.sent_on + 3 <= w.d
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'certify_reminder' AND n.pay_app_id = w.pay_app_id)
),
lates AS (
  SELECT jsonb_build_object(
    'kind', 'certify_late', 'projectId', w.project_id, 'project', w.project, 'billingJobId', w.billing_job_id,
    'payAppId', w.pay_app_id, 'number', w.number, 'final', w.final, 'due', w.due, 'sentOn', w.sent_on,
    'architect', w.architect,
    'remindedOn', (SELECT (n.created_at AT TIME ZONE 'America/Chicago')::date FROM public.gc_office_notices n
                   WHERE n.kind = 'certify_reminder' AND n.pay_app_id = w.pay_app_id),
    'to', jsonb_build_object('userId', u.id, 'name', u.name, 'email', u.email)
  ) AS notice
  FROM waiting w
  JOIN public.users u ON u.id = w.office_user_id
    AND NOT u.is_sample AND NOT u.is_digital_twin AND u.archived_at IS NULL
  WHERE w.sent_on + 5 <= w.d
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'certify_late' AND n.pay_app_id = w.pay_app_id)
)
SELECT jsonb_build_object(
  'today', (SELECT d FROM bill),
  'billDay', (SELECT on_d FROM bill),
  'notices', coalesce((
    SELECT jsonb_agg(x.notice ORDER BY x.notice->>'kind', x.notice->>'project', x.notice->>'number')
    FROM (SELECT notice FROM bill_days UNION ALL SELECT notice FROM reminders UNION ALL SELECT notice FROM lates) x
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.get_gc_office_notices_due(date, date) IS
  'GC mode (v2.5137, Owner Billing O10a): the office notices due today and not sent yet, for gc-office-notices. bill_day: the 23rd and 24th, a job being built with a signed contract and this bill day''s pay application not sent, to the project manager on the money team, else the company owner, with the trades owing an unconditional waiver on a paid draw. certify_reminder: from the third day after a pay application went uncertified, to the architect, Reply-To the project manager. certify_late: from the fifth, to the same office reader as bill_day. The two on a pay application only for one sent since p_since, else since the switch''s day (gc_office_notices_on_v1 holding a date; none while off). p_today: the day to read for (the bed); the cron passes neither. Service role only.';

REVOKE ALL ON FUNCTION public.get_gc_office_notices_due(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_gc_office_notices_due(date, date) TO service_role;

-- The switch: 'false' until the owner turns it on, after the live walk; on, the day it went on.
INSERT INTO public.app_settings (key, value_text)
VALUES ('gc_office_notices_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_gc_office_notices_on" ON public.app_settings;
CREATE POLICY "master_or_dev_update_gc_office_notices_on"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'gc_office_notices_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'gc_office_notices_on_v1' AND public.is_master_or_dev());

-- Required after every CREATE TABLE: the training-mode write blocks and the digital twins' fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
