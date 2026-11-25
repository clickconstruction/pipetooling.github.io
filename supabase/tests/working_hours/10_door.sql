-- Working hours, the database door (migration *_working_hours_door): a set week is seven days of at most two
-- [start, end] ranges on a quarter hour, written only by set_working_hours for a dev or the controller. For a
-- salaried person the seven hour numbers on pay follow in the same save, a change to a day's length starts this
-- week and needs a reason, and a dry run writes nothing. An answer still saves as before, and nobody signed in can
-- insert a set row. Written as postgres with each person's sign-in claims; everything rolls back. Raises on the
-- first failed assertion; ends with "working_hours door PASSED". See scripts/pgtest-working-hours.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA whd;
CREATE FUNCTION whd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION whd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A call the door must refuse, with the words it must say. A call that lands raises, and that raise is not the one caught.
CREATE FUNCTION whd.refused(label text, p_user uuid, p_days jsonb, p_from date, p_reason text, p_words text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM public.set_working_hours(p_user, p_days, p_from, p_reason);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%' || p_words || '%' THEN RAISE EXCEPTION '% was refused with other words: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was taken, and must be refused', label;
END $$;
CREATE FUNCTION whd.sunday() RETURNS date LANGUAGE sql AS $$ SELECT public.app_today() - extract(dow FROM public.app_today())::int $$;
CREATE FUNCTION whd.week(p_start int, p_end int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_array('[]'::jsonb, d, d, d, d, d, '[]'::jsonb) FROM (SELECT jsonb_build_array(jsonb_build_array(p_start, p_end)) AS d) x
$$;

-- 1 · The shape of a week.
SELECT whd.same('six to noon on five days', public.working_week_ok(whd.week(360, 720))::text, 'true');
SELECT whd.same('a day with a lunch', public.working_week_ok('[[],[[420,690],[720,930]],[],[],[],[],[]]')::text, 'true');
SELECT whd.same('a week with no hours at all', public.working_week_ok('[[],[],[],[],[],[],[]]')::text, 'true');
SELECT whd.same('a day to midnight, sixteen hours', public.working_week_ok('[[[480,1440]],[],[],[],[],[],[]]')::text, 'true');
SELECT whd.same('six days', public.working_week_ok('[[],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('no week', public.working_week_ok(NULL)::text, 'false');
SELECT whd.same('not a list', public.working_week_ok('{"mon":[[360,720]]}')::text, 'false');
SELECT whd.same('a time off the quarter hour', public.working_week_ok('[[],[[365,720]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('a half minute', public.working_week_ok('[[],[[360.5,720]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('an end before its start', public.working_week_ok('[[],[[720,360]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('a range with no length', public.working_week_ok('[[],[[360,360]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('past midnight', public.working_week_ok('[[],[[1380,1455]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('three ranges in a day', public.working_week_ok('[[],[[360,420],[480,540],[600,660]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('two ranges that touch', public.working_week_ok('[[],[[360,720],[720,900]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('two ranges out of order', public.working_week_ok('[[],[[720,900],[360,600]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('over sixteen hours', public.working_week_ok('[[],[[0,600],[615,1440]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('words where a time goes', public.working_week_ok('[[],[["06:00","12:00"]],[],[],[],[],[]]')::text, 'false');
SELECT whd.same('a number too large to be a time', public.working_week_ok('[[],[[0,100000000000000000000]],[],[],[],[],[]]')::text, 'false');

-- The people. Dana is a dev, Cole the controller, Olin an owner with pay approval, Asha an assistant. Hal is a
-- salaried helper on 6 hours Monday to Friday whose roster person carries his login. Ivy is hourly. Gus is archived.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000d001', 'dana@hours.test'), ('00000000-0000-0000-0000-00000000d002', 'cole@hours.test'),
  ('00000000-0000-0000-0000-00000000d003', 'olin@hours.test'), ('00000000-0000-0000-0000-00000000d004', 'asha@hours.test'),
  ('00000000-0000-0000-0000-00000000d005', 'hal@hours.test'), ('00000000-0000-0000-0000-00000000d006', 'ivy@hours.test'),
  ('00000000-0000-0000-0000-00000000d007', 'gus@hours.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000d001', 'dana@hours.test', 'ZZ Hours Dana', 'dev', false, false),
  ('00000000-0000-0000-0000-00000000d002', 'cole@hours.test', 'ZZ Hours Cole', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000d003', 'olin@hours.test', 'ZZ Hours Olin', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000000d004', 'asha@hours.test', 'ZZ Hours Asha', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000000d005', 'hal@hours.test', 'ZZ Hours Hal', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000000d006', 'ivy@hours.test', 'ZZ Hours Ivy', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000000d007', 'gus@hours.test', 'ZZ Hours Gus', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET archived_at = now() WHERE id = '00000000-0000-0000-0000-00000000d007';
INSERT INTO public.pay_approved_masters (master_id) VALUES ('00000000-0000-0000-0000-00000000d003') ON CONFLICT DO NOTHING;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000d003', 'helper', 'ZZ Hours Hal Roster', '00000000-0000-0000-0000-00000000d005');
INSERT INTO public.people_pay_config (person_name, person_id, hourly_wage, is_salary, record_hours_but_salary, salaried_week_hours) VALUES
  ('ZZ Hours Hal Roster', '00000000-0000-0000-0000-00000000e005', 10, true, true, '{0,6,6,6,6,6,0}');
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary) VALUES ('ZZ Hours Ivy', 10, false);

-- 2 · Who may use the door.
SELECT whd.as_user('00000000-0000-0000-0000-00000000d003');
SELECT whd.refused('an owner with pay approval', '00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday(), NULL, 'A dev or the controller sets working hours.');
SELECT whd.as_user('00000000-0000-0000-0000-00000000d004');
SELECT whd.refused('an assistant', '00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday(), NULL, 'A dev or the controller sets working hours.');
SELECT whd.as_user('00000000-0000-0000-0000-00000000d005');
SELECT whd.refused('the person themself', '00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday(), NULL, 'A dev or the controller sets working hours.');
SELECT whd.same('nobody signed out may run it', has_function_privilege('anon', 'public.set_working_hours(uuid, jsonb, date, text, boolean)', 'EXECUTE')::text, 'false');

-- 3 · Before anyone sets hours, a day answers nothing.
SELECT whd.same('no working hours yet', coalesce(public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 1)::text, 'none'), 'none');

-- 4 · A dry run says what a save would do and writes nothing.
SELECT whd.as_user('00000000-0000-0000-0000-00000000d002');
SELECT whd.same('a dry run by the controller',
  (SELECT r ->> 'status' || ' ' || (r ->> 'hours_per_week')::numeric(5,2)::text || ' moved ' || (r -> 'pay' ->> 'moved') FROM public.set_working_hours('00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday(), NULL, true) r),
  'planned 30.00 moved false');
SELECT whd.same('and nothing was written', (SELECT count(*)::text FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-00000000d005'), '0');

-- 5 · The helper's case: six to noon on a set week of six hours. The hours are kept and pay does not move.
SELECT whd.same('the controller sets six to noon',
  (SELECT r ->> 'status' || ' moved ' || (r -> 'pay' ->> 'moved') || ' salaried ' || (r -> 'pay' ->> 'salaried') FROM public.set_working_hours('00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday()) r),
  'set moved false salaried true');
SELECT whd.same('one set row, 30 hours, stamped with who set it',
  (SELECT kind || ' ' || hours_per_week::text || ' ' || set_by::text FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-00000000d005'),
  'set 30.00 00000000-0000-0000-0000-00000000d002');
SELECT whd.same('a working day answers its range', public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 1)::text, '[[360, 720]]');
SELECT whd.same('a day off answers an empty list', public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday())::text, '[]');
SELECT whd.same('the week before answers nothing', coalesce(public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() - 1)::text, 'none'), 'none');
SELECT whd.same('the seven numbers stand', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Hours Hal Roster'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00}');
SELECT whd.same('nothing on the pay log', (SELECT count(*)::text FROM public.pay_admin_events WHERE person_name = 'ZZ Hours Hal Roster'), '0');

-- 6 · A change of times alone may start next week, with no reason.
SELECT whd.as_user('00000000-0000-0000-0000-00000000d001');
SELECT whd.same('a dev moves the week an hour, from next week',
  (SELECT r -> 'pay' ->> 'moved' FROM public.set_working_hours('00000000-0000-0000-0000-00000000d005', whd.week(420, 780), whd.sunday() + 7) r), 'false');
SELECT whd.same('this week still reads six to noon', public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 1)::text, '[[360, 720]]');
SELECT whd.same('next week reads seven to one', public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 8)::text, '[[420, 780]]');

-- 7 · A change to a salaried day's length moves pay: this week only, and with a reason.
SELECT whd.refused('a shorter Friday from next week', '00000000-0000-0000-0000-00000000d005', '[[],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[[360,615]],[]]', whd.sunday() + 7, 'A class on Fridays', 'Start it this week.');
SELECT whd.refused('a shorter Friday with no reason', '00000000-0000-0000-0000-00000000d005', '[[],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[[360,615]],[]]', whd.sunday(), '  ', 'Say why.');
SELECT whd.same('a shorter Friday, this week, with its reason',
  (SELECT (r -> 'pay' ->> 'moved') || ' ' || (r ->> 'hours_per_week')::numeric(5,2)::text FROM public.set_working_hours('00000000-0000-0000-0000-00000000d005', '[[],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[[360,615]],[]]', whd.sunday(), 'A class on Fridays') r),
  'true 28.25');
SELECT whd.same('the seven numbers follow, Friday at 4.25', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Hours Hal Roster'), '{0.00,6.00,6.00,6.00,6.00,4.25,0.00}');
SELECT whd.same('one line on the pay log, with the reason and who',
  (SELECT action || ' | ' || reason || ' | ' || actor::text || ' | ' || (payload ->> 'by') || ' | ' || (payload -> 'changes' ->> 'salaried_week_hours') FROM public.pay_admin_events WHERE person_name = 'ZZ Hours Hal Roster'),
  'set_pay_config | A class on Fridays | 00000000-0000-0000-0000-00000000d001 | set_working_hours | [0.00, 6.00, 6.00, 6.00, 6.00, 4.25, 0.00]');
SELECT whd.same('the newest save of a Sunday wins', public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 5)::text, '[[360, 615]]');
-- The newest save in force holds: next week no longer reads the seven to one saved before it.
SELECT whd.same('a save for this week holds next week too, over an older save for next week', public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 8)::text || ' ' || public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 12)::text, '[[360, 720]] [[360, 615]]');

-- 8 · A lunch is not paid: two ranges add up without the break.
SELECT whd.same('a day with a lunch pays its two ranges',
  (SELECT r -> 'pay' ->> 'after' FROM public.set_working_hours('00000000-0000-0000-0000-00000000d005', '[[],[[420,690],[720,930]],[[360,720]],[[360,720]],[[360,720]],[[360,615]],[]]', whd.sunday(), 'A lunch on Mondays', true) r),
  '[0.00, 8.00, 6.00, 6.00, 6.00, 4.25, 0.00]');

-- 9 · When hours may start, and what a week may hold.
SELECT whd.refused('a Sunday already gone', '00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday() - 7, NULL, 'Working hours start on the Sunday');
SELECT whd.refused('a Monday', '00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday() + 1, NULL, 'Working hours start on the Sunday');
SELECT whd.refused('a Sunday two weeks out', '00000000-0000-0000-0000-00000000d005', whd.week(360, 720), whd.sunday() + 14, NULL, 'Working hours start on the Sunday');
SELECT whd.refused('a time off the quarter hour', '00000000-0000-0000-0000-00000000d005', whd.week(365, 720), whd.sunday(), NULL, 'A week is seven days');
SELECT whd.refused('over 80 hours in a week', '00000000-0000-0000-0000-00000000d006', '[[[360,1080]],[[360,1080]],[[360,1080]],[[360,1080]],[[360,1080]],[[360,1080]],[[360,1080]]]', whd.sunday(), NULL, 'no more than 80 hours');
SELECT whd.refused('an archived person', '00000000-0000-0000-0000-00000000d007', whd.week(360, 720), whd.sunday(), NULL, 'no account to set hours for');
SELECT whd.refused('nobody', NULL, whd.week(360, 720), whd.sunday(), NULL, 'no account to set hours for');

-- 10 · An hourly person has no pay side: any length, next week, no reason.
SELECT whd.same('an hourly person, from next week',
  (SELECT (r -> 'pay' ->> 'salaried') || ' ' || (r -> 'pay' ->> 'moved') || ' ' || (r ->> 'hours_per_week')::numeric(5,2)::text FROM public.set_working_hours('00000000-0000-0000-0000-00000000d006', '[[],[[420,900]],[[420,900]],[[420,645]],[[420,900]],[[420,900]],[]]', whd.sunday() + 7) r),
  'false false 35.75');
SELECT whd.same('her pay row is as it was', (SELECT is_salary::text || ' ' || salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Hours Ivy'), 'false {0.00,8.00,8.00,8.00,8.00,8.00,0.00}');

-- 11 · Hours taken off again: the row has no week, days answer nothing, and a salaried person's pay goes back to
-- the standard week, with the reason a change to pay asks for. The take-off's own cases are 50_take_off.
SELECT whd.same('working hours taken off',
  (SELECT (r ->> 'cleared') || ' ' || (r -> 'pay' ->> 'moved') FROM public.set_working_hours('00000000-0000-0000-0000-00000000d005', NULL, whd.sunday(), 'The class is over') r), 'true true');
SELECT whd.same('a day answers nothing again', coalesce(public.working_hours_on('00000000-0000-0000-0000-00000000d005', whd.sunday() + 1)::text, 'none'), 'none');
SELECT whd.same('the seven numbers are the standard week again', (SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = 'ZZ Hours Hal Roster'), '{0.00,8.00,8.00,8.00,8.00,8.00,0.00}');
SELECT whd.same('every save is kept', (SELECT count(*)::text FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-00000000d005' AND kind = 'set'), '4');

-- 12 · The table's own door, as a signed-in person under its policies: an answer saves, in quarter hours, and a
-- set row is refused for everyone, a dev included.
SELECT whd.as_user('00000000-0000-0000-0000-00000000d006');
SET LOCAL ROLE authenticated;
INSERT INTO public.person_available_hours (user_id, hours_per_week, effective_from, set_by) VALUES ('00000000-0000-0000-0000-00000000d006', 37.75, '2026-11-22', '00000000-0000-0000-0000-00000000d006');
RESET ROLE;
SELECT whd.same('a person''s own answer saves as an answer, in quarter hours',
  (SELECT kind || ' ' || hours_per_week::text FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-00000000d006' AND kind = 'answer'), 'answer 37.75');
SELECT whd.as_user('00000000-0000-0000-0000-00000000d001');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.person_available_hours (user_id, hours_per_week, days, effective_from, set_by, kind)
    VALUES ('00000000-0000-0000-0000-00000000d006', 30, '[[],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[]]', '2026-11-22', '00000000-0000-0000-0000-00000000d001', 'set');
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: a set row written straight to the table is refused, for a dev too';
    RETURN;
  END;
  RAISE EXCEPTION 'a set row was written straight to the table';
END $$;
RESET ROLE;

-- 13 · The checks on the table itself, whoever writes.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.person_available_hours (user_id, hours_per_week, days, effective_from, kind)
    VALUES ('00000000-0000-0000-0000-00000000d006', 30, '[[],[[365,720]],[],[],[],[],[]]', '2026-11-22', 'set');
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: a set row off the quarter hour is refused by the table';
    RETURN;
  END;
  RAISE EXCEPTION 'a set row off the quarter hour was kept';
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.person_available_hours (user_id, hours_per_week, effective_from, kind)
    VALUES ('00000000-0000-0000-0000-00000000d006', 30, '2026-11-22', 'standing');
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: a kind that is neither an answer nor set is refused';
    RETURN;
  END;
  RAISE EXCEPTION 'an unknown kind was kept';
END $$;
-- An answer keeps its loose shape: the painter's half hours, or any week a person drew, with no quarter-hour rule.
INSERT INTO public.person_available_hours (user_id, hours_per_week, days, effective_from, kind)
VALUES ('00000000-0000-0000-0000-00000000d006', 12, '[[],[[365,720],[721,800],[900,960]],[],[],[],[],[]]', '2026-11-22', 'answer');
SELECT whd.same('an answer is not held to the set week''s shape', (SELECT count(*)::text FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-00000000d006' AND kind = 'answer'), '2');

DO $$ BEGIN RAISE NOTICE 'working_hours door PASSED'; END $$;
ROLLBACK;
