-- Split a trip in two (migration *_trip_split): the dry run says both halves and writes nothing; the split keeps the
-- trip's id and number on the first half and makes the second a new trip with the next number; each person goes
-- where their days are; both keep the words and the jobs; what it refuses, in words; a training account changes
-- nothing; the phone's ended stamp on each half; and a trip on a bill keeps its line while the new trip starts with
-- no billing said. Days are counted from the bed's own today, so the scenario reads the same on any day. Fixtures
-- are written as postgres; presses run as each user; everything rolls back. Raises on the first failed assertion;
-- ends with "trips split PASSED". See scripts/pgtest-trips.sh. Never against prod. Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is in the office. Marcus is a master. Luis leads a crew. Tara is an assistant in training. Devon is a dev.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000007891a1', 'dana@tripsplit.test'),
  ('00000000-0000-0000-0000-0000007891a2', 'marcus@tripsplit.test'),
  ('00000000-0000-0000-0000-0000007891a3', 'luis@tripsplit.test'),
  ('00000000-0000-0000-0000-0000007891a4', 'tara@tripsplit.test'),
  ('00000000-0000-0000-0000-0000007891a7', 'devon@tripsplit.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000007891a1', 'dana@tripsplit.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007891a2', 'marcus@tripsplit.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007891a3', 'luis@tripsplit.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007891a4', 'tara@tripsplit.test', 'Tara Trainee', 'assistant', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007891a7', 'devon@tripsplit.test', 'Devon Dev', 'dev', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA spl;
CREATE FUNCTION spl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION spl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF want <> '' AND position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION spl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A day counted from the bed's today: d(-5) is five days ago.
CREATE FUNCTION spl.d(n integer) RETURNS text LANGUAGE sql STABLE AS $$ SELECT (public.app_today() + n)::text $$;
CREATE FUNCTION spl.day(n integer) RETURNS date LANGUAGE sql STABLE AS $$ SELECT public.app_today() + n $$;
-- An Extra trip on Heron Point with its work on the lodge job, with the people given.
CREATE FUNCTION spl.trip(p_id uuid, p_people jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'id', p_id, 'development_id', '00000000-0000-0000-0000-0000007891d1', 'purpose', 'Reset the riser', 'asked_by', 'them',
    'asked_who', 'Walt, the super', 'asked_how', 'by phone', 'outcome', 'Passed.', 'billing', 'extra',
    'people', p_people, 'job_ids', jsonb_build_array('00000000-0000-0000-0000-0000007891b1'))
$$;
-- A trip's people, each with a count of days, read as postgres.
CREATE FUNCTION spl.people(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(tp.person_name || ':' || (SELECT count(*) FROM jsonb_object_keys(tp.days))::text, ',' ORDER BY tp.person_name), 'nobody')
  FROM public.trip_people tp WHERE tp.trip_id = p_trip
$$;
-- A trip's first and last day.
CREATE FUNCTION spl.span(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT min(k) || ' to ' || max(k) FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = p_trip
$$;
-- The words a trip carries.
CREATE FUNCTION spl.words(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', t.purpose, t.asked_by, t.asked_who, t.asked_how, t.outcome, COALESCE(t.billing, 'not said'), t.via) FROM public.trips t WHERE t.id = p_trip
$$;
GRANT USAGE ON SCHEMA spl TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA spl TO authenticated, anon;

INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000007891d1', '00000000-0000-0000-0000-0000007891a2', 'Heron Point');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000007891f9', 'Trip Split Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000007891b1', '00000000-0000-0000-0000-0000007891a2', '00000000-0000-0000-0000-0000007891f9', 'Heron Point Lodge', '00000000-0000-0000-0000-0000007891d1');

-- 0 · The function is the signed-in app's, not the anon key's.
SELECT spl.same('a signed-in user may call the split, and the anon key may not',
  has_function_privilege('authenticated', 'public.trip_split(uuid, date, boolean)', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.trip_split(uuid, date, boolean)', 'EXECUTE')::text, 'true false');

-- 1 · A trip that was really two: Dana out three days, home two, out two more. Luis on the first part alone.
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a1');
SET LOCAL ROLE authenticated;
SELECT spl.same('the trip is saved', (SELECT r->>'did' FROM public.trip_save(spl.trip('00000000-0000-0000-0000-0000007891e1', jsonb_build_array(
  jsonb_build_object('name', 'Dana', 'days', jsonb_build_object(spl.d(-10), 'road', spl.d(-9), 'site', spl.d(-8), 'site', spl.d(-5), 'site', spl.d(-4), 'road')),
  jsonb_build_object('name', 'Luis', 'days', jsonb_build_object(spl.d(-9), 'site', spl.d(-8), 'site'))))) AS r), 'added');

SELECT public.trip_split('00000000-0000-0000-0000-0000007891e1', spl.day(-5), true) AS dry_one \gset
SELECT spl.same('the dry run says it would split, and names the trip''s number', (:'dry_one'::jsonb ->> 'would') || ' ' || (:'dry_one'::jsonb ->> 'trip_number') || ' ' || (:'dry_one'::jsonb ->> 'dry_run'), 'split 1 true');
SELECT spl.same('the first half: a change, both people, its days up to the gap', (:'dry_one'::jsonb #>> '{first,would}') || ' ' || (:'dry_one'::jsonb #>> '{first,people}') || ' ' || (:'dry_one'::jsonb #>> '{first,first_day}') || ' ' || (:'dry_one'::jsonb #>> '{first,last_day}'), 'change 2 ' || spl.d(-10) || ' ' || spl.d(-8));
SELECT spl.same('the second half: a new trip, the one person who went back', (:'dry_one'::jsonb #>> '{second,would}') || ' ' || (:'dry_one'::jsonb #>> '{second,people}') || ' ' || (:'dry_one'::jsonb #>> '{second,first_day}') || ' ' || (:'dry_one'::jsonb #>> '{second,last_day}'), 'add 1 ' || spl.d(-5) || ' ' || spl.d(-4));
SELECT spl.same('not on a bill, so the new trip would keep the billing word', (:'dry_one'::jsonb ->> 'on_bill') || ' ' || (:'dry_one'::jsonb ->> 'second_billing'), 'false extra');
RESET ROLE;
SELECT spl.same('the dry run wrote nothing', (SELECT count(*)::text FROM public.trips WHERE development_id = '00000000-0000-0000-0000-0000007891d1') || ' ' || spl.people('00000000-0000-0000-0000-0000007891e1'), '1 Dana:5,Luis:2');

-- 2 · What it refuses, in words.
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a1');
SET LOCAL ROLE authenticated;
SELECT spl.refused('a split at the trip''s first day', $q$SELECT public.trip_split('00000000-0000-0000-0000-0000007891e1', spl.day(-10))$q$, 'Pick a later day.');
SELECT spl.refused('a split past the trip''s last day', $q$SELECT public.trip_split('00000000-0000-0000-0000-0000007891e1', spl.day(-3))$q$, 'Pick an earlier day.');
SELECT spl.refused('a split of a trip that is not there', $q$SELECT public.trip_split('00000000-0000-0000-0000-0000007891ef', spl.day(-5))$q$, 'That trip is not here any more.');
SELECT spl.refused('a split with no day', $q$SELECT public.trip_split('00000000-0000-0000-0000-0000007891e1', NULL)$q$, 'Name the trip and the day its second part starts.');
RESET ROLE;
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a3');
SET LOCAL ROLE authenticated;
SELECT spl.refused('a crew lead splitting a trip', $q$SELECT public.trip_split('00000000-0000-0000-0000-0000007891e1', spl.day(-5))$q$, 'A trip is split by the office or a leader.');
RESET ROLE;
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a4');
SET LOCAL ROLE authenticated;
SELECT spl.refused('a training account splitting a trip', $q$SELECT public.trip_split('00000000-0000-0000-0000-0000007891e1', spl.day(-5))$q$, '');
RESET ROLE;
SELECT spl.same('every refusal left the trip whole, and made no second one', (SELECT count(*)::text FROM public.trips WHERE development_id = '00000000-0000-0000-0000-0000007891d1') || ' ' || spl.people('00000000-0000-0000-0000-0000007891e1'), '1 Dana:5,Luis:2');

-- 3 · The split.
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a1');
SET LOCAL ROLE authenticated;
SELECT public.trip_split('00000000-0000-0000-0000-0000007891e1', spl.day(-5)) AS split_one \gset
RESET ROLE;
SELECT spl.same('the split says what it did, the number kept and the number made', (:'split_one'::jsonb ->> 'did') || ' ' || (:'split_one'::jsonb ->> 'trip_number') || ' ' || (:'split_one'::jsonb ->> 'new_trip_number'), 'split 1 2');
SELECT spl.same('the trip keeps its id, its number and its first part', (SELECT trip_number::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007891e1') || ' ' || spl.people('00000000-0000-0000-0000-0000007891e1') || ' ' || spl.span('00000000-0000-0000-0000-0000007891e1'), '1 Dana:3,Luis:2 ' || spl.d(-10) || ' to ' || spl.d(-8));
SELECT spl.same('the new trip takes the second part, and only who went back', spl.people((:'split_one'::jsonb ->> 'new_trip_id')::uuid) || ' ' || spl.span((:'split_one'::jsonb ->> 'new_trip_id')::uuid), 'Dana:2 ' || spl.d(-5) || ' to ' || spl.d(-4));
SELECT spl.same('each day kept its kind', (SELECT tp.days::text FROM public.trip_people tp WHERE tp.trip_id = (:'split_one'::jsonb ->> 'new_trip_id')::uuid), jsonb_build_object(spl.d(-5), 'site', spl.d(-4), 'road')::text);
SELECT spl.same('the new trip carries the words, made in the app', spl.words((:'split_one'::jsonb ->> 'new_trip_id')::uuid), 'Reset the riser|them|Walt, the super|by phone|Passed.|extra|app');
SELECT spl.same('the first trip keeps its words', spl.words('00000000-0000-0000-0000-0000007891e1'), 'Reset the riser|them|Walt, the super|by phone|Passed.|extra|app');
SELECT spl.same('both name the job', (SELECT string_agg(job_id::text, ',' ORDER BY trip_id) FROM public.trip_jobs WHERE trip_id IN ('00000000-0000-0000-0000-0000007891e1', (:'split_one'::jsonb ->> 'new_trip_id')::uuid)), '00000000-0000-0000-0000-0000007891b1,00000000-0000-0000-0000-0000007891b1');
SELECT spl.same('the site holds two trips, numbered 1 and 2', (SELECT string_agg(trip_number::text, ',' ORDER BY trip_number) FROM public.trips WHERE development_id = '00000000-0000-0000-0000-0000007891d1'), '1,2');
SELECT spl.same('the first part is over, so it is ended; the second was never ended', (SELECT (ended_at IS NOT NULL)::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007891e1') || ' ' || (SELECT (ended_at IS NOT NULL)::text FROM public.trips WHERE id = (:'split_one'::jsonb ->> 'new_trip_id')::uuid), 'true false');
SELECT spl.same('nothing was kept as deleted: no trip went', (SELECT count(*)::text FROM public.deleted_records_archive WHERE group_key IN ('00000000-0000-0000-0000-0000007891e1', :'split_one'::jsonb ->> 'new_trip_id')), '0');

-- 4 · A trip still out, split at a day to come: its first part runs through today, so it is not ended.
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a2');
SET LOCAL ROLE authenticated;
SELECT spl.same('a trip out now is saved', (SELECT r->>'did' FROM public.trip_save(spl.trip('00000000-0000-0000-0000-0000007891e2', jsonb_build_array(
  jsonb_build_object('name', 'Marcus', 'days', jsonb_build_object(spl.d(-1), 'road', spl.d(0), 'site', spl.d(3), 'site', spl.d(4), 'road'))))) AS r), 'added');
SELECT public.trip_split('00000000-0000-0000-0000-0000007891e2', spl.day(3)) AS split_two \gset
RESET ROLE;
SELECT spl.same('a master splits one too, and the new trip takes the next number', (:'split_two'::jsonb ->> 'did') || ' ' || (:'split_two'::jsonb ->> 'trip_number') || ' ' || (:'split_two'::jsonb ->> 'new_trip_number'), 'split 3 4');
SELECT spl.same('a first part that runs through today is not ended', (SELECT (ended_at IS NULL)::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007891e2') || ' ' || spl.span('00000000-0000-0000-0000-0000007891e2'), 'true ' || spl.d(-1) || ' to ' || spl.d(0));

-- 5 · A trip ended on the phone: the new trip takes the stamp the trip had, and the first keeps its own.
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a1');
SET LOCAL ROLE authenticated;
SELECT spl.same('a third trip is saved', (SELECT r->>'did' FROM public.trip_save(spl.trip('00000000-0000-0000-0000-0000007891e3', jsonb_build_array(
  jsonb_build_object('name', 'Luis', 'days', jsonb_build_object(spl.d(-20), 'site', spl.d(-19), 'site', spl.d(-15), 'site'))))) AS r), 'added');
RESET ROLE;
UPDATE public.trips SET ended_at = '2026-01-02 03:04:05+00' WHERE id = '00000000-0000-0000-0000-0000007891e3';
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a1');
SET LOCAL ROLE authenticated;
SELECT public.trip_split('00000000-0000-0000-0000-0000007891e3', spl.day(-15)) AS split_three \gset
RESET ROLE;
SELECT spl.same('both parts of an ended trip carry the stamp it had', (SELECT string_agg(to_char(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'), ',') FROM public.trips WHERE id IN ('00000000-0000-0000-0000-0000007891e3', (:'split_three'::jsonb ->> 'new_trip_id')::uuid)), '2026-01-02 03:04:05,2026-01-02 03:04:05');

-- 6 · A trip on a bill: its line stays with the trip that keeps the id, and the new trip starts with no billing said.
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a7');
SET LOCAL ROLE authenticated;
SELECT spl.same('a fourth trip is saved', (SELECT r->>'did' FROM public.trip_save(spl.trip('00000000-0000-0000-0000-0000007891e4', jsonb_build_array(
  jsonb_build_object('name', 'Dana', 'days', jsonb_build_object(spl.d(-30), 'site', spl.d(-29), 'site', spl.d(-25), 'site'))))) AS r), 'added');
RESET ROLE;
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, count, sequence_order, line_unit_price, line_kind) VALUES
  ('00000000-0000-0000-0000-0000007891c1', '00000000-0000-0000-0000-0000007891b1', 'Trip line', 1, 0, 1800, 'work');
UPDATE public.jobs_ledger_fixtures SET trip_id = '00000000-0000-0000-0000-0000007891e4' WHERE id = '00000000-0000-0000-0000-0000007891c1';
SELECT spl.as_user('00000000-0000-0000-0000-0000007891a7');
SET LOCAL ROLE authenticated;
SELECT spl.same('the dry run says the trip is on a bill, and the new trip would say no billing', (SELECT (r ->> 'on_bill') || ' ' || COALESCE(r ->> 'second_billing', 'not said') FROM public.trip_split('00000000-0000-0000-0000-0000007891e4', spl.day(-25), true) AS r), 'true not said');
SELECT public.trip_split('00000000-0000-0000-0000-0000007891e4', spl.day(-25)) AS split_four \gset
RESET ROLE;
SELECT spl.same('the trip on the bill keeps its billing word and its line', spl.words('00000000-0000-0000-0000-0000007891e4') || ' / ' || (SELECT trip_id::text FROM public.jobs_ledger_fixtures WHERE id = '00000000-0000-0000-0000-0000007891c1'), 'Reset the riser|them|Walt, the super|by phone|Passed.|extra|app / 00000000-0000-0000-0000-0000007891e4');
SELECT spl.same('the new trip starts with no billing said, and holds no line', spl.words((:'split_four'::jsonb ->> 'new_trip_id')::uuid) || ' / ' || (SELECT count(*)::text FROM public.jobs_ledger_fixtures WHERE trip_id = (:'split_four'::jsonb ->> 'new_trip_id')::uuid), 'Reset the riser|them|Walt, the super|by phone|Passed.|not said|app / 0');

SELECT spl.same('the site''s numbers, each once, in the order the trips were made', (SELECT string_agg(trip_number::text, ',' ORDER BY trip_number) FROM public.trips WHERE development_id = '00000000-0000-0000-0000-0000007891d1'), '1,2,3,4,5,6,7,8');

DO $$ BEGIN RAISE NOTICE 'trips split PASSED'; END $$;
ROLLBACK;
