-- The salary sync's continuous branch and a hand punch (v2.5509, migration *_salary_sync_continuous_open_punch_guard):
-- a salaried person on a continuous 8:00 day who clocked in by hand at 7:10 used to get a second open row at 8:00 from
-- the sync, and the day read 16 hours with Overlap. Now a punch that overlaps the window, open or closed after the
-- start, keeps the template row out, inside the window and at catch-up; a punch that ended at or before the start does
-- not; a day with no punch opens and closes as before; an indexed split child still blocks the canonical row. Written
-- as postgres (RLS off, no signed-in user, which the clock triggers tolerate); everything rolls back. Raises on the
-- first failed assertion; ends with "salary_sync_open_punch PASSED". See scripts/pgtest-salary-sync-open-punch.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000050b', 'early@salary.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000050b', 'early@salary.test', 'Early Bird', 'superintendent', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
-- A continuous 8:00 day, weekdays, Chicago.
INSERT INTO public.salary_work_schedule_templates (user_id, timezone, mode, segment_a_start_local, segment_a_duration_minutes, exclude_weekends)
VALUES ('00000000-0000-0000-0000-00000000050b', 'America/Chicago', 'continuous', TIME '08:00', 480, true);

CREATE SCHEMA sso;
CREATE FUNCTION sso.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A Chicago wall-clock instant.
CREATE FUNCTION sso.ct(p text) RETURNS timestamptz LANGUAGE sql AS $$ SELECT p::timestamp AT TIME ZONE 'America/Chicago' $$;
-- The day's rows as words, oldest first: origin, in, out or open, the segment index.
CREATE FUNCTION sso.day(p_date date) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(
    origin || ' ' || to_char(clocked_in_at AT TIME ZONE 'America/Chicago', 'HH24:MI') || '-'
      || coalesce(to_char(clocked_out_at AT TIME ZONE 'America/Chicago', 'HH24:MI'), 'open')
      || coalesce(' #' || salary_segment_index::text, ''),
    ' | ' ORDER BY clocked_in_at), '(none)')
  FROM public.clock_sessions
  WHERE user_id = '00000000-0000-0000-0000-00000000050b' AND work_date = p_date
$$;
CREATE FUNCTION sso.sync(p_date date, p_now text) RETURNS void LANGUAGE sql AS $$
  SELECT public.salary_sync_one_user_clock_sessions('00000000-0000-0000-0000-00000000050b', p_date, sso.ct(p_now))
$$;

-- 1 · Tue Oct 13: clocked in by hand at 7:10, still open. The 8:03 tick adds nothing, nor noon's, nor the one past the
--     end of the day; the punch stays open, since the sync never closes a punch.
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, origin)
VALUES ('00000000-0000-0000-0000-00000000050b', sso.ct('2026-10-13 07:10'), NULL, DATE '2026-10-13', 'Run copper test', 'user_punch');
SELECT sso.sync(DATE '2026-10-13', '2026-10-13 08:03');
SELECT sso.same('an early punch, still open, keeps the 8:00 row out', sso.day(DATE '2026-10-13'), 'user_punch 07:10-open');
SELECT sso.sync(DATE '2026-10-13', '2026-10-13 12:00');
SELECT sso.same('and at noon', sso.day(DATE '2026-10-13'), 'user_punch 07:10-open');
SELECT sso.sync(DATE '2026-10-13', '2026-10-13 16:30');
SELECT sso.same('and past the end: no catch-up row, the punch not closed', sso.day(DATE '2026-10-13'), 'user_punch 07:10-open');

-- 2 · Wed Oct 14: the same punch, clocked out at 9:30 before any tick. A closed punch over the start still keeps the
--     row out, inside the window and at catch-up.
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, origin)
VALUES ('00000000-0000-0000-0000-00000000050b', sso.ct('2026-10-14 07:10'), sso.ct('2026-10-14 09:30'), DATE '2026-10-14', '', 'user_punch');
SELECT sso.sync(DATE '2026-10-14', '2026-10-14 10:00');
SELECT sso.same('a punch closed after the start keeps the row out', sso.day(DATE '2026-10-14'), 'user_punch 07:10-09:30');
SELECT sso.sync(DATE '2026-10-14', '2026-10-14 16:30');
SELECT sso.same('and no catch-up row either', sso.day(DATE '2026-10-14'), 'user_punch 07:10-09:30');

-- 3 · Thu Oct 15: a punch that ended exactly at 8:00 does not overlap a half-open window; the day opens at 8:00 and
--     closes at 16:00 as before.
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, origin)
VALUES ('00000000-0000-0000-0000-00000000050b', sso.ct('2026-10-15 06:00'), sso.ct('2026-10-15 08:00'), DATE '2026-10-15', '', 'user_punch');
SELECT sso.sync(DATE '2026-10-15', '2026-10-15 08:03');
SELECT sso.same('a punch ending at the start lets the day open', sso.day(DATE '2026-10-15'), 'user_punch 06:00-08:00 | salary_schedule 08:00-open');
SELECT sso.sync(DATE '2026-10-15', '2026-10-15 16:30');
SELECT sso.same('which closes at 16:00', sso.day(DATE '2026-10-15'), 'user_punch 06:00-08:00 | salary_schedule 08:00-16:00');

-- 4 · Fri Oct 16: no punch. The day opens at 8:00 once, the end tick closes it, and a late tick on an empty Monday
--     inserts that day closed (catch-up).
SELECT sso.sync(DATE '2026-10-16', '2026-10-16 08:03');
SELECT sso.sync(DATE '2026-10-16', '2026-10-16 08:08');
SELECT sso.same('a plain day opens once', sso.day(DATE '2026-10-16'), 'salary_schedule 08:00-open');
SELECT sso.sync(DATE '2026-10-16', '2026-10-16 16:30');
SELECT sso.same('and closes at 16:00', sso.day(DATE '2026-10-16'), 'salary_schedule 08:00-16:00');
SELECT sso.sync(DATE '2026-10-12', '2026-10-12 18:00');
SELECT sso.same('a late tick on an empty day inserts it closed', sso.day(DATE '2026-10-12'), 'salary_schedule 08:00-16:00');

-- 5 · Mon Oct 19: an indexed split child (My Time split a continuous day) still keeps the canonical row out, as before.
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, origin, salary_segment_index)
VALUES ('00000000-0000-0000-0000-00000000050b', sso.ct('2026-10-19 08:00'), sso.ct('2026-10-19 10:00'), DATE '2026-10-19', '', 'salary_schedule', 1);
SELECT sso.sync(DATE '2026-10-19', '2026-10-19 12:00');
SELECT sso.same('an indexed child keeps the canonical row out', sso.day(DATE '2026-10-19'), 'salary_schedule 08:00-10:00 #1');

-- 6 · Sat Oct 17: a weekend day adds nothing, as before.
SELECT sso.sync(DATE '2026-10-17', '2026-10-17 09:00');
SELECT sso.same('a weekend adds nothing', sso.day(DATE '2026-10-17'), '(none)');

-- 7 · As shipped: a definer, with its comment naming the guard.
SELECT sso.same('as shipped', (
  SELECT prosecdef::text || '/' || (obj_description(oid, 'pg_proc') LIKE '%v2.5509%')::text
  FROM pg_proc WHERE oid = 'public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz)'::regprocedure),
  'true/true');

DO $$ BEGIN RAISE NOTICE 'salary_sync_open_punch PASSED'; END $$;
ROLLBACK;
