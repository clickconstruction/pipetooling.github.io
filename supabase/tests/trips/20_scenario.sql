-- A trip record (migration *_trips, punch list #379): the four tables carry their fences; the office saves a trip
-- whole through trip_save, a dry run first; a person on a trip reads it and nobody else outside the office does; a
-- trip is replaced whole, deleted with its people and jobs, and made again under its own id; what trip_save refuses,
-- in words; the days check on the table itself; training, twin and archived accounts; Not a trip; and a trip going
-- with its development or its job. Fixtures are written as postgres; presses run as each user; everything rolls
-- back. Raises on the first failed assertion; ends with "trips PASSED". See scripts/pgtest-trips.sh. Never against
-- prod. Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office (assistant). Marcus is a master, Devon a dev, Cole the controller, Pat a primary: the office
-- door. Luis (superintendent) goes on the trip and has a login. Hector (helpers) is on no trip. Priya estimates.
-- Tara is an assistant in training, Tess an assistant twin, Gwen an assistant who left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003790a1', 'dana@trips.test'),
  ('00000000-0000-0000-0000-0000003790a2', 'marcus@trips.test'),
  ('00000000-0000-0000-0000-0000003790a3', 'luis@trips.test'),
  ('00000000-0000-0000-0000-0000003790a4', 'hector@trips.test'),
  ('00000000-0000-0000-0000-0000003790a5', 'pat@trips.test'),
  ('00000000-0000-0000-0000-0000003790a6', 'cole@trips.test'),
  ('00000000-0000-0000-0000-0000003790a7', 'priya@trips.test'),
  ('00000000-0000-0000-0000-0000003790a8', 'gwen@trips.test'),
  ('00000000-0000-0000-0000-0000003790a9', 'tess@trips.test'),
  ('00000000-0000-0000-0000-0000003790ab', 'devon@trips.test'),
  ('00000000-0000-0000-0000-0000003790ac', 'tara@trips.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003790a1', 'dana@trips.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790a2', 'marcus@trips.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790a3', 'luis@trips.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790a4', 'hector@trips.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790a5', 'pat@trips.test', 'Pat Primary', 'primary', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790a6', 'cole@trips.test', 'Cole Controller', 'controller', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790a7', 'priya@trips.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790a8', 'gwen@trips.test', 'Gwen Gone', 'assistant', false, false, false, now(), now()),
  ('00000000-0000-0000-0000-0000003790a9', 'tess@trips.test', 'Tess Twin', 'assistant', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790ab', 'devon@trips.test', 'Devon Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003790ac', 'tara@trips.test', 'Tara Training', 'assistant', true, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA trb;
CREATE FUNCTION trb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Refused with these words; an empty want takes any refusal (a fence's own words are the fence's to choose).
CREATE FUNCTION trb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION trb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the caller reads of the trips: trips, people, jobs, as three counts.
CREATE FUNCTION trb.reads() RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.trips)::text || ' trips, ' || (SELECT count(*) FROM public.trip_people)::text || ' people, ' || (SELECT count(*) FROM public.trip_jobs)::text || ' jobs'
$$;
GRANT USAGE ON SCHEMA trb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA trb TO authenticated, anon;

-- A site with one job in it, and a job on no site.
INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000003790d1', '00000000-0000-0000-0000-0000003790a2', 'Heron Point');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003790f9', 'Trips Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000003790b1', '00000000-0000-0000-0000-0000003790a2', '00000000-0000-0000-0000-0000003790f9', 'Rough-in: lodge and bunkhouse', '00000000-0000-0000-0000-0000003790d1'),
  ('00000000-0000-0000-0000-0000003790b2', '00000000-0000-0000-0000-0000003790a2', '00000000-0000-0000-0000-0000003790f9', 'A far job on no site', NULL);

-- 0 · The four tables carry their fences, and a second run of the migration left one of each policy.
SELECT trb.same('every table has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('trips', 'trip_people', 'trip_jobs', 'trip_dismissals') AND policyname = 'archived_fence')::text, '4');
SELECT trb.same('every table has a training-mode trigger', (SELECT count(DISTINCT tgrelid) FROM pg_trigger WHERE tgrelid IN ('public.trips'::regclass, 'public.trip_people'::regclass, 'public.trip_jobs'::regclass, 'public.trip_dismissals'::regclass) AND NOT tgisinternal)::text, '4');
SELECT trb.same('trips has one of each policy of its own', (SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trips' AND policyname IN ('trips_delete', 'trips_insert', 'trips_select', 'trips_update')), 'trips_delete, trips_insert, trips_select, trips_update');
SELECT trb.same('anon holds nothing on the tables', (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name IN ('trips', 'trip_people', 'trip_jobs', 'trip_dismissals') AND grantee = 'anon')::text, '0');

-- 1 · The days check, by itself.
SELECT trb.same('real days with real kinds pass', public.trip_days_ok('{"2026-10-31":"site","2026-11-01":"road","2026-10-29":"ready"}')::text, 'true');
SELECT trb.same('no day at all passes the check', public.trip_days_ok('{}')::text, 'true');
SELECT trb.same('a kind that is not one of the three fails', public.trip_days_ok('{"2026-10-31":"home"}')::text, 'false');
SELECT trb.same('a day that is not on the calendar fails', public.trip_days_ok('{"2026-02-30":"site"}')::text, 'false');
SELECT trb.same('a key that is not a day fails', public.trip_days_ok('{"tuesday":"site"}')::text, 'false');
SELECT trb.same('a list is not days', public.trip_days_ok('["2026-10-31"]')::text, 'false');
SELECT trb.same('a kind that is not a word fails', public.trip_days_ok('{"2026-10-31":1}')::text, 'false');

-- 2 · Dana, the office: a dry run counts and writes nothing, then the save.
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a1');
SET LOCAL ROLE authenticated;
SELECT trb.same('a dry run counts the trip', (SELECT r->>'would' || ' ' || (r->>'people') || ' people ' || (r->>'person_days') || ' days ' || (r->>'first_day') || ' to ' || (r->>'last_day') || ' ' || (r->>'jobs') || ' job' FROM public.trip_save($j${
  "id": "00000000-0000-0000-0000-0000003790e1", "development_id": "00000000-0000-0000-0000-0000003790d1",
  "purpose": "Lift stations before the pour", "asked_by": "them", "asked_who": "Ray, the site super", "asked_how": "by phone, Oct 20", "billing": "inside",
  "people": [
    {"user_id": "00000000-0000-0000-0000-0000003790a3", "name": "Luis Lead", "days": {"2026-10-29": "ready", "2026-10-30": "road", "2026-10-31": "site", "2026-11-01": "site", "2026-11-03": "site", "2026-11-04": "road"}},
    {"name": "Walt (sub)", "days": {"2026-10-31": "site", "2026-11-01": "site"}}
  ],
  "job_ids": ["00000000-0000-0000-0000-0000003790b1"]}$j$::jsonb, true) AS r), 'add 2 people 8 days 2026-10-29 to 2026-11-04 1 job');
SELECT trb.same('the dry run wrote nothing', trb.reads(), '0 trips, 0 people, 0 jobs');
SELECT trb.same('the save says what it did', (SELECT r->>'did' || ' ' || (r->>'trip_id') FROM public.trip_save($j${
  "id": "00000000-0000-0000-0000-0000003790e1", "development_id": "00000000-0000-0000-0000-0000003790d1",
  "purpose": "Lift stations before the pour", "asked_by": "them", "asked_who": "Ray, the site super", "asked_how": "by phone, Oct 20", "billing": "inside",
  "people": [
    {"user_id": "00000000-0000-0000-0000-0000003790a3", "name": "Luis Lead", "days": {"2026-10-29": "ready", "2026-10-30": "road", "2026-10-31": "site", "2026-11-01": "site", "2026-11-03": "site", "2026-11-04": "road"}},
    {"name": "Walt (sub)", "days": {"2026-10-31": "site", "2026-11-01": "site"}}
  ],
  "job_ids": ["00000000-0000-0000-0000-0000003790b1"]}$j$::jsonb) AS r), 'added 00000000-0000-0000-0000-0000003790e1');
SELECT trb.same('the office reads the trip whole', trb.reads(), '1 trips, 2 people, 1 jobs');
SELECT trb.same('the trip keeps who saved it and where it came from', (SELECT purpose || ' / ' || asked_by || ' / ' || billing || ' / ' || via || ' / ' || (created_by = '00000000-0000-0000-0000-0000003790a1')::text FROM public.trips), 'Lift stations before the pour / them / inside / app / true');
SELECT trb.same('someone not in the app is a name alone', (SELECT (person_id IS NULL AND user_id IS NULL)::text FROM public.trip_people WHERE person_name = 'Walt (sub)'), 'true');
-- A second trip, held by a job on no site, with no id given.
SELECT trb.same('a job on no site holds a trip', (SELECT r->>'did' FROM public.trip_save($j${"job_id": "00000000-0000-0000-0000-0000003790b2", "people": [{"name": "Omar", "days": {"2026-09-08": "site"}}]}$j$::jsonb) AS r), 'added');
RESET ROLE;

-- 3 · Who reads. The office door reads both trips; Luis reads the one he is on, with who else is on it and its job.
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a2'); SET LOCAL ROLE authenticated;
SELECT trb.same('a master reads every trip', trb.reads(), '2 trips, 3 people, 1 jobs'); RESET ROLE;
SELECT trb.as_user('00000000-0000-0000-0000-0000003790ab'); SET LOCAL ROLE authenticated;
SELECT trb.same('a dev reads every trip', trb.reads(), '2 trips, 3 people, 1 jobs'); RESET ROLE;
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a6'); SET LOCAL ROLE authenticated;
SELECT trb.same('the controller reads every trip', trb.reads(), '2 trips, 3 people, 1 jobs'); RESET ROLE;
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a5'); SET LOCAL ROLE authenticated;
SELECT trb.same('a primary reads every trip', trb.reads(), '2 trips, 3 people, 1 jobs'); RESET ROLE;
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a3'); SET LOCAL ROLE authenticated;
SELECT trb.same('a person on a trip reads that trip, its people and its job', trb.reads(), '1 trips, 2 people, 1 jobs');
SELECT trb.same('and it is the trip he is on', (SELECT string_agg(id::text, ',') FROM public.trips), '00000000-0000-0000-0000-0000003790e1');
SELECT trb.refused('a person on a trip saving it', $q$SELECT public.trip_save('{"id": "00000000-0000-0000-0000-0000003790e1", "development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "Luis Lead", "days": {"2026-10-31": "site"}}]}'::jsonb)$q$, 'saved by the office or a leader');
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003790e1';
UPDATE public.trips SET purpose = 'changed by the crew';
UPDATE public.trip_people SET days = '{}'::jsonb;
SELECT trb.refused('a person on a trip adding a person to it', $q$INSERT INTO public.trip_people (trip_id, person_name) VALUES ('00000000-0000-0000-0000-0000003790e1', 'A friend')$q$, 'row-level security');
SELECT trb.same('a person on a trip reads no Not a trip line', (SELECT count(*) FROM public.trip_dismissals)::text, '0');
RESET ROLE;
SELECT trb.same('his delete and his updates changed nothing', (SELECT count(*)::text || ' ' || min(purpose) FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003790e1'), '1 Lift stations before the pour');
SELECT trb.same('and his days stand', (SELECT (days ? '2026-10-31')::text FROM public.trip_people WHERE person_name = 'Luis Lead'), 'true');
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a4'); SET LOCAL ROLE authenticated;
SELECT trb.same('a helper on no trip reads nothing', trb.reads(), '0 trips, 0 people, 0 jobs'); RESET ROLE;
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a7'); SET LOCAL ROLE authenticated;
SELECT trb.same('an estimator reads nothing', trb.reads(), '0 trips, 0 people, 0 jobs');
SELECT trb.refused('an estimator saving a trip', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "Priya", "days": {"2026-10-31": "site"}}]}'::jsonb)$q$, 'saved by the office or a leader');
RESET ROLE;

-- 4 · Training, a twin, and someone who left.
SELECT trb.as_user('00000000-0000-0000-0000-0000003790ac'); SET LOCAL ROLE authenticated;
SELECT trb.refused('a training account saving a trip', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "Tara", "days": {"2026-10-31": "site"}}]}'::jsonb)$q$, '');
RESET ROLE;
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a9'); SET LOCAL ROLE authenticated;
SELECT trb.refused('a twin saving a trip', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "Tess", "days": {"2026-10-31": "site"}}]}'::jsonb)$q$, '');
RESET ROLE;
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a8'); SET LOCAL ROLE authenticated;
SELECT trb.same('someone who left reads nothing', trb.reads(), '0 trips, 0 people, 0 jobs'); RESET ROLE;
SELECT trb.same('none of them left a row', (SELECT count(*) FROM public.trips)::text, '2');

-- 5 · What the save refuses, in words.
SELECT trb.as_user('00000000-0000-0000-0000-0000003790a1'); SET LOCAL ROLE authenticated;
SELECT trb.refused('a trip with nobody', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": []}'::jsonb)$q$, 'A trip needs one person and one day');
SELECT trb.refused('a trip whose one person has no day', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "Omar", "days": {}}]}'::jsonb)$q$, 'A trip needs one person and one day');
SELECT trb.refused('a trip with no home', $q$SELECT public.trip_save('{"people": [{"name": "Omar", "days": {"2026-09-08": "site"}}]}'::jsonb)$q$, 'belongs to a development, or to a job');
SELECT trb.refused('a kind that is not one of the three', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "Omar", "days": {"2026-09-08": "home"}}]}'::jsonb)$q$, 'Omar''s days are not days');
SELECT trb.refused('a person with no name', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "  ", "days": {"2026-09-08": "site"}}]}'::jsonb)$q$, 'Everyone on a trip has a name');
SELECT trb.refused('one person twice', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "people": [{"name": "Omar", "days": {"2026-09-08": "site"}}, {"name": "omar ", "days": {"2026-09-09": "site"}}]}'::jsonb)$q$, 'omar is on this trip twice');
SELECT trb.refused('billing that is not one of the three', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "billing": "free", "people": [{"name": "Omar", "days": {"2026-09-08": "site"}}]}'::jsonb)$q$, 'billing is inside, extra or ours');
SELECT trb.refused('asked by somebody else', $q$SELECT public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003790d1", "asked_by": "nobody", "people": [{"name": "Omar", "days": {"2026-09-08": "site"}}]}'::jsonb)$q$, 'us or them');
SELECT trb.refused('days that are not days, written straight to the table', $q$INSERT INTO public.trip_people (trip_id, person_name, days) VALUES ('00000000-0000-0000-0000-0000003790e1', 'Straight', '{"2026-02-30": "site"}'::jsonb)$q$, 'trip_people_days_check');
SELECT trb.same('no refusal left a row', trb.reads(), '2 trips, 3 people, 1 jobs');

-- 6 · A trip is replaced whole: one person fewer, a day changed, the job taken off, the words changed.
SELECT trb.same('the same id is a change', (SELECT r->>'did' || ' ' || (r->>'people') || ' ' || (r->>'jobs') FROM public.trip_save($j${
  "id": "00000000-0000-0000-0000-0000003790e1", "development_id": "00000000-0000-0000-0000-0000003790d1",
  "purpose": "Lift stations, and the material count", "outcome": "Did the work.", "billing": "extra",
  "people": [{"user_id": "00000000-0000-0000-0000-0000003790a3", "name": "Luis Lead", "days": {"2026-10-30": "road", "2026-10-31": "site"}}]}$j$::jsonb) AS r), 'changed 1 0');
SELECT trb.same('the trip is what the save said', (SELECT purpose || ' / ' || outcome || ' / ' || billing || ' / ' || coalesce(asked_by, 'nobody said') FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003790e1'), 'Lift stations, and the material count / Did the work. / extra / nobody said');
SELECT trb.same('its people and jobs were replaced', (SELECT (SELECT string_agg(person_name || ' ' || (SELECT count(*) FROM jsonb_object_keys(days))::text, ', ') FROM public.trip_people WHERE trip_id = '00000000-0000-0000-0000-0000003790e1') || ' / ' || (SELECT count(*) FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000003790e1')::text), 'Luis Lead 2 / 0');

-- 7 · Delete takes the trip with its people and jobs, and the same id makes it again: the undo.
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003790e1';
SELECT trb.same('the trip went with its people', trb.reads(), '1 trips, 1 people, 0 jobs');
SELECT trb.same('the same id makes it again', (SELECT r->>'did' || ' ' || (r->>'trip_id') FROM public.trip_save($j${
  "id": "00000000-0000-0000-0000-0000003790e1", "development_id": "00000000-0000-0000-0000-0000003790d1", "purpose": "Lift stations, and the material count",
  "people": [{"user_id": "00000000-0000-0000-0000-0000003790a3", "name": "Luis Lead", "days": {"2026-10-30": "road", "2026-10-31": "site"}}],
  "job_ids": ["00000000-0000-0000-0000-0000003790b1", "00000000-0000-0000-0000-0000003790b1"]}$j$::jsonb) AS r), 'added 00000000-0000-0000-0000-0000003790e1');
SELECT trb.same('a job named twice is on it once', trb.reads(), '2 trips, 2 people, 1 jobs');

-- 8 · Not a trip: the office keeps a line as itself and takes it back; nobody keeps one in another's name.
INSERT INTO public.trip_dismissals (development_id, user_id, person_name, first_day, last_day, dismissed_by) VALUES
  ('00000000-0000-0000-0000-0000003790d1', '00000000-0000-0000-0000-0000003790a4', 'Hector Helper', '2026-09-08', '2026-09-11', '00000000-0000-0000-0000-0000003790a1');
SELECT trb.same('the office reads the line', (SELECT count(*) FROM public.trip_dismissals)::text, '1');
SELECT trb.refused('a line kept in another person''s name', $q$INSERT INTO public.trip_dismissals (development_id, person_name, first_day, last_day, dismissed_by) VALUES ('00000000-0000-0000-0000-0000003790d1', 'Omar', '2026-09-08', '2026-09-11', '00000000-0000-0000-0000-0000003790a2')$q$, 'row-level security');
SELECT trb.refused('days out of order', $q$INSERT INTO public.trip_dismissals (development_id, person_name, first_day, last_day, dismissed_by) VALUES ('00000000-0000-0000-0000-0000003790d1', 'Omar', '2026-09-11', '2026-09-08', '00000000-0000-0000-0000-0000003790a1')$q$, 'trip_dismissals_days_in_order');
RESET ROLE;

-- 9 · A trip goes with its site, and a trip a job holds goes with that job. A job on a trip that goes leaves the trip.
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000003790b1';
SELECT trb.same('the trip outlives a job its work went on', (SELECT count(*)::text || ' trip, ' || (SELECT count(*) FROM public.trip_jobs)::text || ' jobs' FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003790e1'), '1 trip, 0 jobs');
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000003790b2';
SELECT trb.same('a trip a job holds goes with the job', (SELECT count(*) FROM public.trips)::text, '1');
DELETE FROM public.developments WHERE id = '00000000-0000-0000-0000-0000003790d1';
SELECT trb.same('a trip goes with its site, and its Not a trip lines too', (SELECT count(*) FROM public.trips)::text || ' ' || (SELECT count(*) FROM public.trip_people)::text || ' ' || (SELECT count(*) FROM public.trip_dismissals)::text, '0 0 0');

DO $$ BEGIN RAISE NOTICE 'trips PASSED'; END $$;
ROLLBACK;
