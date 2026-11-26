-- A wage changed on a screen leaves a line on the pay log (punch list #389, migration *_pay_config_log_screen_changes).
-- The trigger is deferred to the end of the transaction; SET CONSTRAINTS ALL IMMEDIATE stands in for that end here,
-- after each write, since the bed is one transaction that rolls back. Fixtures made as postgres; writes run as the
-- dev through RLS, as a screen's would. Raises on the first failed assertion; ends with "pay_log_screen PASSED". See
-- scripts/pgtest-pay-log-screen.sh. Never against prod. Every person is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA pls;
CREATE FUNCTION pls.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pls.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The log for one person, past RLS: how many lines, and the newest line's by, changes and reason.
CREATE FUNCTION pls.log(p_name text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.pay_admin_events WHERE person_name = p_name)::text || ' line(s)'
    || COALESCE((SELECT ' · by ' || COALESCE(payload->>'by', 'the door') || ' · ' || (payload->'changes')::text || ' · ' || reason
                 FROM public.pay_admin_events WHERE person_name = p_name ORDER BY created_at DESC, id DESC LIMIT 1), '')
$$;
CREATE FUNCTION pls.before_after(p_name text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(payload->'before'->>'hourly_wage', 'none') || ' → ' || COALESCE(payload->'after'->>'hourly_wage', 'none')
  FROM public.pay_admin_events WHERE person_name = p_name ORDER BY created_at DESC, id DESC LIMIT 1
$$;
GRANT USAGE ON SCHEMA pls TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pls TO authenticated, service_role;

-- Who: Devon the dev writes as a screen would. Three people: Hal has a pay row at 20; Ren and Sal have none.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000389a1', 'devon@paylog.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES ('00000000-0000-0000-0000-0000000389a1', 'devon@paylog.test', 'Devon Dev Pls', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary) VALUES ('ZZ Paylog Hal', 20, false);
DELETE FROM public.pay_admin_events WHERE person_name IN ('ZZ Paylog Hal', 'ZZ Paylog Ren', 'ZZ Paylog Sal');
SET CONSTRAINTS ALL IMMEDIATE;
-- The fixture's own insert, as postgres, logged a line as any insert with a wage does; it is not what is under test.
DELETE FROM public.pay_admin_events WHERE person_name = 'ZZ Paylog Hal';
SELECT pls.same('the log starts clean', pls.log('ZZ Paylog Hal'), '0 line(s)');
SET CONSTRAINTS ALL DEFERRED;

SELECT pls.as_user('00000000-0000-0000-0000-0000000389a1');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. A screen's upsert that changes the wage: one line, by screen, the wage before and after, the reason that none was asked.
INSERT INTO public.people_pay_config (person_name, hourly_wage) VALUES ('ZZ Paylog Hal', 1) ON CONFLICT (person_name) DO UPDATE SET hourly_wage = EXCLUDED.hourly_wage;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pls.same('a screen''s wage change leaves one line', pls.log('ZZ Paylog Hal'), '1 line(s) · by screen · {"hourly_wage": 1} · Changed on a screen. No reason was asked.');
SELECT pls.same('the line holds the wage before and after', pls.before_after('ZZ Paylog Hal'), '20 → 1');
SET CONSTRAINTS ALL DEFERRED;

-- 2. An upsert that changes nothing leaves no line; a column the log does not watch leaves none either.
INSERT INTO public.people_pay_config (person_name, hourly_wage) VALUES ('ZZ Paylog Hal', 1) ON CONFLICT (person_name) DO UPDATE SET hourly_wage = EXCLUDED.hourly_wage;
UPDATE public.people_pay_config SET vehicle_rate_override = 0.5 WHERE person_name = 'ZZ Paylog Hal';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pls.same('a write that changes no pay leaves no line', pls.log('ZZ Paylog Hal'), '1 line(s) · by screen · {"hourly_wage": 1} · Changed on a screen. No reason was asked.');
SET CONSTRAINTS ALL DEFERRED;

-- 3. Salaried on from a screen: one more line, with the switch.
UPDATE public.people_pay_config SET is_salary = true WHERE person_name = 'ZZ Paylog Hal';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pls.same('the salaried switch from a screen leaves a line', pls.log('ZZ Paylog Hal'), '2 line(s) · by screen · {"is_salary": true} · Changed on a screen. No reason was asked.');
SET CONSTRAINTS ALL DEFERRED;

-- 4. A change through the door, set_pay_config, leaves exactly its own line: the trigger finds it and writes none.
SELECT public.set_pay_config('ZZ Paylog Hal', '{"hourly_wage": 22}'::jsonb, 'a raise, through the seat');
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pls.same('a change through the door leaves one line, the door''s', pls.log('ZZ Paylog Hal'), '3 line(s) · by the door · {"hourly_wage": 22} · a raise, through the seat');
SET CONSTRAINTS ALL DEFERRED;

-- 5. A new row with a wage (a hire's, a return's) leaves a line with no before; a new row with no pay leaves none.
INSERT INTO public.people_pay_config (person_name, hourly_wage) VALUES ('ZZ Paylog Ren', 18) ON CONFLICT (person_name) DO UPDATE SET hourly_wage = EXCLUDED.hourly_wage;
INSERT INTO public.people_pay_config (person_name) VALUES ('ZZ Paylog Sal') ON CONFLICT (person_name) DO NOTHING;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pls.same('a new row with a wage leaves a line with no before', pls.log('ZZ Paylog Ren') || ' · ' || pls.before_after('ZZ Paylog Ren'), '1 line(s) · by screen · {"hourly_wage": 18} · Changed on a screen. No reason was asked. · none → 18');
SELECT pls.same('a new row with no pay leaves no line', pls.log('ZZ Paylog Sal'), '0 line(s)');
SET CONSTRAINTS ALL DEFERRED;
RESET ROLE;

SELECT 'pay_log_screen PASSED';
ROLLBACK;
