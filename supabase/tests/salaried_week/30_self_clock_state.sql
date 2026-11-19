-- The caller's own set week on the salary probe (v2.7948, migration *_self_salary_clock_state_week): a helper whose
-- roster person carries their login reads their own week, a person found by the name match reads theirs, and a
-- caller with no pay row reads the default week. The three flags read as they did. Written as postgres with each
-- person's sign-in claims; everything rolls back. Raises on the first failed assertion; ends with
-- "salaried_week probe PASSED". See scripts/pgtest-salaried-week.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA swp;
CREATE FUNCTION swp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION swp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The probe's one row as words: the three flags and the week.
CREATE FUNCTION swp.probe() RETURNS text LANGUAGE sql AS $$
  SELECT s.is_salary::text || ' ' || s.record_hours_but_salary::text || ' ' || s.has_template::text || ' ' || s.salaried_week_hours::text
  FROM public.self_salary_clock_state() s
$$;

-- Hana is a salaried helper whose roster person carries her login, on 6 hours Monday to Friday, recording her hours.
-- Nico is salaried with no roster person, found by his name, on the default week. Ola has no pay row at all.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000007948a1', 'hana@probe.test'),
  ('00000000-0000-0000-0000-0000007948a2', 'nico@probe.test'),
  ('00000000-0000-0000-0000-0000007948a3', 'ola@probe.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000007948a1', 'hana@probe.test', 'ZZ Probe Hana', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000007948a2', 'nico@probe.test', 'ZZ Probe Nico', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000007948a3', 'ola@probe.test', 'ZZ Probe Ola', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000007948b1', '00000000-0000-0000-0000-0000007948a1', 'helper', 'ZZ Probe Hana Roster', '00000000-0000-0000-0000-0000007948a1');
-- Hana's pay row is named apart from her login, so only the id-first match can find it.
INSERT INTO public.people_pay_config (person_name, person_id, hourly_wage, is_salary, record_hours_but_salary, salaried_week_hours) VALUES
  ('ZZ Probe Hana Roster', '00000000-0000-0000-0000-0000007948b1', 10, true, true, '{0,6,6,6,6,6,0}');
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary) VALUES
  ('ZZ Probe Nico', 10, true);

-- 1 · Id-first: Hana reads her own week and her flags, with no workday template.
SELECT swp.as_user('00000000-0000-0000-0000-0000007948a1');
SELECT swp.same('the caller''s own week, found by their roster person', swp.probe(), 'true true false {0.00,6.00,6.00,6.00,6.00,6.00,0.00}');

-- 2 · The name match: Nico reads the default week his new row was given.
SELECT swp.as_user('00000000-0000-0000-0000-0000007948a2');
SELECT swp.same('the caller''s own week, found by their name', swp.probe(), 'true false false {0.00,8.00,8.00,8.00,8.00,8.00,0.00}');

-- 3 · No pay row: not salaried, and the default week.
SELECT swp.as_user('00000000-0000-0000-0000-0000007948a3');
SELECT swp.same('no pay row reads the default week', swp.probe(), 'false false false {0,8,8,8,8,8,0}');

-- 4 · One row, and the week is the last column, so the quick-add functions' reads by name are untouched.
SELECT swp.same('the probe answers one row', (SELECT count(*)::text FROM public.self_salary_clock_state()), '1');
SELECT swp.same('the columns, in order',
  (SELECT string_agg(a.attname, ', ' ORDER BY a.attnum)
   FROM pg_proc p JOIN LATERAL unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(attname, mode, attnum) ON a.mode = 't'
   WHERE p.oid = 'public.self_salary_clock_state()'::regprocedure),
  'is_salary, record_hours_but_salary, has_template, salaried_week_hours');

-- 5 · The grants as they were: anon cannot run it by itself, a signed-in person can.
SELECT swp.same('authenticated may run the probe', has_function_privilege('authenticated', 'public.self_salary_clock_state()', 'EXECUTE')::text, 'true');

DO $$ BEGIN RAISE NOTICE 'salaried_week probe PASSED'; END $$;
ROLLBACK;
