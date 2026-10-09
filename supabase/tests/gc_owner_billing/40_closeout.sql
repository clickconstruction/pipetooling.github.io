-- Closeout with the customer (GC mode, Owner Billing's O7a): the customer accepts the work once every line is billed,
-- recorded by the office or (as the service role) by their portal; our final pay application waits for it; the
-- acceptance can be fixed until the final goes on it, then stays. Presses run through RLS as a dev, an estimator and
-- the service role; the fixture is made as postgres; everything runs inside one transaction that rolls back. Raises on
-- the first failed assertion; ends with "gc_owner_billing_closeout PASSED". See scripts/pgtest-gc-owner-billing.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@closeout.test'),
  ('00000000-0000-0000-0000-0000000008d3', 'estimator@closeout.test'),
  ('00000000-0000-0000-0000-0000000008d5', 'owner@closeout.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@closeout.test', 'Closeout Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000008d3', 'estimator@closeout.test', 'Closeout Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000008d5', 'owner@closeout.test', 'Closeout Owner', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-0000000008d5')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000008c1', 'Closeout Test Owner LLC', '00000000-0000-0000-0000-0000000008d5', '{"email": "owner-ap@closeout.test"}');
-- P builds and bills; R builds with nothing billed yet (the portal's press stops at the billing check).
INSERT INTO public.projects (id, name, customer_id, address) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'Closeout test P', '00000000-0000-0000-0000-0000000008c1', '300 Test Way, San Antonio, TX 78201'),
  ('00000000-0000-0000-0000-0000000008a3', 'Closeout test R', '00000000-0000-0000-0000-0000000008c1', NULL);
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'building'),
  ('00000000-0000-0000-0000-0000000008a3', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008a1', 'Electrical', 0);

CREATE SCHEMA goc;
CREATE FUNCTION goc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION goc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION goc.stopped(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION goc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION goc.line(p_kind text, p_package uuid, p_label text, p_worth numeric, p_done numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('line', p_kind, 'packageId', p_package, 'changeOrderId', NULL, 'label', p_label, 'worth', p_worth, 'doneToDate', p_done, 'stored', 0) $$;
CREATE FUNCTION goc.lines(p_elec numeric, p_gc numeric, p_fee numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(
    goc.line('trade', '00000000-0000-0000-0000-0000000008b1', 'Electrical', 100000, p_elec),
    goc.line('gc', NULL, 'General conditions', 10000, p_gc),
    goc.line('fee', NULL, 'Fee', 5000, p_fee)) $$;
-- A pay application as the window sends it: its work added up from its lines, 10% held but on the final, which holds
-- nothing.
CREATE FUNCTION goc.app(p_number int, p_period date, p_lines jsonb, p_due numeric, p_final boolean DEFAULT false) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('number', p_number, 'final', p_final, 'periodTo', p_period, 'sentOn', p_period,
    'retainagePct', 10, 'retainageStep', NULL, 'retainage', CASE WHEN p_final THEN 0 ELSE round(w.work / 10, 2) END,
    'workToDate', w.work, 'due', p_due, 'lines', p_lines)
  FROM (SELECT sum((l ->> 'doneToDate')::numeric) AS work FROM jsonb_array_elements(p_lines) l) w $$;
CREATE FUNCTION goc.acceptance() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT concat_ws(' | ', a.accepted_on, a.accepted_by_name, a.how, coalesce(nullif(a.note, ''), 'no note'))
    FROM public.gc_owner_acceptances a WHERE a.project_id = '00000000-0000-0000-0000-0000000008a1'), 'none') $$;
CREATE FUNCTION goc.count_of(p_sql text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint; BEGIN EXECUTE p_sql INTO v; RETURN v::text; END $$;
GRANT USAGE ON SCHEMA goc TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA goc TO authenticated, service_role;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated, service_role;

-- 0 · The migration: the function for the signed in and the service role, never anon; the keep trigger is there.
SELECT goc.same('gc_record_acceptance: SECURITY INVOKER, for the signed in and the service role, not anon',
  (SELECT count(*) || ' ' || bool_and(NOT prosecdef)::text FROM pg_proc WHERE proname = 'gc_record_acceptance') || ' ' ||
  has_function_privilege('authenticated', 'public.gc_record_acceptance(uuid, date, text, text, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('service_role', 'public.gc_record_acceptance(uuid, date, text, text, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_record_acceptance(uuid, date, text, text, text)', 'EXECUTE')::text,
  '1 true true true false');
SELECT goc.same('the keep trigger is there',
  (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'gc_owner_acceptances_keep' AND NOT tgisinternal), '1');

-- 1 · As the dev: the contract at 115,000 (no contingency), pay application 1 part billed and certified.
SELECT goc.as_user('00000000-0000-0000-0000-0000000008d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000008a1', DATE '2026-09-01',
  '{"00000000-0000-0000-0000-0000000008b1": 100000, "gc": 10000, "contingency": 0, "fee": 5000}');
INSERT INTO ids SELECT 'app1', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000008a1', goc.app(1, DATE '2026-09-25', goc.lines(50000, 3000, 1000), 48600));
SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 48600, DATE '2026-09-28', '');

-- 2 · Every refusal of an acceptance in its words, and the final waiting for it.
SELECT goc.refused('an acceptance with part of the job billed',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a1', DATE '2026-10-01', 'Elena Ruiz')$q$,
  'Bill every line first. They accept the work once our pay applications have billed all of it.');
SELECT goc.refused('a day still to come',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a1', public.app_today() + 1, 'Elena Ruiz')$q$,
  'Pick the day they accepted it. It cannot be still to come.');
SELECT goc.refused('no name',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a1', DATE '2026-10-01', '  ')$q$,
  'Say who walked it and accepted it.');
SELECT goc.refused('a project that is not there',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008ff', DATE '2026-10-01', 'Elena Ruiz')$q$,
  'That GC project is not there.');
SELECT goc.refused('the portal''s acceptance from a signed-in user',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a1', DATE '2026-10-01', 'Elena Ruiz', 'portal')$q$,
  'Only the customer''s portal records an acceptance as theirs.');
SELECT goc.refused('a way to accept it that is neither',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a1', DATE '2026-10-01', 'Elena Ruiz', 'email')$q$,
  'They accept the work at the office or in their portal.');

-- 3 · Pay application 2 bills every line; the final still waits for the acceptance; then the acceptance, once.
INSERT INTO ids SELECT 'app2', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000008a1', goc.app(2, DATE '2026-10-05', goc.lines(100000, 10000, 5000), 54900));
SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app2'), 54900, DATE '2026-10-06', '');
SELECT goc.refused('the final before they accept the work',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000008a1', goc.app(3, DATE '2026-10-07', goc.lines(100000, 10000, 5000), 11500, true))$q$,
  'The final pay application goes after the customer accepts the work.');
SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a1', DATE '2026-10-07', '  Elena Ruiz ', 'office', ' Walked it with the architect. ');
SELECT goc.same('accepted: the day, the name and the note trimmed, at the office', goc.acceptance(), '2026-10-07 | Elena Ruiz | office | Walked it with the architect.');
SELECT goc.refused('a second acceptance',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a1', DATE '2026-10-08', 'Elena Ruiz')$q$,
  'They accepted the work on Oct 7.');
UPDATE public.gc_owner_acceptances SET note = 'Walked it with the architect and the owner.' WHERE project_id = '00000000-0000-0000-0000-0000000008a1';
SELECT goc.same('the money team fixes its note before the final', goc.acceptance(), '2026-10-07 | Elena Ruiz | office | Walked it with the architect and the owner.');

-- 4 · Our final pay application goes on it, holding nothing and asking for the 11,500 held; then the acceptance stays.
INSERT INTO ids SELECT 'final', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000008a1', goc.app(3, DATE '2026-10-08', goc.lines(100000, 10000, 5000), 11500, true));
SELECT goc.same('the final went: holding nothing, asking for what they held',
  goc.count_of($q$SELECT count(*) FROM public.gc_owner_pay_apps WHERE project_id = '00000000-0000-0000-0000-0000000008a1' AND final AND retainage = 0 AND due = 11500$q$), '1');
SELECT goc.refused('the acceptance moved after the final',
  $q$UPDATE public.gc_owner_acceptances SET accepted_on = DATE '2026-10-06' WHERE project_id = '00000000-0000-0000-0000-0000000008a1'$q$,
  'Our final pay application went on this acceptance, so it stays.');
SELECT goc.refused('the acceptance taken back after the final',
  $q$DELETE FROM public.gc_owner_acceptances WHERE project_id = '00000000-0000-0000-0000-0000000008a1'$q$,
  'Our final pay application went on this acceptance, so it stays.');

-- 5 · Off the money team, and the portal: an estimator records nothing; the portal's press as the service role passes
-- the portal gate and stops at the billing check on a job with nothing billed.
SELECT goc.as_user('00000000-0000-0000-0000-0000000008d3');
SELECT goc.stopped('an estimator''s acceptance', $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a3', DATE '2026-10-07', 'Elena Ruiz')$q$);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT goc.refused('the portal''s acceptance on a job with nothing billed',
  $q$SELECT public.gc_record_acceptance('00000000-0000-0000-0000-0000000008a3', DATE '2026-10-07', 'Elena Ruiz', 'portal')$q$,
  'Bill every line first.');
RESET ROLE;
SELECT goc.same('nothing more accepted', goc.count_of($q$SELECT count(*) FROM public.gc_owner_acceptances$q$), '1');

-- 6 · The project's delete takes its acceptance with it (the cascade passes the keep trigger).
DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000008a1';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT goc.same('the project''s delete takes its acceptance', goc.count_of($q$SELECT count(*) FROM public.gc_owner_acceptances$q$), '0');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_closeout PASSED'; END $$;
ROLLBACK;
