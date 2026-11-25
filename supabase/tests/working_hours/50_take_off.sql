-- Working hours, the take-off (migration *_working_hours_take_off, punch list #429): taking working hours off a
-- salaried person puts the standard week, 8 hours Monday to Friday, back on their pay row. It is a change to pay
-- like any other, so it starts this week, needs a reason, and leaves one line on the pay log with the row before
-- and after. A take-off with no set week in force takes nothing off and leaves pay alone. A salaried person already
-- on the standard week, and a person who is not salaried, have no pay side to a take-off. Written as postgres with
-- each person's sign-in claims; everything rolls back. Raises on the first failed assertion; ends with
-- "working_hours takeoff PASSED". See scripts/pgtest-working-hours.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA wht;
CREATE FUNCTION wht.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION wht.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A call the door must refuse, with the words it must say. A call that lands raises, and that raise is not the one caught.
CREATE FUNCTION wht.refused(label text, p_user uuid, p_days jsonb, p_from date, p_reason text, p_words text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION wht.sunday() RETURNS date LANGUAGE sql AS $$ SELECT public.app_today() - extract(dow FROM public.app_today())::int $$;
CREATE FUNCTION wht.week(p_start int, p_end int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_array('[]'::jsonb, d, d, d, d, d, '[]'::jsonb) FROM (SELECT jsonb_build_array(jsonb_build_array(p_start, p_end)) AS d) x
$$;
CREATE FUNCTION wht.paid(p_name text) RETURNS text LANGUAGE sql AS $$ SELECT salaried_week_hours::text FROM public.people_pay_config WHERE person_name = p_name $$;
CREATE FUNCTION wht.logged(p_name text) RETURNS text LANGUAGE sql AS $$ SELECT count(*)::text FROM public.pay_admin_events WHERE person_name = p_name $$;

-- The people. Dana is a dev, Cole the controller, Olin an owner with pay approval. Hal is a salaried helper on 6
-- hours Monday to Friday, typed on his pay row before anyone set his hours. Sal is salaried on the standard week.
-- Ivy is hourly.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000050d1', 'dana@takeoff.test'), ('00000000-0000-0000-0000-0000000050d2', 'cole@takeoff.test'),
  ('00000000-0000-0000-0000-0000000050d3', 'olin@takeoff.test'), ('00000000-0000-0000-0000-0000000050d5', 'hal@takeoff.test'),
  ('00000000-0000-0000-0000-0000000050d6', 'ivy@takeoff.test'), ('00000000-0000-0000-0000-0000000050d8', 'sal@takeoff.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000050d1', 'dana@takeoff.test', 'ZZ Takeoff Dana', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000050d2', 'cole@takeoff.test', 'ZZ Takeoff Cole', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000050d3', 'olin@takeoff.test', 'ZZ Takeoff Olin', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000050d5', 'hal@takeoff.test', 'ZZ Takeoff Hal', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000050d6', 'ivy@takeoff.test', 'ZZ Takeoff Ivy', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000050d8', 'sal@takeoff.test', 'ZZ Takeoff Sal', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.pay_approved_masters (master_id) VALUES ('00000000-0000-0000-0000-0000000050d3') ON CONFLICT DO NOTHING;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000000050e5', '00000000-0000-0000-0000-0000000050d3', 'helper', 'ZZ Takeoff Hal Roster', '00000000-0000-0000-0000-0000000050d5');
INSERT INTO public.people_pay_config (person_name, person_id, hourly_wage, is_salary, record_hours_but_salary, salaried_week_hours) VALUES
  ('ZZ Takeoff Hal Roster', '00000000-0000-0000-0000-0000000050e5', 10, true, true, '{0,6,6,6,6,6,0}');
INSERT INTO public.people_pay_config (person_name, hourly_wage, is_salary) VALUES ('ZZ Takeoff Sal', 10, true), ('ZZ Takeoff Ivy', 10, false);

-- 1 · Nothing to take off: nobody set Hal's hours, so the week typed on his pay row stands, with no reason asked.
SELECT wht.as_user('00000000-0000-0000-0000-0000000050d1');
SELECT wht.same('a take-off with no set week in force moves no pay',
  (SELECT (r ->> 'cleared') || ' ' || (r -> 'pay' ->> 'moved') || ' ' || (r -> 'pay' ->> 'after') FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday()) r),
  'true false [0.00, 6.00, 6.00, 6.00, 6.00, 6.00, 0.00]');
SELECT wht.same('the typed week stands', wht.paid('ZZ Takeoff Hal Roster'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00}');
SELECT wht.same('nothing on the pay log', wht.logged('ZZ Takeoff Hal Roster'), '0');

-- 2 · Hours waiting for next week are not in force yet. Taking them off this week stops them and moves no pay.
SELECT wht.same('six to noon from next week', (SELECT r -> 'pay' ->> 'moved' FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', wht.week(360, 720), wht.sunday() + 7) r), 'false');
SELECT wht.same('taken off this week before they start',
  (SELECT (r ->> 'cleared') || ' ' || (r -> 'pay' ->> 'moved') FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday()) r), 'true false');
SELECT wht.same('next week answers nothing', coalesce(public.working_hours_on('00000000-0000-0000-0000-0000000050d5', wht.sunday() + 8)::text, 'none'), 'none');
SELECT wht.same('the typed week still stands', wht.paid('ZZ Takeoff Hal Roster'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00}');

-- 3 · The live test's case: hours set for this week, six to noon, then taken off.
SELECT wht.as_user('00000000-0000-0000-0000-0000000050d2');
SELECT wht.same('the controller sets six to noon', (SELECT r -> 'pay' ->> 'moved' FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', wht.week(360, 720), wht.sunday()) r), 'false');
SELECT wht.same('Hal has working hours in force', public.has_working_hours('00000000-0000-0000-0000-0000000050d5')::text, 'true');

-- A dry run says pay goes back to the standard week, and writes nothing.
SELECT wht.same('a dry run of the take-off',
  (SELECT (r ->> 'status') || ' ' || (r ->> 'cleared') || ' moved ' || (r -> 'pay' ->> 'moved') || ' ' || (r -> 'pay' ->> 'before') || ' to ' || (r -> 'pay' ->> 'after')
   FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday(), 'Back on full days', true) r),
  'planned true moved true [0.00, 6.00, 6.00, 6.00, 6.00, 6.00, 0.00] to [0.00, 8.00, 8.00, 8.00, 8.00, 8.00, 0.00]');
SELECT wht.same('and the dry run wrote nothing', wht.paid('ZZ Takeoff Hal Roster') || ' ' || wht.logged('ZZ Takeoff Hal Roster') || ' ' || public.has_working_hours('00000000-0000-0000-0000-0000000050d5')::text, '{0.00,6.00,6.00,6.00,6.00,6.00,0.00} 0 true');

-- It changes what a salaried day pays, so it holds a set's two rules.
SELECT wht.refused('a take-off with no reason', '00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday(), '  ', 'Say why.');
SELECT wht.refused('a take-off from next week', '00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday() + 7, 'Back on full days', 'Start it this week.');
SELECT wht.as_user('00000000-0000-0000-0000-0000000050d3');
SELECT wht.refused('an owner with pay approval', '00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday(), 'Back on full days', 'A dev or the controller sets working hours.');
SELECT wht.same('the refusals changed nothing', wht.paid('ZZ Takeoff Hal Roster') || ' ' || wht.logged('ZZ Takeoff Hal Roster'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00} 0');

-- The take-off itself, by the controller, this week, with its reason.
SELECT wht.as_user('00000000-0000-0000-0000-0000000050d2');
SELECT wht.same('working hours taken off a salaried person',
  (SELECT (r ->> 'status') || ' ' || (r ->> 'cleared') || ' moved ' || (r -> 'pay' ->> 'moved') || ' ' || (r -> 'pay' ->> 'after') FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday(), 'Back on full days') r),
  'set true moved true [0.00, 8.00, 8.00, 8.00, 8.00, 8.00, 0.00]');
SELECT wht.same('the pay row reads the standard week', wht.paid('ZZ Takeoff Hal Roster'), '{0.00,8.00,8.00,8.00,8.00,8.00,0.00}');
SELECT wht.same('a weekday pays 8 hours and a Sunday none',
  (SELECT public.salaried_hours_on(salaried_week_hours, wht.sunday() + 1)::text || ' ' || public.salaried_hours_on(salaried_week_hours, wht.sunday())::text FROM public.people_pay_config WHERE person_name = 'ZZ Takeoff Hal Roster'),
  '8.00 0.00');
SELECT wht.same('one line on the pay log, with the reason, who, and the week before and after',
  (SELECT action || ' | ' || reason || ' | ' || actor::text || ' | ' || (payload ->> 'by') || ' | ' || (payload -> 'changes' ->> 'salaried_week_hours') || ' | ' || (payload -> 'before' ->> 'salaried_week_hours') || ' | ' || (payload -> 'after' ->> 'salaried_week_hours')
   FROM public.pay_admin_events WHERE person_name = 'ZZ Takeoff Hal Roster'),
  'set_pay_config | Back on full days | 00000000-0000-0000-0000-0000000050d2 | set_working_hours | [0.00, 8.00, 8.00, 8.00, 8.00, 8.00, 0.00] | [0.00, 6.00, 6.00, 6.00, 6.00, 6.00, 0.00] | [0.00, 8.00, 8.00, 8.00, 8.00, 8.00, 0.00]');
SELECT wht.same('the set row keeps no week and the reason',
  (SELECT coalesce(days::text, 'no week') || ' | ' || note FROM public.person_available_hours WHERE user_id = '00000000-0000-0000-0000-0000000050d5' AND kind = 'set' ORDER BY created_at DESC LIMIT 1),
  'no week | Back on full days');
SELECT wht.same('a day answers nothing', coalesce(public.working_hours_on('00000000-0000-0000-0000-0000000050d5', wht.sunday() + 1)::text, 'none'), 'none');
SELECT wht.same('and he has no working hours in force', public.has_working_hours('00000000-0000-0000-0000-0000000050d5')::text, 'false');

-- 4 · A second take-off finds nothing to take off: no reason asked, and no second line on the pay log.
SELECT wht.same('a second take-off moves no pay',
  (SELECT (r ->> 'cleared') || ' ' || (r -> 'pay' ->> 'moved') FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', NULL, wht.sunday()) r), 'true false');
SELECT wht.same('still one line on the pay log', wht.logged('ZZ Takeoff Hal Roster'), '1');

-- 5 · Hours set again after a take-off start from the standard week, so a 6-hour day is a change to pay again.
SELECT wht.as_user('00000000-0000-0000-0000-0000000050d1');
SELECT wht.refused('six to noon again with no reason', '00000000-0000-0000-0000-0000000050d5', wht.week(360, 720), wht.sunday(), NULL, 'Say why.');
SELECT wht.same('six to noon again, with its reason',
  (SELECT (r -> 'pay' ->> 'moved') || ' ' || (r -> 'pay' ->> 'after') FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d5', wht.week(360, 720), wht.sunday(), 'Mornings again') r),
  'true [0.00, 6.00, 6.00, 6.00, 6.00, 6.00, 0.00]');

-- 6 · A salaried person already on the standard week: the take-off has no pay side, so it may start next week
-- with no reason, and nothing goes on the pay log.
SELECT wht.same('Sal works seven to three, 8 hours, and pay does not move', (SELECT r -> 'pay' ->> 'moved' FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d8', wht.week(420, 900), wht.sunday()) r), 'false');
SELECT wht.same('his hours are taken off from next week',
  (SELECT (r ->> 'cleared') || ' ' || (r -> 'pay' ->> 'salaried') || ' ' || (r -> 'pay' ->> 'moved') FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d8', NULL, wht.sunday() + 7) r), 'true true false');
SELECT wht.same('his week is as it was, and his pay log is empty', wht.paid('ZZ Takeoff Sal') || ' ' || wht.logged('ZZ Takeoff Sal'), '{0.00,8.00,8.00,8.00,8.00,8.00,0.00} 0');
SELECT wht.same('this week still reads his hours, and next week none',
  public.working_hours_on('00000000-0000-0000-0000-0000000050d8', wht.sunday() + 1)::text || ' ' || coalesce(public.working_hours_on('00000000-0000-0000-0000-0000000050d8', wht.sunday() + 8)::text, 'none'), '[[420, 900]] none');

-- 7 · A person who is not salaried has no pay side. A week left on their pay row is not theirs to be paid by, and
-- the take-off does not touch it.
UPDATE public.people_pay_config SET salaried_week_hours = '{0,6,6,6,6,6,0}' WHERE person_name = 'ZZ Takeoff Ivy';
SELECT wht.same('Ivy works six to noon', (SELECT r -> 'pay' ->> 'salaried' FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d6', wht.week(360, 720), wht.sunday()) r), 'false');
SELECT wht.same('her hours are taken off',
  (SELECT (r ->> 'cleared') || ' ' || (r -> 'pay' ->> 'salaried') || ' ' || (r -> 'pay' ->> 'moved') || ' ' || coalesce(r -> 'pay' ->> 'after', 'no pay side') FROM public.set_working_hours('00000000-0000-0000-0000-0000000050d6', NULL, wht.sunday()) r),
  'true false false no pay side');
SELECT wht.same('her pay row is as it was, and her pay log is empty', wht.paid('ZZ Takeoff Ivy') || ' ' || wht.logged('ZZ Takeoff Ivy'), '{0.00,6.00,6.00,6.00,6.00,6.00,0.00} 0');

DO $$ BEGIN RAISE NOTICE 'working_hours takeoff PASSED'; END $$;
ROLLBACK;
