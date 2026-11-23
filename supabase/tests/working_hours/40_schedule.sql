-- Working hours, the usual day (migration *_working_hours_schedule_lock): the usual day of a workday schedule is a
-- dev's or the controller's to write. An owner with pay approval and the person themself are refused a new row,
-- and their change to a row that stands reaches no row. Both still read it, the person still saves a custom
-- schedule for today, and a person still removes their own row. Written under the tables' own policies, as a
-- signed-in person; everything rolls back. Raises on the first failed assertion; ends with
-- "working_hours schedule PASSED". See scripts/pgtest-working-hours.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA whs;
CREATE FUNCTION whs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION whs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A statement that must be refused with insufficient_privilege. One that lands raises, and that raise is not the one caught.
CREATE FUNCTION whs.refused(label text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was taken, and must be refused', label;
END $$;
-- The rows a statement changed, as the signed-in person.
CREATE FUNCTION whs.changed(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
-- A person's usual start, read as postgres.
CREATE FUNCTION whs.start_of(p_user uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT to_char(segment_a_start_local, 'HH24:MI') FROM public.salary_work_schedule_templates WHERE user_id = p_user), '(none)')
$$;
GRANT USAGE ON SCHEMA whs TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA whs TO authenticated;

-- Dana is a dev, Cole the controller, Olin an owner with pay approval. Hal and Ivy are salaried helpers.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000e001', 'dana@schedule.test'), ('00000000-0000-0000-0000-00000000e002', 'cole@schedule.test'),
  ('00000000-0000-0000-0000-00000000e003', 'olin@schedule.test'), ('00000000-0000-0000-0000-00000000e005', 'hal@schedule.test'),
  ('00000000-0000-0000-0000-00000000e006', 'ivy@schedule.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000e001', 'dana@schedule.test', 'ZZ Schedule Dana', 'dev', false, false),
  ('00000000-0000-0000-0000-00000000e002', 'cole@schedule.test', 'ZZ Schedule Cole', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000e003', 'olin@schedule.test', 'ZZ Schedule Olin', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000000e005', 'hal@schedule.test', 'ZZ Schedule Hal', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000000e006', 'ivy@schedule.test', 'ZZ Schedule Ivy', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.pay_approved_masters (master_id) VALUES ('00000000-0000-0000-0000-00000000e003') ON CONFLICT DO NOTHING;

-- 1 · A dev makes a usual day, and the controller moves it.
SELECT whs.as_user('00000000-0000-0000-0000-00000000e001');
SET LOCAL ROLE authenticated;
INSERT INTO public.salary_work_schedule_templates (user_id, timezone, mode, segment_a_start_local, segment_a_duration_minutes, exclude_weekends)
VALUES ('00000000-0000-0000-0000-00000000e005', 'America/Chicago', 'continuous', TIME '08:00', 480, true);
RESET ROLE;
SELECT whs.same('a dev makes a usual day', whs.start_of('00000000-0000-0000-0000-00000000e005'), '08:00');
SELECT whs.as_user('00000000-0000-0000-0000-00000000e002');
SET LOCAL ROLE authenticated;
SELECT whs.same('the controller moves it', whs.changed($q$UPDATE public.salary_work_schedule_templates SET segment_a_start_local = TIME '07:00' WHERE user_id = '00000000-0000-0000-0000-00000000e005'$q$), '1');
RESET ROLE;
SELECT whs.same('and it reads 7:00', whs.start_of('00000000-0000-0000-0000-00000000e005'), '07:00');

-- 2 · An owner with pay approval reads it, and neither makes one nor moves one.
SELECT whs.as_user('00000000-0000-0000-0000-00000000e003');
SET LOCAL ROLE authenticated;
SELECT whs.same('an owner reads the usual day', (SELECT count(*)::text FROM public.salary_work_schedule_templates WHERE user_id = '00000000-0000-0000-0000-00000000e005'), '1');
SELECT whs.refused('an owner making a usual day', $q$INSERT INTO public.salary_work_schedule_templates (user_id, timezone, mode, segment_a_start_local, segment_a_duration_minutes, exclude_weekends) VALUES ('00000000-0000-0000-0000-00000000e006', 'America/Chicago', 'continuous', TIME '08:00', 480, true)$q$);
SELECT whs.same('an owner''s move reaches no row', whs.changed($q$UPDATE public.salary_work_schedule_templates SET segment_a_start_local = TIME '09:00' WHERE user_id = '00000000-0000-0000-0000-00000000e005'$q$), '0');
RESET ROLE;

-- 3 · The person reads their own, and neither makes one nor moves one.
SELECT whs.as_user('00000000-0000-0000-0000-00000000e005');
SET LOCAL ROLE authenticated;
SELECT whs.same('the person reads their usual day', (SELECT count(*)::text FROM public.salary_work_schedule_templates WHERE user_id = '00000000-0000-0000-0000-00000000e005'), '1');
SELECT whs.same('the person''s own move reaches no row', whs.changed($q$UPDATE public.salary_work_schedule_templates SET segment_a_start_local = TIME '10:00' WHERE user_id = '00000000-0000-0000-0000-00000000e005'$q$), '0');
RESET ROLE;
SELECT whs.as_user('00000000-0000-0000-0000-00000000e006');
SET LOCAL ROLE authenticated;
SELECT whs.refused('a person making their own usual day', $q$INSERT INTO public.salary_work_schedule_templates (user_id, timezone, mode, segment_a_start_local, segment_a_duration_minutes, exclude_weekends) VALUES ('00000000-0000-0000-0000-00000000e006', 'America/Chicago', 'continuous', TIME '08:00', 480, true)$q$);
RESET ROLE;
SELECT whs.same('the usual day is as the controller left it', whs.start_of('00000000-0000-0000-0000-00000000e005'), '07:00');
SELECT whs.same('and Ivy has none', whs.start_of('00000000-0000-0000-0000-00000000e006'), '(none)');

-- 4 · A custom schedule for today is still the person's own, and an owner's for any day.
SELECT whs.as_user('00000000-0000-0000-0000-00000000e005');
SET LOCAL ROLE authenticated;
INSERT INTO public.salary_work_schedule_day_overrides (user_id, work_date, mode, segment_a_start_local, segment_a_duration_minutes)
VALUES ('00000000-0000-0000-0000-00000000e005', (timezone('America/Chicago', now()))::date, 'continuous', TIME '10:00', 480);
RESET ROLE;
SELECT whs.as_user('00000000-0000-0000-0000-00000000e003');
SET LOCAL ROLE authenticated;
INSERT INTO public.salary_work_schedule_day_overrides (user_id, work_date, mode, segment_a_start_local, segment_a_duration_minutes)
VALUES ('00000000-0000-0000-0000-00000000e005', (timezone('America/Chicago', now()))::date + 3, 'continuous', TIME '09:00', 480);
RESET ROLE;
SELECT whs.same('one date''s move is still saved by the person and by pay staff', (SELECT count(*)::text FROM public.salary_work_schedule_day_overrides WHERE user_id = '00000000-0000-0000-0000-00000000e005'), '2');

-- 5 · A person still removes their own row, which sets no hours.
SELECT whs.as_user('00000000-0000-0000-0000-00000000e005');
SET LOCAL ROLE authenticated;
SELECT whs.same('a person removes their own usual day', whs.changed($q$DELETE FROM public.salary_work_schedule_templates WHERE user_id = '00000000-0000-0000-0000-00000000e005'$q$), '1');
RESET ROLE;
SELECT whs.same('and it is gone', whs.start_of('00000000-0000-0000-0000-00000000e005'), '(none)');

DO $$ BEGIN RAISE NOTICE 'working_hours schedule PASSED'; END $$;
ROLLBACK;
