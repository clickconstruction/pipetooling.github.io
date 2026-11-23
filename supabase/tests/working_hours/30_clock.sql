-- Working hours, the clock (migration *_working_hours_clock): the salary sync makes a day's sessions at the person's
-- own start and end. With no working hours the template's 8:00 day stands. One range is a continuous day, two are a
-- split day around the break, no range is a day off, and a Saturday with hours is made though the template leaves
-- weekends out. Hours saved during a day reach the clock from the next day. A hand punch over the window still
-- keeps the row out, one day's move still wins and is no longer held to 8 hours, hours taken off bring the template
-- back, and a person with no template gets nothing. Written as postgres (RLS off, no signed-in user, which the
-- clock triggers tolerate); everything rolls back. Raises on the first failed assertion; ends with
-- "working_hours clock PASSED". See scripts/pgtest-working-hours.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000c001', 'hal@clock.test'), ('00000000-0000-0000-0000-00000000c002', 'uma@clock.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000c001', 'hal@clock.test', 'ZZ Clock Hal', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000000c002', 'uma@clock.test', 'ZZ Clock Uma', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
-- Hal's schedule clocks him in and out: a continuous 8:00 day, weekdays, Chicago. Uma has no template.
INSERT INTO public.salary_work_schedule_templates (user_id, timezone, mode, segment_a_start_local, segment_a_duration_minutes, exclude_weekends)
VALUES ('00000000-0000-0000-0000-00000000c001', 'America/Chicago', 'continuous', TIME '08:00', 480, true);

CREATE SCHEMA whc;
CREATE FUNCTION whc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A Chicago wall-clock instant.
CREATE FUNCTION whc.ct(p text) RETURNS timestamptz LANGUAGE sql AS $$ SELECT p::timestamp AT TIME ZONE 'America/Chicago' $$;
-- A person's rows on a day as words, oldest first: origin, in, out or open, the segment index.
CREATE FUNCTION whc.day(p_user uuid, p_date date) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(
    origin || ' ' || to_char(clocked_in_at AT TIME ZONE 'America/Chicago', 'HH24:MI') || '-'
      || coalesce(to_char(clocked_out_at AT TIME ZONE 'America/Chicago', 'HH24:MI'), 'open')
      || coalesce(' #' || salary_segment_index::text, ''),
    ' | ' ORDER BY clocked_in_at), '(none)')
  FROM public.clock_sessions
  WHERE user_id = p_user AND work_date = p_date
$$;
CREATE FUNCTION whc.hal(p_date date) RETURNS text LANGUAGE sql AS $$ SELECT whc.day('00000000-0000-0000-0000-00000000c001', p_date) $$;
CREATE FUNCTION whc.sync(p_date date, p_now text) RETURNS void LANGUAGE sql AS $$
  SELECT public.salary_sync_one_user_clock_sessions('00000000-0000-0000-0000-00000000c001', p_date, whc.ct(p_now))
$$;

-- 1 · Fri Oct 30, before any working hours: the template's 8:00 day, eight hours.
SELECT whc.sync(DATE '2026-10-30', '2026-10-30 08:03');
SELECT whc.same('no working hours: the template opens the day at 8:00', whc.hal(DATE '2026-10-30'), 'salary_schedule 08:00-open');
SELECT whc.sync(DATE '2026-10-30', '2026-10-30 16:30');
SELECT whc.same('and closes it eight hours on', whc.hal(DATE '2026-10-30'), 'salary_schedule 08:00-16:00');

-- Week A, saved Sat Oct 31 for the Sunday of Nov 1: Monday and Wednesday 6:00 to 12:00, Tuesday 7:00 to 11:30 and
-- 12:00 to 3:30 around a lunch, Thursday 6:00 to 10:15, Friday off, Saturday 8:00 to 12:00.
INSERT INTO public.person_available_hours (user_id, hours_per_week, days, effective_from, kind, created_at) VALUES
  ('00000000-0000-0000-0000-00000000c001', 28.25, '[[],[[360,720]],[[420,690],[720,930]],[[360,720]],[[360,615]],[],[[480,720]]]', DATE '2026-11-01', 'set', whc.ct('2026-10-31 12:00')),
  ('00000000-0000-0000-0000-00000000c002', 30, '[[],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[[360,720]],[]]', DATE '2026-11-01', 'set', whc.ct('2026-10-31 12:00'));

-- 2 · Mon Nov 2: one range is a continuous day at its own start and end.
SELECT whc.sync(DATE '2026-11-02', '2026-11-02 06:05');
SELECT whc.same('working hours open the day at 6:00', whc.hal(DATE '2026-11-02'), 'salary_schedule 06:00-open');
SELECT whc.sync(DATE '2026-11-02', '2026-11-02 12:30');
SELECT whc.same('and close it at noon, six hours on', whc.hal(DATE '2026-11-02'), 'salary_schedule 06:00-12:00');

-- 3 · Tue Nov 3: two ranges are the two slots of a split day, with nothing on the clock over the break.
SELECT whc.sync(DATE '2026-11-03', '2026-11-03 07:05');
SELECT whc.same('a day with a lunch opens its first range', whc.hal(DATE '2026-11-03'), 'salary_schedule 07:00-open #1');
SELECT whc.sync(DATE '2026-11-03', '2026-11-03 11:45');
SELECT whc.same('closes it at the break', whc.hal(DATE '2026-11-03'), 'salary_schedule 07:00-11:30 #1');
SELECT whc.sync(DATE '2026-11-03', '2026-11-03 12:05');
SELECT whc.same('opens the second range after it', whc.hal(DATE '2026-11-03'), 'salary_schedule 07:00-11:30 #1 | salary_schedule 12:00-open #2');
SELECT whc.sync(DATE '2026-11-03', '2026-11-03 16:00');
SELECT whc.same('and closes that at its end', whc.hal(DATE '2026-11-03'), 'salary_schedule 07:00-11:30 #1 | salary_schedule 12:00-15:30 #2');

-- Week B, saved Wed Nov 4 at 9:00 for the same Sunday: Thursday becomes 8:00 to 12:00, Friday 6:00 to 12:00, and
-- Monday is off.
INSERT INTO public.person_available_hours (user_id, hours_per_week, days, effective_from, kind, created_at) VALUES
  ('00000000-0000-0000-0000-00000000c001', 27.5, '[[],[],[[420,690],[720,930]],[[360,720]],[[480,720]],[[360,720]],[[480,720]]]', DATE '2026-11-01', 'set', whc.ct('2026-11-04 09:00'));

-- 4 · Wed Nov 4: hours saved during the day do not move the day they were saved on.
SELECT whc.sync(DATE '2026-11-04', '2026-11-04 09:30');
SELECT whc.same('the day the hours were saved keeps the week it began on', whc.hal(DATE '2026-11-04'), 'salary_schedule 06:00-open');

-- 5 · Thu Nov 5: the next day reads the new week. A late tick on an empty day inserts it closed.
SELECT whc.sync(DATE '2026-11-05', '2026-11-05 18:00');
SELECT whc.same('the next day reads the new hours, caught up closed', whc.hal(DATE '2026-11-05'), 'salary_schedule 08:00-12:00');

-- 6 · Fri Nov 6: a hand punch before the start is the day's row, as it was under the template.
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, origin)
VALUES ('00000000-0000-0000-0000-00000000c001', whc.ct('2026-11-06 05:50'), NULL, DATE '2026-11-06', '', 'user_punch');
SELECT whc.sync(DATE '2026-11-06', '2026-11-06 06:30');
SELECT whc.same('an early punch keeps the row out', whc.hal(DATE '2026-11-06'), 'user_punch 05:50-open');

-- 7 · Sat Nov 7: a Saturday with hours is made, though the template leaves weekends out.
SELECT whc.sync(DATE '2026-11-07', '2026-11-07 08:05');
SELECT whc.same('a Saturday in the week opens', whc.hal(DATE '2026-11-07'), 'salary_schedule 08:00-open');
SELECT whc.sync(DATE '2026-11-07', '2026-11-07 12:10');
SELECT whc.same('and closes at noon', whc.hal(DATE '2026-11-07'), 'salary_schedule 08:00-12:00');

-- 8 · Mon Nov 9: a weekday with no range is a day off, and nothing is made.
SELECT whc.sync(DATE '2026-11-09', '2026-11-09 09:00');
SELECT whc.same('a weekday off makes nothing', whc.hal(DATE '2026-11-09'), '(none)');

-- 9 · Tue Nov 10: one day's move still wins for its day, and is no longer held to 8 hours.
INSERT INTO public.salary_work_schedule_day_overrides (user_id, work_date, mode, segment_a_start_local, segment_a_duration_minutes)
VALUES ('00000000-0000-0000-0000-00000000c001', DATE '2026-11-10', 'continuous', TIME '10:00', 300);
SELECT whc.sync(DATE '2026-11-10', '2026-11-10 10:05');
SELECT whc.same('one day''s move opens at its own start', whc.hal(DATE '2026-11-10'), 'salary_schedule 10:00-open');
SELECT whc.sync(DATE '2026-11-10', '2026-11-10 15:30');
SELECT whc.same('and runs its own five hours', whc.hal(DATE '2026-11-10'), 'salary_schedule 10:00-15:00');

-- 10 · Hours taken off on the evening of Nov 10: from the next day the template's 8:00 day is back.
INSERT INTO public.person_available_hours (user_id, hours_per_week, days, effective_from, kind, created_at) VALUES
  ('00000000-0000-0000-0000-00000000c001', 0, NULL, DATE '2026-11-08', 'set', whc.ct('2026-11-10 20:00'));
SELECT whc.sync(DATE '2026-11-11', '2026-11-11 08:05');
SELECT whc.same('hours taken off bring the template back', whc.hal(DATE '2026-11-11'), 'salary_schedule 08:00-open');

-- 11 · Uma has working hours and no template: she clocks in herself, and the sync makes nothing.
SELECT public.salary_sync_one_user_clock_sessions('00000000-0000-0000-0000-00000000c002', DATE '2026-11-02', whc.ct('2026-11-02 09:00'));
SELECT whc.same('working hours with no template make no sessions', whc.day('00000000-0000-0000-0000-00000000c002', DATE '2026-11-02'), '(none)');

-- 12 · The override's two length checks are gone, and its quarter-hour check stays.
SELECT whc.same('one day''s move is no longer held to 8 hours',
  (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.salary_work_schedule_day_overrides'::regclass AND conname IN ('salary_override_continuous_duration', 'salary_override_split_sum')), '0');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.salary_work_schedule_day_overrides (user_id, work_date, mode, segment_a_start_local, segment_a_duration_minutes)
    VALUES ('00000000-0000-0000-0000-00000000c001', DATE '2026-11-12', 'continuous', TIME '10:00', 310);
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: a move off the quarter hour is still refused';
    RETURN;
  END;
  RAISE EXCEPTION 'a move off the quarter hour was kept';
END $$;

DO $$ BEGIN RAISE NOTICE 'working_hours clock PASSED'; END $$;
ROLLBACK;
