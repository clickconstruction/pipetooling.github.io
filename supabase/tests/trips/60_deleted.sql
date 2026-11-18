-- Deleted trips are kept (migration *_trips_deleted): a deleted trip goes to the archive whole, its row, its people
-- and its jobs under the trip's id; a save that rewrites the people and the jobs leaves nothing there, and neither
-- does a deleted job that takes its link; the office reads a site's deleted trips, each in the shape the app reads a
-- trip; who is refused, in words; a trip put back through trip_save under its own id keeps its number and leaves the
-- list; a trip deleted twice is listed once, by its newest delete; a job and a login gone since are left out, so the
-- put back still saves; the dev's own restore works on a trip's bundle; and a trip that goes with its site is kept
-- too. Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on the first failed
-- assertion; ends with "trips deleted PASSED". See scripts/pgtest-trips.sh. Never against prod.
-- Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office (assistant), Marcus a master, Devon a dev. Luis (superintendent) is on the trip. Priya
-- estimates. Tess is an assistant twin, Gwen an assistant who left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000007800a1', 'dana@tripdeleted.test'),
  ('00000000-0000-0000-0000-0000007800a2', 'marcus@tripdeleted.test'),
  ('00000000-0000-0000-0000-0000007800a3', 'luis@tripdeleted.test'),
  ('00000000-0000-0000-0000-0000007800a4', 'priya@tripdeleted.test'),
  ('00000000-0000-0000-0000-0000007800a5', 'tess@tripdeleted.test'),
  ('00000000-0000-0000-0000-0000007800a6', 'gwen@tripdeleted.test'),
  ('00000000-0000-0000-0000-0000007800a7', 'devon@tripdeleted.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000007800a1', 'dana@tripdeleted.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007800a2', 'marcus@tripdeleted.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007800a3', 'luis@tripdeleted.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007800a4', 'priya@tripdeleted.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007800a5', 'tess@tripdeleted.test', 'Tess Twin', 'assistant', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007800a6', 'gwen@tripdeleted.test', 'Gwen Gone', 'assistant', false, false, false, now(), now()),
  ('00000000-0000-0000-0000-0000007800a7', 'devon@tripdeleted.test', 'Devon Dev', 'dev', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA tdb;
CREATE FUNCTION tdb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tdb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION tdb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The trip the scenario saves: Luis by his login and Walt by name alone, two days at the site, its work on two jobs.
CREATE FUNCTION tdb.payload(p_id uuid, p_dev uuid, p_purpose text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'id', p_id, 'development_id', p_dev, 'purpose', p_purpose, 'asked_by', 'them', 'asked_who', 'Walt, the super', 'asked_how', 'by phone',
    'billing', 'extra',
    'people', jsonb_build_array(
      jsonb_build_object('name', 'Luis Lead', 'user_id', '00000000-0000-0000-0000-0000007800a3', 'days', jsonb_build_object('2026-10-26', 'site', '2026-10-27', 'site')),
      jsonb_build_object('name', 'Walt Outside', 'days', jsonb_build_object('2026-10-26', 'site'))),
    'job_ids', CASE WHEN p_dev = '00000000-0000-0000-0000-0000007800d1'::uuid
      THEN jsonb_build_array('00000000-0000-0000-0000-0000007800b1', '00000000-0000-0000-0000-0000007800b2') ELSE '[]'::jsonb END)
$$;
-- What the archive holds of a trip that nothing has put back. Read as postgres: the archive is closed to the office.
CREATE FUNCTION tdb.archived(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT format('trips %s, people %s, jobs %s',
    count(*) FILTER (WHERE table_name = 'trips'), count(*) FILTER (WHERE table_name = 'trip_people'), count(*) FILTER (WHERE table_name = 'trip_jobs'))
  FROM public.deleted_records_archive WHERE group_key = p_trip::text AND restored_at IS NULL
$$;
-- What the app sends to put a listed trip back: the trip as trip_save takes it.
CREATE FUNCTION tdb.back(p_item jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT (t - 'trip_people' - 'trip_jobs' - 'created_at') || jsonb_build_object(
    'people', COALESCE((SELECT jsonb_agg(jsonb_build_object('person_id', e->'person_id', 'user_id', e->'user_id', 'name', e->>'person_name', 'days', e->'days')) FROM jsonb_array_elements(t->'trip_people') AS e), '[]'::jsonb),
    'job_ids', COALESCE((SELECT jsonb_agg(e->>'job_id') FROM jsonb_array_elements(t->'trip_jobs') AS e), '[]'::jsonb))
  FROM (SELECT p_item->'trip' AS t) AS s
$$;
GRANT USAGE ON SCHEMA tdb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tdb TO authenticated, anon;

INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000007800d1', '00000000-0000-0000-0000-0000007800a2', 'Heron Point'),
  ('00000000-0000-0000-0000-0000007800d2', '00000000-0000-0000-0000-0000007800a2', 'Egret Landing');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000007800f9', 'Trip Deleted Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000007800b1', '00000000-0000-0000-0000-0000007800a2', '00000000-0000-0000-0000-0000007800f9', 'Rough-in: lodge', '00000000-0000-0000-0000-0000007800d1'),
  ('00000000-0000-0000-0000-0000007800b2', '00000000-0000-0000-0000-0000007800a2', '00000000-0000-0000-0000-0000007800f9', 'Rough-in: bunkhouse', '00000000-0000-0000-0000-0000007800d1');

-- 0 · The three tables carry the capture, and the trip's own table settles on insert.
SELECT tdb.same('trips, trip_people and trip_jobs each carry the capture', (SELECT string_agg(c.relname, ',' ORDER BY c.relname) FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid WHERE g.tgname = 'zzz_archive_on_delete' AND c.relname IN ('trips', 'trip_people', 'trip_jobs')), 'trip_jobs,trip_people,trips');
SELECT tdb.same('trips settles its archive rows on insert', (SELECT count(*) FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid WHERE g.tgname = 'trips_settle_archive' AND c.relname = 'trips')::text, '1');

-- 1 · Dana saves a trip, then changes it. A save rewrites the people and the jobs, and that is not a deleted trip.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a1');
SET LOCAL ROLE authenticated;
SELECT tdb.same('the office saves a trip', (SELECT r->>'did' || ' ' || (r->>'trip_number') FROM public.trip_save(tdb.payload('00000000-0000-0000-0000-0000007800e1', '00000000-0000-0000-0000-0000007800d1', 'Reset the riser'), false) AS r), 'added 1');
SELECT tdb.same('and changes it whole', (SELECT r->>'did' FROM public.trip_save(tdb.payload('00000000-0000-0000-0000-0000007800e1', '00000000-0000-0000-0000-0000007800d1', 'Reset the riser the framers moved'), false) AS r), 'changed');
RESET ROLE;
SELECT tdb.same('a save that rewrites the people and the jobs leaves nothing in the archive', tdb.archived('00000000-0000-0000-0000-0000007800e1'), 'trips 0, people 0, jobs 0');

-- 2 · A deleted job takes its link to the trip. The trip is still there, so the link is not kept as a deleted trip's.
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000007800b2';
SELECT tdb.same('a deleted job takes its link', (SELECT count(*) FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000007800e1')::text, '1');
SELECT tdb.same('and leaves nothing under the trip in the archive', tdb.archived('00000000-0000-0000-0000-0000007800e1'), 'trips 0, people 0, jobs 0');

-- 3 · Dana deletes the trip. It goes to the archive whole, under its own id, in one moment, by her.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a1');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007800e1';
RESET ROLE;
SELECT tdb.same('the trip is gone, with its people and its jobs', (SELECT count(*) FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007800e1')::text || ' ' || (SELECT count(*) FROM public.trip_people WHERE trip_id = '00000000-0000-0000-0000-0000007800e1')::text || ' ' || (SELECT count(*) FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000007800e1')::text, '0 0 0');
SELECT tdb.same('a deleted trip is kept whole: its row, its two people and its job', tdb.archived('00000000-0000-0000-0000-0000007800e1'), 'trips 1, people 2, jobs 1');
SELECT tdb.same('in one moment, by the person who deleted it', (SELECT count(DISTINCT deleted_at)::text || ' ' || string_agg(DISTINCT deleted_by::text, ',') FROM public.deleted_records_archive WHERE group_key = '00000000-0000-0000-0000-0000007800e1'), '1 00000000-0000-0000-0000-0000007800a1');

-- 4 · The office reads the site's deleted trips, each whole, in the shape the app reads a trip.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a1');
SET LOCAL ROLE authenticated;
SELECT tdb.same('the office reads one deleted trip on the site', jsonb_array_length(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1'))::text, '1');
SELECT tdb.same('with its id, its number, its words and its billing', (SELECT concat_ws(' | ', i->'trip'->>'id', i->'trip'->>'trip_number', i->'trip'->>'purpose', i->'trip'->>'asked_by', i->'trip'->>'asked_who', i->'trip'->>'asked_how', i->'trip'->>'billing', i->'trip'->>'development_id') FROM (SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0 AS i) AS s), '00000000-0000-0000-0000-0000007800e1 | 1 | Reset the riser the framers moved | them | Walt, the super | by phone | extra | 00000000-0000-0000-0000-0000007800d1');
SELECT tdb.same('its people by name, one with his login and one a name alone', (SELECT string_agg(e->>'person_name' || ':' || COALESCE(e->>'user_id', '-'), ', ') FROM jsonb_array_elements(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0->'trip'->'trip_people') AS e), 'Luis Lead:00000000-0000-0000-0000-0000007800a3, Walt Outside:-');
SELECT tdb.same('each person''s own days', (SELECT (e->'days' = '{"2026-10-26": "site", "2026-10-27": "site"}'::jsonb)::text FROM jsonb_array_elements(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0->'trip'->'trip_people') AS e WHERE e->>'person_name' = 'Luis Lead'), 'true');
SELECT tdb.same('the job its work went on', (SELECT string_agg(e->>'job_id', ',') FROM jsonb_array_elements(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0->'trip'->'trip_jobs') AS e), '00000000-0000-0000-0000-0000007800b1');
SELECT tdb.same('who deleted it, and no job gone since', (SELECT concat_ws(' | ', i->>'deleted_by_name', i->>'jobs_gone', (i->>'deleted_at' IS NOT NULL)::text) FROM (SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0 AS i) AS s), 'Dana Office | 0 | true');
SELECT tdb.same('another site reads none', public.trip_deleted_list('00000000-0000-0000-0000-0000007800d2')::text, '[]');
SELECT tdb.refused('a list with no site', $q$SELECT public.trip_deleted_list(NULL)$q$, 'Name the site');

-- 5 · Who reads it: the trips office. A person who was on the trip, an estimator, a twin, someone who left and a
-- caller with no login are each refused.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a2');
SELECT tdb.same('a master reads it too', jsonb_array_length(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1'))::text, '1');
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a3');
SELECT tdb.refused('a person who was on the trip', $q$SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')$q$, 'Only the office');
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a4');
SELECT tdb.refused('an estimator', $q$SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')$q$, 'Only the office');
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a5');
SELECT tdb.refused('a digital twin', $q$SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')$q$, 'digital twin');
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a6');
SELECT tdb.refused('someone who left', $q$SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')$q$, 'archived');
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a1');
SELECT tdb.refused('the archive itself, read by an assistant', $q$DO $d$ BEGIN IF (SELECT count(*) FROM public.deleted_records_archive WHERE group_key = '00000000-0000-0000-0000-0000007800e1') = 0 THEN RAISE EXCEPTION 'closed to the office'; END IF; END $d$$q$, 'closed to the office');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT tdb.refused('a caller with no login', $q$SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')$q$, 'permission denied');
RESET ROLE;

-- 6 · Put back: trip_save under the trip's own id, as the Undo does. The number comes back, and the list is empty.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a1');
SET LOCAL ROLE authenticated;
SELECT tdb.same('the listed trip saves again under its own id, with its number', (SELECT r->>'did' || ' ' || (r->>'trip_id') || ' ' || (r->>'trip_number') FROM public.trip_save(tdb.back(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0), false) AS r), 'added 00000000-0000-0000-0000-0000007800e1 1');
SELECT tdb.same('and leaves the list', public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')::text, '[]');
RESET ROLE;
SELECT tdb.same('it is whole again: two people and its job', (SELECT count(*) FROM public.trip_people WHERE trip_id = '00000000-0000-0000-0000-0000007800e1')::text || ' ' || (SELECT count(*) FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000007800e1')::text, '2 1');
SELECT tdb.same('the archive holds nothing of it that is not put back', tdb.archived('00000000-0000-0000-0000-0000007800e1'), 'trips 0, people 0, jobs 0');
SELECT tdb.same('and says who put it back', (SELECT count(*)::text || ' ' || string_agg(DISTINCT restored_by::text, ',') FROM public.deleted_records_archive WHERE group_key = '00000000-0000-0000-0000-0000007800e1' AND restored_at IS NOT NULL), '4 00000000-0000-0000-0000-0000007800a1');

-- 7 · Deleted a second time, by Marcus: the list names it once, by its newest delete.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a2');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007800e1';
SELECT tdb.same('a trip deleted twice is listed once, by its newest delete', (SELECT jsonb_array_length(l)::text || ' ' || (l->0->>'deleted_by_name') FROM (SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1') AS l) AS s), '1 Marcus Master');
RESET ROLE;
SELECT tdb.same('the archive keeps both deletes of the trip''s row', (SELECT count(*) FROM public.deleted_records_archive WHERE table_name = 'trips' AND record_id = '00000000-0000-0000-0000-0000007800e1')::text, '2');

-- 8 · A job and a login gone since are left out of the listed trip, so putting it back still saves.
DELETE FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000007800b1';
UPDATE public.deleted_records_archive SET row_data = row_data || '{"user_id": "00000000-0000-0000-0000-00000078ffff"}'::jsonb
  WHERE table_name = 'trip_people' AND group_key = '00000000-0000-0000-0000-0000007800e1' AND restored_at IS NULL AND row_data->>'person_name' = 'Luis Lead';
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a1');
SET LOCAL ROLE authenticated;
SELECT tdb.same('a job gone since is counted and left out', (SELECT (i->>'jobs_gone') || ' ' || (i->'trip'->'trip_jobs')::text FROM (SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0 AS i) AS s), '1 []');
SELECT tdb.same('a login gone since is a name alone', (SELECT string_agg(e->>'person_name' || ':' || COALESCE(e->>'user_id', '-'), ', ') FROM jsonb_array_elements(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0->'trip'->'trip_people') AS e), 'Luis Lead:-, Walt Outside:-');
SELECT tdb.same('and the trip still goes back', (SELECT r->>'did' || ' ' || (r->>'trip_number') || ' ' || (r->>'jobs') FROM public.trip_save(tdb.back(public.trip_deleted_list('00000000-0000-0000-0000-0000007800d1')->0), false) AS r), 'added 1 0');
RESET ROLE;

-- 9 · The dev's own restore works on a trip's bundle, since every archived row is the row as it was.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a7');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007800e1';
SELECT tdb.same('the dev''s restore takes the trip''s bundle', (SELECT r->>'ok' FROM public.restore_deleted_records('00000000-0000-0000-0000-0000007800e1', false) AS r), 'true');
RESET ROLE;
SELECT tdb.same('and the trip is back with its people', (SELECT count(*) FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007800e1')::text || ' ' || (SELECT count(*) FROM public.trip_people WHERE trip_id = '00000000-0000-0000-0000-0000007800e1')::text, '1 2');
SELECT tdb.same('with nothing left to put back', tdb.archived('00000000-0000-0000-0000-0000007800e1'), 'trips 0, people 0, jobs 0');

-- 10 · A trip that goes with its site is kept too, its people with it.
SELECT tdb.as_user('00000000-0000-0000-0000-0000007800a1');
SET LOCAL ROLE authenticated;
SELECT tdb.same('a trip on the second site', (SELECT r->>'did' FROM public.trip_save(tdb.payload('00000000-0000-0000-0000-0000007800e2', '00000000-0000-0000-0000-0000007800d2', 'Walk the site'), false) AS r), 'added');
RESET ROLE;
DELETE FROM public.developments WHERE id = '00000000-0000-0000-0000-0000007800d2';
SELECT tdb.same('a trip that goes with its site is kept whole', tdb.archived('00000000-0000-0000-0000-0000007800e2'), 'trips 1, people 2, jobs 0');

DO $$ BEGIN RAISE NOTICE 'trips deleted PASSED'; END $$;
ROLLBACK;
