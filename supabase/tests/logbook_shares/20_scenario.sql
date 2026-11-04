-- The logbook, shown to its teammate (v2.6483, punch list #255, migration *_logbook_shares): my_logbook() answers NULL
-- until the office shows it; a teammate cannot show their own; the office's press opens it; it then answers only the
-- caller's own approved, closed hours, the licenses under their name, and the supervising licenses of current
-- teammates (not an archived one, not an expired one, not an apprentice's); another teammate neither reads nor stops
-- the row; the office's own read stays closed to teammates; Stop showing closes it again. Fixtures are written as
-- postgres; presses run as each user; everything rolls back. Raises on the first failed assertion; ends with
-- "logbook_shares PASSED". See scripts/pgtest-logbook-shares.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dario (apprentice) and Tess (apprentice) clock hours; Hal is a current master; Gwen was a master and left; Ed's master
-- license expired; Rosa is the office.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000a1d1', 'dario@logbook.test'),
  ('00000000-0000-0000-0000-00000000a1d2', 'tess@logbook.test'),
  ('00000000-0000-0000-0000-00000000a1d3', 'hal@logbook.test'),
  ('00000000-0000-0000-0000-00000000a1d4', 'gwen@logbook.test'),
  ('00000000-0000-0000-0000-00000000a1d5', 'rosa@logbook.test'),
  ('00000000-0000-0000-0000-00000000a1d6', 'dev@logbook.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00000000a1d1', 'dario@logbook.test', 'Dario Pruitt', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00000000a1d2', 'tess@logbook.test', 'Tess Tolliver', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00000000a1d3', 'hal@logbook.test', 'Hal Moreno', 'primary', false, false, NULL),
  ('00000000-0000-0000-0000-00000000a1d4', 'gwen@logbook.test', 'Gwen Gone', 'primary', false, false, '2026-01-01'),
  ('00000000-0000-0000-0000-00000000a1d5', 'rosa@logbook.test', 'Rosa Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-00000000a1d6', 'dev@logbook.test', 'Logbook Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

INSERT INTO public.person_licenses (person_name, license_type, date_of_expiry) VALUES
  ('Dario Pruitt', 'Plumber Apprentice #191774', '2099-08-31'),
  ('Tess Tolliver', 'Plumber Apprentice #191775', '2099-08-31'),
  ('Hal Moreno', 'Master Plumber #4411', '2099-05-31'),
  ('Gwen Gone', 'Master Plumber #4412', '2099-05-31'),
  ('Ed Expired', 'Master Plumber #4413', '2020-05-31');

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000a1f1', 'Logbook Bed Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000000a1b1', '00000000-0000-0000-0000-00000000a1d6', '00000000-0000-0000-0000-00000000a1f1', 'Oak Hollow remodel', NULL);

-- Dario: one approved, closed 8-hour day; one not yet approved; one revoked. Tess: one approved day.
INSERT INTO public.clock_sessions (user_id, job_ledger_id, clocked_in_at, clocked_out_at, work_date, approved_at, revoked_at, notes) VALUES
  ('00000000-0000-0000-0000-00000000a1d1', '00000000-0000-0000-0000-00000000a1b1', '2026-10-27 13:00Z', '2026-10-27 21:00Z', '2026-10-27', '2026-10-28 00:00Z', NULL, 'counted'),
  ('00000000-0000-0000-0000-00000000a1d1', '00000000-0000-0000-0000-00000000a1b1', '2026-10-28 13:00Z', '2026-10-28 21:00Z', '2026-10-28', NULL, NULL, 'waiting'),
  ('00000000-0000-0000-0000-00000000a1d1', '00000000-0000-0000-0000-00000000a1b1', '2026-10-29 13:00Z', '2026-10-29 21:00Z', '2026-10-29', '2026-10-30 00:00Z', '2026-10-30 01:00Z', 'revoked'),
  ('00000000-0000-0000-0000-00000000a1d2', '00000000-0000-0000-0000-00000000a1b1', '2026-10-27 13:00Z', '2026-10-27 18:00Z', '2026-10-27', '2026-10-28 00:00Z', NULL, 'tess');

CREATE SCHEMA lbs;
CREATE FUNCTION lbs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lbs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA lbs TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lbs TO authenticated;

SET LOCAL ROLE authenticated;

-- 1 · Before the office shows it, the read answers nothing, and the teammate cannot show their own.
SELECT lbs.as_user('00000000-0000-0000-0000-00000000a1d1');
SELECT lbs.same('not shown: my_logbook is null', (public.my_logbook() IS NULL)::text, 'true');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.logbook_shares (user_id) VALUES ('00000000-0000-0000-0000-00000000a1d1');
    RAISE EXCEPTION 'a teammate showed their own logbook';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: a teammate cannot show their own logbook';
  END;
END $$;

-- 2 · The office presses Show; the row names who pressed.
SELECT lbs.as_user('00000000-0000-0000-0000-00000000a1d5');
INSERT INTO public.logbook_shares (user_id) VALUES ('00000000-0000-0000-0000-00000000a1d1');
SELECT lbs.same('the press names who showed it',
  (SELECT shown_by::text FROM public.logbook_shares WHERE user_id = '00000000-0000-0000-0000-00000000a1d1'),
  '00000000-0000-0000-0000-00000000a1d5');

-- 3 · Dario reads their own logbook: their approved closed hours only, their license, the current masters.
SELECT lbs.as_user('00000000-0000-0000-0000-00000000a1d1');
SELECT lbs.same('shown: the name', public.my_logbook()->>'name', 'Dario Pruitt');
SELECT lbs.same('shown: only the approved, closed, unrevoked hours',
  (SELECT string_agg((h->>'work_date') || ' ' || round((h->>'hours')::numeric, 1)::text || ' ' || (h->>'job_name'), ' | ')
   FROM jsonb_array_elements(public.my_logbook()->'hours') h), '2026-10-27 8.0 Oak Hollow remodel');
SELECT lbs.same('shown: the licenses under their name',
  (SELECT string_agg(l->>'license_type', ' | ') FROM jsonb_array_elements(public.my_logbook()->'licenses') l), 'Plumber Apprentice #191774');
SELECT lbs.same('shown: signers are current teammates with a supervising license',
  (SELECT string_agg(s->>'person_name', ' | ') FROM jsonb_array_elements(public.my_logbook()->'signers') s
   WHERE s->>'person_name' IN ('Hal Moreno', 'Gwen Gone', 'Ed Expired', 'Tess Tolliver', 'Dario Pruitt')), 'Hal Moreno');
SELECT lbs.same('the teammate reads their own share row',
  (SELECT count(*)::text FROM public.logbook_shares WHERE user_id = '00000000-0000-0000-0000-00000000a1d1'), '1');
DO $$
BEGIN
  BEGIN
    PERFORM public.list_user_license_hours_log('00000000-0000-0000-0000-00000000a1d1');
    RAISE EXCEPTION 'the office''s read answered a teammate';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%not authorized%' THEN RAISE NOTICE 'ok: the office''s read stays closed to the teammate';
    ELSE RAISE; END IF;
  END;
END $$;

-- 4 · Tess, not shown, gets nothing, sees no one's row, and cannot stop Dario's.
SELECT lbs.as_user('00000000-0000-0000-0000-00000000a1d2');
SELECT lbs.same('another teammate: my_logbook is null', (public.my_logbook() IS NULL)::text, 'true');
SELECT lbs.same('another teammate reads no share row', (SELECT count(*)::text FROM public.logbook_shares), '0');
DELETE FROM public.logbook_shares WHERE user_id = '00000000-0000-0000-0000-00000000a1d1';
SELECT lbs.as_user('00000000-0000-0000-0000-00000000a1d1');
SELECT lbs.same('another teammate cannot stop it', (public.my_logbook() IS NULL)::text, 'false');
DELETE FROM public.logbook_shares WHERE user_id = '00000000-0000-0000-0000-00000000a1d1';
SELECT lbs.same('the teammate cannot stop it either', (public.my_logbook() IS NULL)::text, 'false');

-- 5 · The office presses Stop showing; the read closes.
SELECT lbs.as_user('00000000-0000-0000-0000-00000000a1d5');
DELETE FROM public.logbook_shares WHERE user_id = '00000000-0000-0000-0000-00000000a1d1';
SELECT lbs.as_user('00000000-0000-0000-0000-00000000a1d1');
SELECT lbs.same('stopped: my_logbook is null again', (public.my_logbook() IS NULL)::text, 'true');

RESET ROLE;

-- 6 · Grants: nobody signed out may call the read or touch the table.
SELECT lbs.same('anon may not call my_logbook', has_function_privilege('anon', 'public.my_logbook()', 'EXECUTE')::text, 'false');
SELECT lbs.same('anon has no table rights',
  (has_table_privilege('anon', 'public.logbook_shares', 'SELECT') OR has_table_privilege('anon', 'public.logbook_shares', 'INSERT'))::text, 'false');
SELECT lbs.same('nobody updates a share row', has_table_privilege('authenticated', 'public.logbook_shares', 'UPDATE')::text, 'false');

ROLLBACK;
SELECT 'logbook_shares PASSED';
