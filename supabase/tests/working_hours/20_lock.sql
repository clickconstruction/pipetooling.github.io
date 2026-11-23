-- Working hours, the lock (migration *_working_hours_lock): a change to the seven hour numbers on pay is a dev's or
-- the controller's, an owner with pay approval still changes a wage, a new pay row on the default week is made by
-- anyone who may make one, and an answer is refused for a person whose working hours are in force. Written as
-- postgres with each person's sign-in claims; everything rolls back. Raises on the first failed assertion; ends
-- with "working_hours lock PASSED". See scripts/pgtest-working-hours.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA whl;
CREATE FUNCTION whl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION whl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION whl.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A statement that must be refused with insufficient_privilege. One that lands raises, and that raise is not the one caught.
CREATE FUNCTION whl.refused(label text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was taken, and must be refused', label;
END $$;
CREATE FUNCTION whl.sunday() RETURNS date LANGUAGE sql AS $$ SELECT public.app_today() - extract(dow FROM public.app_today())::int $$;
GRANT USAGE ON SCHEMA whl TO authenticated;
-- A new schema's functions are not the signed-in role's to run until they are granted.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA whl TO authenticated;

-- Dana is a dev, Cole the controller, Olin an owner with pay approval. Hal is a salaried helper on 6 hours Monday
-- to Friday. Ivy is hourly.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000f001', 'dana@lock.test'), ('00000000-0000-0000-0000-00000000f002', 'cole@lock.test'),
  ('00000000-0000-0000-0000-00000000f003', 'olin@lock.test'), ('00000000-0000-0000-0000-00000000f005', 'hal@lock.test'),
  ('00000000-0000-0000-0000-00000000f006', 'ivy@lock.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000f001', 'dana@lock.test', 'ZZ Lock Dana', 'dev', false, false),
  ('00000000-0000-0000-0000-00000000f002', 'cole@lock.test', 'ZZ Lock Cole', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000f003', 'olin@lock.test', 'ZZ Lock Olin', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000000f005', 'hal@lock.test', 'ZZ Lock Hal', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000000f006', 'ivy@lock.test', 'ZZ Lock Ivy', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.pay_approved_masters (master_id) VALUES ('00000000-0000-0000-0000-00000000f003') ON CONFLICT DO NOTHING;

-- 1 · With no sign-in the database writes any week: a migration, a cron, the service role.
SELECT whl.as_nobody();
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary, salaried_week_hours) VALUES ('ZZ Lock Hal', 10, true, '{0,6,6,6,6,6,0}');
SELECT whl.same('a write with no sign-in keeps its week', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Lock Hal'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00}');

-- 2 · An owner with pay approval: the wage is theirs, the week is not.
SELECT whl.as_user('00000000-0000-0000-0000-00000000f003');
UPDATE public.people_pay_config SET hourly_wage = 11 WHERE person_name = 'ZZ Lock Hal';
UPDATE public.people_pay_config SET hourly_wage = 12, salaried_week_hours = '{0,6,6,6,6,6,0}' WHERE person_name = 'ZZ Lock Hal';
SELECT whl.same('an owner changes the wage, with the week named and left as it was', (SELECT (hourly_wage = 12)::text FROM public.people_pay_config WHERE person_name = 'ZZ Lock Hal'), 'true');
SELECT whl.refused('an owner changing the week', $q$UPDATE public.people_pay_config SET salaried_week_hours = '{0,8,8,8,8,8,0}' WHERE person_name = 'ZZ Lock Hal'$q$);
SELECT whl.refused('an owner making a pay row on a week of its own', $q$INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary, salaried_week_hours) VALUES ('ZZ Lock New', 10, true, '{0,10,10,10,10,0,0}')$q$);
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary) VALUES ('ZZ Lock Ivy', 10, false);
SELECT whl.same('an owner makes a pay row on the default week, as the Hire form does', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Lock Ivy'), '{0.00,8.00,8.00,8.00,8.00,8.00,0.00}');
SELECT whl.same('the week is as it was after the refusals', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Lock Hal'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00}');

-- 3 · The controller and a dev change the week.
SELECT whl.as_user('00000000-0000-0000-0000-00000000f002');
UPDATE public.people_pay_config SET salaried_week_hours = '{0,6,6,6,6,4,0}' WHERE person_name = 'ZZ Lock Hal';
SELECT whl.as_user('00000000-0000-0000-0000-00000000f001');
UPDATE public.people_pay_config SET salaried_week_hours = '{0,6,6,6,6,6,0}' WHERE person_name = 'ZZ Lock Hal';
SELECT whl.same('the controller and a dev change the week', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Lock Hal'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00}');

-- 4 · The door still writes the week for a salaried person, by the controller's hand.
SELECT whl.as_user('00000000-0000-0000-0000-00000000f002');
SELECT whl.same('the door moves the week through the trigger',
  (SELECT r -> 'pay' ->> 'moved' FROM public.set_working_hours('00000000-0000-0000-0000-00000000f005', '[[],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[[360,615]],[]]', whl.sunday(), 'A class on Fridays') r), 'true');
SELECT whl.same('and the seven numbers follow', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Lock Hal'), '{0.00,6.00,6.00,6.00,6.00,4.25,0.00}');

-- 5 · An answer, under the table's own policies as a signed-in person. Hal has working hours in force, so his
-- answer is refused, his own and the office's for him. Ivy has none, so hers saves.
SELECT whl.same('Hal has working hours in force', public.has_working_hours('00000000-0000-0000-0000-00000000f005')::text, 'true');
SELECT whl.same('Ivy has none', public.has_working_hours('00000000-0000-0000-0000-00000000f006')::text, 'false');
SELECT whl.as_user('00000000-0000-0000-0000-00000000f005');
SET LOCAL ROLE authenticated;
SELECT whl.refused('a person answering under their working hours', $q$INSERT INTO public.person_available_hours (user_id, hours_per_week, effective_from, set_by) VALUES ('00000000-0000-0000-0000-00000000f005', 45, '2026-11-22', '00000000-0000-0000-0000-00000000f005')$q$);
RESET ROLE;
SELECT whl.as_user('00000000-0000-0000-0000-00000000f003');
SET LOCAL ROLE authenticated;
SELECT whl.refused('the office answering for a person with working hours', $q$INSERT INTO public.person_available_hours (user_id, hours_per_week, effective_from, set_by) VALUES ('00000000-0000-0000-0000-00000000f005', 45, '2026-11-22', '00000000-0000-0000-0000-00000000f003')$q$);
INSERT INTO public.person_available_hours (user_id, hours_per_week, effective_from, set_by) VALUES ('00000000-0000-0000-0000-00000000f006', 38, '2026-11-22', '00000000-0000-0000-0000-00000000f003');
RESET ROLE;
SELECT whl.same('the office still answers for a person with no working hours', (SELECT count(*)::text FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-00000000f006' AND kind = 'answer'), '1');

-- 6 · Hours that start next week do not close the answer yet, and hours taken off open it again.
SELECT whl.as_user('00000000-0000-0000-0000-00000000f002');
SELECT whl.same('hours for next week are set for Ivy', (SELECT r ->> 'status' FROM public.set_working_hours('00000000-0000-0000-0000-00000000f006', '[[],[[420,900]],[[420,900]],[[420,900]],[[420,900]],[[420,900]],[]]', whl.sunday() + 7) r), 'set');
SELECT whl.same('they are not in force yet', public.has_working_hours('00000000-0000-0000-0000-00000000f006')::text, 'false');
SELECT whl.same('Hal''s hours are taken off', (SELECT r ->> 'cleared' FROM public.set_working_hours('00000000-0000-0000-0000-00000000f005', NULL, whl.sunday()) r), 'true');
SELECT whl.same('and he has none in force', public.has_working_hours('00000000-0000-0000-0000-00000000f005')::text, 'false');
SELECT whl.as_user('00000000-0000-0000-0000-00000000f005');
SET LOCAL ROLE authenticated;
INSERT INTO public.person_available_hours (user_id, hours_per_week, effective_from, set_by) VALUES ('00000000-0000-0000-0000-00000000f005', 45, '2026-11-22', '00000000-0000-0000-0000-00000000f005');
RESET ROLE;
SELECT whl.same('his own answer saves again', (SELECT count(*)::text FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-00000000f005' AND kind = 'answer'), '1');
SELECT whl.same('nobody signed out may ask', has_function_privilege('anon', 'public.has_working_hours(uuid)', 'EXECUTE')::text, 'false');

DO $$ BEGIN RAISE NOTICE 'working_hours lock PASSED'; END $$;
ROLLBACK;
