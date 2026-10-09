-- The controller reads pay speeds and promises, and records a promise (GC mode, Owner Billing's O5e): the money
-- team's reader of both. A controller reads what a dev reads from get_billed_customer_pay_speeds,
-- list_job_payment_promises and list_payment_promise_records, and add_job_payment_promise lands for them; an estimator
-- still reads NULL and is refused, and a controller in training mode writes nothing. The fixture is made as postgres
-- and through the dev's presses; everything runs inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "gc_owner_billing_controller_reads PASSED". See scripts/pgtest-gc-owner-billing.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@controller-reads.test'),
  ('00000000-0000-0000-0000-000000000bd3', 'estimator@controller-reads.test'),
  ('00000000-0000-0000-0000-000000000bd4', 'controller@controller-reads.test'),
  ('00000000-0000-0000-0000-000000000bd5', 'owner@controller-reads.test'),
  ('00000000-0000-0000-0000-000000000bd6', 'trainee@controller-reads.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@controller-reads.test', 'Reads Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000bd3', 'estimator@controller-reads.test', 'Reads Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000bd4', 'controller@controller-reads.test', 'Reads Controller', 'controller'),
  ('00000000-0000-0000-0000-000000000bd5', 'owner@controller-reads.test', 'Reads Owner', 'master_technician'),
  ('00000000-0000-0000-0000-000000000bd6', 'trainee@controller-reads.test', 'Reads Trainee', 'controller')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-000000000bd6';
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-000000000bd5')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
DELETE FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1';
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000bc1', 'Reads Test Owner LLC', '00000000-0000-0000-0000-000000000bd5');
INSERT INTO public.projects (id, name, customer_id, address) VALUES
  ('00000000-0000-0000-0000-000000000ba1', 'Reads test P', '00000000-0000-0000-0000-000000000bc1', '700 Test Way, San Antonio, TX 78201');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-000000000ba1', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000ba1', 'Electrical', 0);

CREATE SCHEMA gcr;
CREATE FUNCTION gcr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gcr.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gcr.stopped(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gcr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION gcr.app(p_number int, p_on date, p_done numeric, p_due numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('number', p_number, 'final', false, 'periodTo', p_on, 'sentOn', p_on,
    'retainagePct', 10, 'retainageStep', NULL, 'retainage', round(p_done / 10, 2), 'workToDate', p_done, 'due', p_due,
    'lines', jsonb_build_array(jsonb_build_object('line', 'trade', 'packageId', '00000000-0000-0000-0000-000000000bb1', 'changeOrderId', NULL,
      'label', 'Electrical', 'worth', 100000, 'doneToDate', p_done, 'stored', 0))) $$;
CREATE FUNCTION gcr.bill_of(p_pay_app uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT invoice_id FROM public.gc_owner_pay_apps WHERE id = p_pay_app $$;
CREATE FUNCTION gcr.job() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT billing_job_id FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-000000000ba1' $$;
CREATE FUNCTION gcr.live_promises() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.job_payment_promises WHERE job_id = gcr.job() AND voided_at IS NULL $$;
-- What each reader answers, read as the given user.
CREATE FUNCTION gcr.speed_of(p_user uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM gcr.as_user(p_user);
  RETURN coalesce((public.get_billed_customer_pay_speeds() -> 'customers' -> '00000000-0000-0000-0000-000000000bc1')::text, 'NULL');
END $$;
CREATE FUNCTION gcr.promises_of(p_user uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v jsonb;
BEGIN
  PERFORM gcr.as_user(p_user);
  v := public.list_job_payment_promises();
  IF v IS NULL THEN RETURN 'NULL'; END IF;
  RETURN (SELECT coalesce(string_agg(concat_ws(' ', e ->> 'promisedYmd', e ->> 'heardByName', e ->> 'source'), ', ' ORDER BY e ->> 'promisedYmd'), 'none')
          FROM jsonb_array_elements(v) e WHERE e ->> 'jobId' = gcr.job()::text);
END $$;
GRANT USAGE ON SCHEMA gcr TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gcr TO authenticated, service_role;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated, service_role;
CREATE TEMP TABLE d ON COMMIT DROP AS SELECT public.app_today() AS t;
GRANT SELECT ON d TO authenticated, service_role;

-- 1 · As the dev: the contract, a bill paid in full 20 days after its certificate, and a second bill open, with the
-- customer's word on when they will pay it.
SELECT gcr.as_user('00000000-0000-0000-0000-000000000bd1');
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-000000000ba1', (SELECT t - 60 FROM d),
  '{"00000000-0000-0000-0000-000000000bb1": 100000, "gc": 0, "contingency": 0, "fee": 0}');
INSERT INTO ids SELECT 'a1', public.gc_send_owner_pay_app('00000000-0000-0000-0000-000000000ba1', gcr.app(1, (SELECT t - 40 FROM d), 20000, 18000));
SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'a1'), 18000, (SELECT t - 38 FROM d), '');
SELECT gcr.same('bill 1 paid in full 20 days after its certificate',
  coalesce(public.mark_invoice_paid(gcr.bill_of((SELECT id FROM ids WHERE k = 'a1')), NULL::numeric, (SELECT t - 18 FROM d)) ->> 'error', 'paid'), 'paid');
INSERT INTO ids SELECT 'a2', public.gc_send_owner_pay_app('00000000-0000-0000-0000-000000000ba1', gcr.app(2, (SELECT t - 10 FROM d), 50000, 27000));
SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'a2'), 27000, (SELECT t - 8 FROM d), '');
SELECT public.add_job_payment_promise(gcr.job(), (SELECT t + 7 FROM d), 'Elena', 'phone', 'Their AP runs Fridays.');
SELECT gcr.same('one live promise on the billing job', gcr.live_promises(), '1');

-- 2 · The controller reads what the dev reads; an estimator reads nothing.
SELECT gcr.same('the customer''s usual days to pay, as the dev reads them', gcr.speed_of('00000000-0000-0000-0000-000000000bd1'), '{"samples": 1, "medianDays": 20}');
SELECT gcr.same('the controller reads the same', gcr.speed_of('00000000-0000-0000-0000-000000000bd4'), gcr.speed_of('00000000-0000-0000-0000-000000000bd1'));
SELECT gcr.same('an estimator still reads no pay speeds', gcr.speed_of('00000000-0000-0000-0000-000000000bd3'), 'NULL');
SELECT gcr.same('the promise, as the dev reads it',
  gcr.promises_of('00000000-0000-0000-0000-000000000bd1'), (SELECT (t + 7)::text FROM d) || ' Reads Dev office');
SELECT gcr.same('the controller reads the same promise', gcr.promises_of('00000000-0000-0000-0000-000000000bd4'), gcr.promises_of('00000000-0000-0000-0000-000000000bd1'));
SELECT gcr.same('an estimator still reads no promises', gcr.promises_of('00000000-0000-0000-0000-000000000bd3'), 'NULL');
SELECT gcr.as_user('00000000-0000-0000-0000-000000000bd4');
SELECT gcr.same('the controller reads Their word''s records', (public.list_payment_promise_records() IS NOT NULL)::text, 'true');

-- 3 · The controller records the customer's word; an estimator and a controller in training mode write nothing.
SELECT (public.add_job_payment_promise(gcr.job(), (SELECT t + 10 FROM d), 'Elena', 'email', 'Moved to the next run.') ->> 'promisedDate') IS NOT NULL;
SELECT gcr.same('the controller''s promise lands', gcr.live_promises(), '2');
SELECT gcr.as_user('00000000-0000-0000-0000-000000000bd3');
SELECT gcr.refused('an estimator''s promise',
  $q$SELECT public.add_job_payment_promise(gcr.job(), public.app_today() + 12)$q$,
  'Not allowed to record payment promises');
SELECT gcr.as_user('00000000-0000-0000-0000-000000000bd6');
SELECT gcr.stopped('a controller in training mode''s promise', $q$SELECT public.add_job_payment_promise(gcr.job(), public.app_today() + 12)$q$);
RESET ROLE;
SELECT gcr.same('nothing more written', gcr.live_promises(), '2');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_controller_reads PASSED'; END $$;
ROLLBACK;
