SET lock_timeout = '3s';

-- GC mode, Owner Billing's O12a (v2.5184): the customer's notice 3 days before a bill is due (the owner's word,
-- 2026-10-10: "Yes, build it", behind a switch he turns on after a test copy). One email nobody presses, to the
-- project's customer, from the third day before a certified pay application's bill is due through the day before,
-- once per pay application. Its due day is the one rule Bill the customer, Money and the Monday email read
-- (get_gc_money_monday_payload's dueOn: the customer's newest promise, else the certificate's day plus their usual
-- days to pay, else plus the contract's days to pay), so the notice never names a day the screens do not.
-- gc-office-notices (O12b) reads what is due from get_gc_customer_due_notices() and writes the notice's row in
-- gc_office_notices (kind pay_soon, with the due day it named) before it sends; the table's index on a pay
-- application and kind makes each go once. The switch, app_settings gc_customer_due_notices_on_v1, starts 'false';
-- on, it holds the day it went on, and only a bill certified since that day hears, so turning it on fires no backlog.
-- Additive and idempotent.

ALTER TABLE public.gc_office_notices ADD COLUMN IF NOT EXISTS due_on date;

-- Each check goes on NOT VALID, so the swap holds the table's lock for no scan, then is validated under the lighter
-- lock (the lead's call).
ALTER TABLE public.gc_office_notices
  DROP CONSTRAINT IF EXISTS gc_office_notices_kind_known,
  ADD CONSTRAINT gc_office_notices_kind_known CHECK (kind IN ('bill_day', 'certify_reminder', 'certify_late', 'pay_soon')) NOT VALID,
  DROP CONSTRAINT IF EXISTS gc_office_notices_due_said,
  ADD CONSTRAINT gc_office_notices_due_said CHECK ((kind = 'pay_soon') = (due_on IS NOT NULL)) NOT VALID;
ALTER TABLE public.gc_office_notices VALIDATE CONSTRAINT gc_office_notices_kind_known;
ALTER TABLE public.gc_office_notices VALIDATE CONSTRAINT gc_office_notices_due_said;

COMMENT ON TABLE public.gc_office_notices IS
  'GC mode (v2.5137, Owner Billing O10a; pay_soon v2.5184, O12a): one row per notice sent by gc-office-notices (the office''s bill_day, certify_reminder and certify_late; the customer''s pay_soon), written before its send so the unique indexes make each go once. The service role writes; the money team reads.';
COMMENT ON COLUMN public.gc_office_notices.due_on IS
  'GC mode (v2.5184, Owner Billing O12a): on a pay_soon notice, the due day it told the customer. Null on the office''s kinds.';

-- What the customers hear on a day (today unless the bed names one), for the service role: each certified pay
-- application still open whose due day is 1 to 3 days off, certified before that day and since the switch's day
-- (p_since, else the switch's own value when it is a date; none while off), not on card, and not told yet. To the
-- project's customer, Reply-To the project manager when a real account, else the company's owner.
CREATE OR REPLACE FUNCTION public.get_gc_customer_due_notices(p_today date DEFAULT NULL, p_since date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH t AS (
  SELECT coalesce(p_today, public.app_today()) AS d,
         coalesce(p_since, (
           SELECT CASE WHEN s.value_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(s.value_text, 'date')
                       THEN s.value_text::date END
           FROM public.app_settings s WHERE s.key = 'gc_customer_due_notices_on_v1')) AS since
),
bills AS (
  SELECT (b->>'projectId')::uuid AS project_id, (b->>'number')::int AS number, (b->>'final')::boolean AS final,
         (b->>'certified')::numeric AS certified, (b->>'certifiedOn')::date AS certified_on,
         (b->>'open')::numeric AS open, (b->>'dueOn')::date AS due_on, (b->>'promised')::boolean AS promised
  FROM jsonb_array_elements(public.get_gc_money_monday_payload()->'bills') b
  WHERE NOT (b->>'waitingOnArchitect')::boolean AND b->>'dueOn' IS NOT NULL
),
soon AS (
  SELECT bl.*, a.id AS pay_app_id, g.billing_job_id, g.project_manager_user_id, p.name AS project,
         p.customer_id, c.name AS customer
  FROM bills bl
  CROSS JOIN t
  JOIN public.gc_owner_pay_apps a ON a.project_id = bl.project_id AND a.number = bl.number
  JOIN public.gc_projects g ON g.project_id = bl.project_id
  JOIN public.projects p ON p.id = bl.project_id
  JOIN public.customers c ON c.id = p.customer_id
  WHERE t.since IS NOT NULL AND bl.certified_on >= t.since
    AND bl.certified_on < t.d
    AND bl.due_on - t.d BETWEEN 1 AND 3
    AND NOT EXISTS (SELECT 1 FROM public.gc_owner_card_bills k
                    WHERE k.invoice_id = a.invoice_id AND k.status IN ('pending', 'on_card'))
    AND NOT EXISTS (SELECT 1 FROM public.gc_office_notices n WHERE n.kind = 'pay_soon' AND n.pay_app_id = a.id)
)
SELECT jsonb_build_object(
  'today', (SELECT d FROM t),
  'since', (SELECT since FROM t),
  'notices', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'kind', 'pay_soon', 'projectId', s.project_id, 'project', s.project, 'billingJobId', s.billing_job_id,
      'payAppId', s.pay_app_id, 'number', s.number, 'final', s.final, 'certified', s.certified,
      'certifiedOn', s.certified_on, 'open', s.open, 'dueOn', s.due_on, 'promised', s.promised,
      'to', jsonb_build_object('customerId', s.customer_id, 'name', s.customer),
      'replyTo', jsonb_build_object('name', r.name, 'email', r.email)
    ) ORDER BY s.due_on, s.project, s.number)
    FROM soon s
    LEFT JOIN LATERAL (
      SELECT u.name, u.email FROM public.users u
      WHERE u.id = coalesce(
        (SELECT pm.id FROM public.users pm WHERE pm.id = s.project_manager_user_id
           AND NOT pm.is_sample AND NOT pm.is_digital_twin AND pm.archived_at IS NULL),
        public.company_owner_user_id())
    ) r ON true
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.get_gc_customer_due_notices(date, date) IS
  'GC mode (v2.5184, Owner Billing O12a): the customers'' notices due today and not sent yet, for gc-office-notices. pay_soon: a certified pay application still open whose due day (get_gc_money_monday_payload''s dueOn) is 1 to 3 days off, certified before today and since p_since, else the switch''s day (gc_customer_due_notices_on_v1 holding a date; none while off), not on card (gc_owner_card_bills pending or on_card), and not told yet. To the project''s customer, Reply-To the project manager when a real account, else the company owner. p_today: the day to read for (the bed); the cron passes neither. Service role only.';

REVOKE ALL ON FUNCTION public.get_gc_customer_due_notices(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_gc_customer_due_notices(date, date) TO service_role;

-- The switch: 'false' until the owner turns it on, after the test copy; on, the day it went on.
INSERT INTO public.app_settings (key, value_text)
VALUES ('gc_customer_due_notices_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_gc_customer_due_notices_on" ON public.app_settings;
CREATE POLICY "master_or_dev_update_gc_customer_due_notices_on"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'gc_customer_due_notices_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'gc_customer_due_notices_on_v1' AND public.is_master_or_dev());
