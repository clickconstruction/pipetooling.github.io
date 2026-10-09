-- The Monday money email (GC mode, Owner Billing's O7b): get_gc_money_monday_payload() reads Who owes us the way the
-- Money lens does (allJobsMoney's owed, ownerPayDue), and last week's sends and certificates; the requests table is the
-- money team's; My email schedule and Email streams list the stream; the cron rides the :03 lane. Days are counted from
-- last week's Monday (w), so the readings hold on any day the bed runs. Presses run through RLS as a dev, the
-- controller, the company owner and an estimator; the fixture is made as postgres; everything runs inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with "gc_owner_billing_money_monday PASSED".
-- See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@monday.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'estimator@monday.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'controller@monday.test'),
  ('00000000-0000-0000-0000-0000000009d5', 'owner@monday.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@monday.test', 'Monday Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000009d3', 'estimator@monday.test', 'Monday Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000009d4', 'controller@monday.test', 'Monday Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000009d5', 'owner@monday.test', 'Monday Owner', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-0000000009d5')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
-- Every payment counts toward the customer's usual days to pay.
DELETE FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1';

-- P builds for a customer who has paid us before (20 days, the median of two payments) under a contract of 30 days;
-- Q builds for a customer who never has, under a contract of 45.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000009c1', 'Monday Test Owner LLC', '00000000-0000-0000-0000-0000000009d5'),
  ('00000000-0000-0000-0000-0000000009c2', 'Monday Test Q LLC', '00000000-0000-0000-0000-0000000009d5'),
  ('00000000-0000-0000-0000-0000000009c9', 'Monday Test Architects', '00000000-0000-0000-0000-0000000009d5');
INSERT INTO public.projects (id, name, customer_id, address) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'Monday test P', '00000000-0000-0000-0000-0000000009c1', '500 Test Way, San Antonio, TX 78201'),
  ('00000000-0000-0000-0000-0000000009a2', 'Monday test Q', '00000000-0000-0000-0000-0000000009c2', '502 Test Way, San Antonio, TX 78201');
INSERT INTO public.gc_projects (project_id, stage, owner_pay_days, architect_customer_id) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'building', 30, '00000000-0000-0000-0000-0000000009c9'),
  ('00000000-0000-0000-0000-0000000009a2', 'building', 45, '00000000-0000-0000-0000-0000000009c9');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a2', 'Concrete', 0);

CREATE SCHEMA gmm;
CREATE FUNCTION gmm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gmm.stopped(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gmm.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A pay application as the window sends it: one trade line, 10% held.
CREATE FUNCTION gmm.app(p_number int, p_on date, p_package uuid, p_label text, p_worth numeric, p_done numeric, p_due numeric) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('number', p_number, 'final', false, 'periodTo', p_on, 'sentOn', p_on,
    'retainagePct', 10, 'retainageStep', NULL, 'retainage', round(p_done / 10, 2), 'workToDate', p_done, 'due', p_due,
    'lines', jsonb_build_array(jsonb_build_object('line', 'trade', 'packageId', p_package, 'changeOrderId', NULL,
      'label', p_label, 'worth', p_worth, 'doneToDate', p_done, 'stored', 0))) $$;
CREATE FUNCTION gmm.bill_of(p_pay_app uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT invoice_id FROM public.gc_owner_pay_apps WHERE id = p_pay_app $$;
CREATE FUNCTION gmm.job(p_project uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT billing_job_id FROM public.gc_projects WHERE project_id = p_project $$;
CREATE FUNCTION gmm.count_of(p_sql text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE v bigint; BEGIN EXECUTE p_sql INTO v; RETURN v::text; END $$;
-- Noon Central on a day, the way a promise made that day is stamped.
CREATE FUNCTION gmm.noon(p_day date) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT (p_day + time '12:00') AT TIME ZONE 'America/Chicago' $$;
-- One bill of the payload on a line: project, number, open, its due day from w, promised, days late from w, missed, waiting.
CREATE FUNCTION gmm.bill_words(b jsonb, w date) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws(' | ', b ->> 'project', b ->> 'number', b ->> 'open',
    CASE WHEN b ->> 'dueOn' IS NULL THEN 'no day'
         ELSE 'w' || CASE WHEN (b ->> 'dueOn')::date >= w THEN '+' ELSE '' END || ((b ->> 'dueOn')::date - w) END,
    CASE WHEN (b ->> 'promised')::boolean THEN 'promised' ELSE 'expected' END,
    b ->> 'daysLate', 'missed ' || (b ->> 'missed'),
    CASE WHEN (b ->> 'waitingOnArchitect')::boolean THEN 'waiting on ' || (b ->> 'architect')
         ELSE 'certified ' || round((b ->> 'certified')::numeric, 2) END) $$;
GRANT USAGE ON SCHEMA gmm TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gmm TO authenticated, service_role;

CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated, service_role;
-- t is today; w is last week's Monday, so t - w is 7 to 13.
CREATE TEMP TABLE d ON COMMIT DROP AS
  SELECT public.app_today() AS t, (public.app_today() - (EXTRACT(ISODOW FROM public.app_today())::int - 1) - 7)::date AS w;
GRANT SELECT ON d TO authenticated, service_role;

-- 0 · The migration: the payload for the service role only; the cron on the :03 lane.
SELECT gmm.same('the payload: SECURITY DEFINER, for the service role, never the signed in or anon',
  (SELECT count(*) || ' ' || bool_and(prosecdef)::text FROM pg_proc WHERE proname = 'get_gc_money_monday_payload') || ' ' ||
  has_function_privilege('service_role', 'public.get_gc_money_monday_payload()', 'EXECUTE')::text || ' ' ||
  has_function_privilege('authenticated', 'public.get_gc_money_monday_payload()', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.get_gc_money_monday_payload()', 'EXECUTE')::text,
  '1 true true false false');
SELECT gmm.same('the dispatcher every 5 minutes on the :03 lane',
  (SELECT string_agg(schedule, ', ') FROM cron.job WHERE jobname = 'gc-money-monday-email'), '3-58/5 * * * *');

-- 1 · As the dev: P's bills. Pay application 1 paid in full 20 days after its certificate; pay application 2 certified
-- for less, paid in part 20 days after, with a promise missed and a newer one for last week's Tuesday; pay application 3
-- sent last week and still with the architect.
SELECT gmm.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a1', (SELECT w - 120 FROM d),
  '{"00000000-0000-0000-0000-0000000009b1": 100000, "gc": 0, "contingency": 0, "fee": 0}');
INSERT INTO ids SELECT 'p1', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000009a1',
  gmm.app(1, (SELECT w - 90 FROM d), '00000000-0000-0000-0000-0000000009b1', 'Electrical', 100000, 20000, 18000));
SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'p1'), 18000, (SELECT w - 88 FROM d), '');
SELECT gmm.same('bill 1 paid in full 20 days after its certificate',
  coalesce(public.mark_invoice_paid(gmm.bill_of((SELECT id FROM ids WHERE k = 'p1')), NULL::numeric, (SELECT w - 68 FROM d)) ->> 'error', 'paid'), 'paid');
INSERT INTO ids SELECT 'p2', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000009a1',
  gmm.app(2, (SELECT w - 50 FROM d), '00000000-0000-0000-0000-0000000009b1', 'Electrical', 100000, 50000, 27000));
SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'p2'), 25000, (SELECT w - 48 FROM d), 'Held the switchgear.');
SELECT gmm.same('bill 2 paid in part 20 days after its certificate',
  coalesce(public.mark_invoice_paid(gmm.bill_of((SELECT id FROM ids WHERE k = 'p2')), 10000, (SELECT w - 28 FROM d)) ->> 'error', 'paid'), 'paid');
INSERT INTO ids SELECT 'p3', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000009a1',
  gmm.app(3, (SELECT w + 2 FROM d), '00000000-0000-0000-0000-0000000009b1', 'Electrical', 100000, 60000, 11000));

-- 2 · Q's one bill, certified last week's Thursday, nothing paid.
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a2', (SELECT w - 60 FROM d),
  '{"00000000-0000-0000-0000-0000000009b2": 80000, "gc": 0, "contingency": 0, "fee": 0}');
INSERT INTO ids SELECT 'q1', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000009a2',
  gmm.app(1, (SELECT w - 30 FROM d), '00000000-0000-0000-0000-0000000009b2', 'Concrete', 80000, 40000, 36000));
SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'q1'), 36000, (SELECT w + 3 FROM d), '');
RESET ROLE;

-- The customer's word on P's billing job, as the office recorded it: one missed, one live, one voided.
INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, source, created_at, voided_at)
SELECT gmm.job('00000000-0000-0000-0000-0000000009a1'), '00000000-0000-0000-0000-0000000009c1', d.w + v.by_d, 'office', gmm.noon(d.w + v.made), v.voided
FROM d, (VALUES (-35, -40, NULL::timestamptz), (1, -30, NULL::timestamptz), (30, -20, now())) AS v(by_d, made, voided);

-- 3 · The payload as the dispatcher reads it, as the service role.
SET LOCAL ROLE service_role;
CREATE TEMP TABLE pay ON COMMIT DROP AS SELECT public.get_gc_money_monday_payload() AS p;
RESET ROLE;
SELECT gmm.same('today and last week, Monday to Sunday',
  (SELECT (p ->> 'today') || ' ' || (p ->> 'weekFrom') || ' ' || (p ->> 'weekTo') FROM pay),
  (SELECT t || ' ' || w || ' ' || (w + 6) FROM d));
SELECT gmm.same('who owes us: late first, then on time, then waiting on the architect; bill 1 paid in full is not there',
  (SELECT string_agg(gmm.bill_words(b, d.w), E'\n' ORDER BY n) FROM pay, d, jsonb_array_elements(pay.p -> 'bills') WITH ORDINALITY AS x(b, n)),
  (SELECT concat_ws(E'\n',
     'Monday test P | 2 | 15000.00 | w+1 | promised | ' || (t - w - 1) || ' | missed 1 | certified 25000.00',
     'Monday test Q | 1 | 36000.00 | w+48 | expected | 0 | missed 0 | certified 36000.00',
     'Monday test P | 3 | 11000.00 | w+22 | expected | 0 | missed 0 | waiting on Monday Test Architects') FROM d));
SELECT gmm.same('each bill carries its customer, its days and its project',
  (SELECT string_agg(concat_ws(' ', b ->> 'customer', (b ->> 'sentOn')::date - d.w, coalesce(((b ->> 'certifiedOn')::date - d.w)::text, '-'), b ->> 'final', ((b ->> 'projectId') IS NOT NULL)::text), ', ' ORDER BY n)
     FROM pay, d, jsonb_array_elements(pay.p -> 'bills') WITH ORDINALITY AS x(b, n)),
  'Monday Test Owner LLC -50 -48 false true, Monday Test Q LLC -30 3 false true, Monday Test Owner LLC 2 - false true');
SELECT gmm.same('last week: what went, and what the architect certified',
  (SELECT coalesce((SELECT string_agg(concat_ws(' ', s ->> 'project', s ->> 'number', round((s ->> 'due')::numeric, 2), (s ->> 'sentOn')::date - d.w), ', ') FROM jsonb_array_elements(pay.p -> 'sent') s), 'none') || ' / ' ||
          coalesce((SELECT string_agg(concat_ws(' ', c ->> 'project', c ->> 'number', round((c ->> 'certified')::numeric, 2), (c ->> 'certifiedOn')::date - d.w), ', ') FROM jsonb_array_elements(pay.p -> 'certified') c), 'none')
     FROM pay, d),
  'Monday test P 3 11000.00 2 / Monday test Q 1 36000.00 3');

-- 4 · The requests: the money team asks for a money-team recipient; the recipient sees it and may stop it.
SELECT gmm.as_user('00000000-0000-0000-0000-0000000009d4');
SET LOCAL ROLE authenticated;
INSERT INTO public.gc_money_monday_email_requests (requested_by, recipient_user_id, send_at, repeat_weekly)
SELECT '00000000-0000-0000-0000-0000000009d4', '00000000-0000-0000-0000-0000000009d5', gmm.noon(d.t + 7), true FROM d;
SELECT gmm.stopped('the controller asking for an estimator',
  $q$INSERT INTO public.gc_money_monday_email_requests (requested_by, recipient_user_id, send_at) VALUES
    ('00000000-0000-0000-0000-0000000009d4', '00000000-0000-0000-0000-0000000009d3', now() + interval '1 day')$q$);
SELECT gmm.stopped('the controller asking in someone else''s name',
  $q$INSERT INTO public.gc_money_monday_email_requests (requested_by, recipient_user_id, send_at) VALUES
    ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009d5', now() + interval '1 day')$q$);
SELECT gmm.stopped('a client stamping a request sent',
  $q$UPDATE public.gc_money_monday_email_requests SET sent_at = now()$q$);
SELECT gmm.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT gmm.stopped('an estimator asking for the owner',
  $q$INSERT INTO public.gc_money_monday_email_requests (requested_by, recipient_user_id, send_at) VALUES
    ('00000000-0000-0000-0000-0000000009d3', '00000000-0000-0000-0000-0000000009d5', now() + interval '1 day')$q$);
SELECT gmm.same('an estimator sees no request', gmm.count_of('SELECT count(*) FROM public.gc_money_monday_email_requests'), '0');
SELECT gmm.as_user('00000000-0000-0000-0000-0000000009d5');
SELECT gmm.same('the owner''s email schedule lists it, weekly, from the controller',
  (SELECT string_agg(concat_ws(' ', o ->> 'stream', o ->> 'repeat_weekly', o ->> 'detail'), ', ')
     FROM jsonb_array_elements(public.get_my_email_schedule() -> 'one_offs') o WHERE o ->> 'stream' = 'gc_money_monday'),
  'gc_money_monday true from Monday Controller');
SELECT gmm.as_user('00000000-0000-0000-0000-0000000009d1');
SELECT gmm.same('Email streams lists it for a dev',
  (SELECT string_agg(concat_ws(' ', r ->> 'recipient_name', r ->> 'requested_by_name', r ->> 'repeat_weekly'), ', ')
     FROM jsonb_array_elements(public.get_global_email_schedule() -> 'gc_money_monday_requests') r),
  'Monday Owner Monday Controller true');
SELECT gmm.as_user('00000000-0000-0000-0000-0000000009d5');
DELETE FROM public.gc_money_monday_email_requests WHERE recipient_user_id = '00000000-0000-0000-0000-0000000009d5';
RESET ROLE;
SELECT gmm.same('the owner stopped it', gmm.count_of('SELECT count(*) FROM public.gc_money_monday_email_requests'), '0');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_money_monday PASSED'; END $$;
ROLLBACK;
