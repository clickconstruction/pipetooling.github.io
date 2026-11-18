-- The trip record's phone ground (migration *_trips_phone, punch list #379): who the phone lets start a trip, what it
-- hands a crew member before it asks, start, join, day and end, each on the caller's own row and the server's own
-- today; who is refused, in words; that the crew still writes no trip row by itself; an ended trip; and the stamp
-- trip_save now names. Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on
-- the first failed assertion; ends with "trips phone PASSED". See scripts/pgtest-trips.sh. Never against prod. Every
-- name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office. Luis and Hector are on the job's crew. Cleo is on no crew and clocked in on the job today.
-- Omar works another job. Tara is in training, Tess is a twin and Gwen left: each is on the crew.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003791a1', 'dana@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a2', 'marcus@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a3', 'luis@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a4', 'hector@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a5', 'cleo@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a6', 'omar@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a7', 'tara@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a8', 'gwen@tripsphone.test'),
  ('00000000-0000-0000-0000-0000003791a9', 'tess@tripsphone.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003791a1', 'dana@tripsphone.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003791a2', 'marcus@tripsphone.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003791a3', 'luis@tripsphone.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003791a4', 'hector@tripsphone.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003791a5', 'cleo@tripsphone.test', 'Cleo Clock', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003791a6', 'omar@tripsphone.test', 'Omar Other', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003791a7', 'tara@tripsphone.test', 'Tara Training', 'helpers', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003791a8', 'gwen@tripsphone.test', 'Gwen Gone', 'helpers', false, false, false, now(), now()),
  ('00000000-0000-0000-0000-0000003791a9', 'tess@tripsphone.test', 'Tess Twin', 'helpers', false, true, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA tph;
CREATE FUNCTION tph.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tph.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION tph.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION tph.today() RETURNS text LANGUAGE sql STABLE AS $$ SELECT public.app_today()::text $$;
-- The phone's act on the bed's job, as one line: what it did.
CREATE FUNCTION tph.act(p_action text, p_job uuid, p_trip uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_outcome text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.trip_phone(jsonb_strip_nulls(jsonb_build_object('action', p_action, 'job_id', p_job, 'trip_id', p_trip, 'kind', p_kind, 'outcome', p_outcome)))
$$;
GRANT USAGE ON SCHEMA tph TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tph TO authenticated, anon;

-- Two sites with a job each, and a job on no site. Luis has a roster row; Hector has none.
INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000003791d1', '00000000-0000-0000-0000-0000003791a2', 'Heron Point'),
  ('00000000-0000-0000-0000-0000003791d2', '00000000-0000-0000-0000-0000003791a2', 'Egret Landing');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003791f9', 'Trips Phone Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000003791b1', '00000000-0000-0000-0000-0000003791a2', '00000000-0000-0000-0000-0000003791f9', 'Rough-in: lodge and bunkhouse', '00000000-0000-0000-0000-0000003791d1'),
  ('00000000-0000-0000-0000-0000003791b2', '00000000-0000-0000-0000-0000003791a2', '00000000-0000-0000-0000-0000003791f9', 'A far job on no site', NULL),
  ('00000000-0000-0000-0000-0000003791b3', '00000000-0000-0000-0000-0000003791a2', '00000000-0000-0000-0000-0000003791f9', 'Egret gas line', '00000000-0000-0000-0000-0000003791d2');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
  SELECT j, u FROM (VALUES
    ('00000000-0000-0000-0000-0000003791b1'::uuid, '00000000-0000-0000-0000-0000003791a3'::uuid),
    ('00000000-0000-0000-0000-0000003791b1', '00000000-0000-0000-0000-0000003791a4'),
    ('00000000-0000-0000-0000-0000003791b1', '00000000-0000-0000-0000-0000003791a7'),
    ('00000000-0000-0000-0000-0000003791b1', '00000000-0000-0000-0000-0000003791a8'),
    ('00000000-0000-0000-0000-0000003791b1', '00000000-0000-0000-0000-0000003791a9'),
    ('00000000-0000-0000-0000-0000003791b2', '00000000-0000-0000-0000-0000003791a3'),
    ('00000000-0000-0000-0000-0000003791b3', '00000000-0000-0000-0000-0000003791a6')) AS v(j, u)
  ON CONFLICT DO NOTHING;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000003791c3', '00000000-0000-0000-0000-0000003791a2', 'superintendent', 'Luis Ortega', '00000000-0000-0000-0000-0000003791a3');
-- Cleo is on no crew: a clock row of her own on the job, today, is what lets her in.
INSERT INTO public.clock_sessions (user_id, job_ledger_id, work_date, clocked_in_at) VALUES
  ('00000000-0000-0000-0000-0000003791a5', '00000000-0000-0000-0000-0000003791b1', public.app_today(), now() - interval '1 hour');
CREATE TEMP TABLE tph_clock_before AS SELECT count(*) AS n FROM public.clock_sessions;
GRANT SELECT ON tph_clock_before TO authenticated;

-- 0 · The gate, by itself.
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a3'); SET LOCAL ROLE authenticated;
SELECT tph.same('someone on the crew is working the job', public.trip_crew_on_job('00000000-0000-0000-0000-0000003791b1')::text, 'true');
SELECT tph.same('and not a job they are not on', public.trip_crew_on_job('00000000-0000-0000-0000-0000003791b3')::text, 'false');
RESET ROLE;
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a5'); SET LOCAL ROLE authenticated;
SELECT tph.same('a clock row today lets someone on no crew in', public.trip_crew_on_job('00000000-0000-0000-0000-0000003791b1')::text, 'true');
RESET ROLE;

-- 1 · Before any trip: the phone is told the site, and that it has no trip.
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a3'); SET LOCAL ROLE authenticated;
SELECT tph.same('the state before any trip', (SELECT (s->>'ok') || ' ' || (s->>'development_name') || ' ' || (s->>'has_trips') || ' ' || coalesce(s->>'mine', 'none') || ' ' || (s->'open')::text || ' ' || ((s->>'today') = tph.today())::text FROM public.trip_phone_state('00000000-0000-0000-0000-0000003791b1') AS s), 'true Heron Point false none [] true');
SELECT tph.same('a job on no site has no site to keep a trip', (SELECT (s->>'ok') || ' ' || coalesce(s->>'development_id', 'none') FROM public.trip_phone_state('00000000-0000-0000-0000-0000003791b2') AS s), 'true none');
RESET ROLE;
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a6'); SET LOCAL ROLE authenticated;
SELECT tph.same('someone not working the job is told nothing', public.trip_phone_state('00000000-0000-0000-0000-0000003791b1')::text, '{"ok": false}');
SELECT tph.refused('someone not working the job starting a trip', $q$SELECT tph.act('start', '00000000-0000-0000-0000-0000003791b1')$q$, 'from a job you are working');
RESET ROLE;

-- 2 · Luis starts a trip: one trip on the site, from the phone, with him on it today, the job named.
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a3'); SET LOCAL ROLE authenticated;
SELECT tph.same('start says what it did', (SELECT (r->>'did') || ' ' || (r->>'kind') || ' ' || ((r->>'day') = tph.today())::text FROM tph.act('start', '00000000-0000-0000-0000-0000003791b1') AS r), 'started site true');
SELECT tph.same('he reads his own trip', (SELECT count(*)::text || ' ' || min(via) || ' ' || (min(created_by::text) = '00000000-0000-0000-0000-0000003791a3')::text FROM public.trips), '1 phone true');
SELECT tph.same('he is on it under his roster name, today At the site', (SELECT person_name || ' / ' || (person_id = '00000000-0000-0000-0000-0000003791c3')::text || ' / ' || (days ->> tph.today()) FROM public.trip_people), 'Luis Ortega / true / site');
SELECT tph.same('the job is named under Work goes on', (SELECT count(*)::text FROM public.trip_jobs WHERE job_id = '00000000-0000-0000-0000-0000003791b1'), '1');
SELECT tph.same('starting again is the same trip, today painted', (SELECT (r->>'did') FROM tph.act('start', '00000000-0000-0000-0000-0000003791b1', NULL, 'road') AS r) || ' ' || (SELECT count(*)::text FROM public.trips) || ' ' || (SELECT days ->> tph.today() FROM public.trip_people), 'day 1 road');
SELECT tph.refused('a trip from a job on no site', $q$SELECT tph.act('start', '00000000-0000-0000-0000-0000003791b2')$q$, 'not in a development yet');
SELECT tph.refused('a trip row written straight to the table', $q$INSERT INTO public.trips (development_id) VALUES ('00000000-0000-0000-0000-0000003791d1')$q$, 'row-level security');
SELECT tph.refused('a day that is not one of the three', $q$SELECT tph.act('day', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM public.trips LIMIT 1), 'home')$q$, 'ready, road or site');
SELECT tph.refused('an act the phone does not have', $q$SELECT tph.act('delete', '00000000-0000-0000-0000-0000003791b1')$q$, 'start, join, day or end');
RESET ROLE;
CREATE TEMP TABLE tph_trip AS SELECT id FROM public.trips WHERE via = 'phone';
GRANT SELECT ON tph_trip TO authenticated;

-- 3 · Hector is told of the open trip by first name, joins it, and marks his day.
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a4'); SET LOCAL ROLE authenticated;
SELECT tph.same('a crewmate is told of the open trip, by first name', (SELECT coalesce(s->>'mine', 'none') || ' ' || jsonb_array_length(s->'open')::text || ' ' || (s->'open'->0->'people')::text || ' ' || (s->>'has_trips') FROM public.trip_phone_state('00000000-0000-0000-0000-0000003791b1') AS s), 'none 1 ["Luis"] true');
SELECT tph.same('he reads no trip row yet', (SELECT count(*)::text FROM public.trips), '0');
SELECT tph.refused('a day on a trip he is not on', $q$SELECT tph.act('day', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM tph_trip))$q$, 'Join it first');
SELECT tph.same('join says what it did', (SELECT (r->>'did') || ' ' || (r->>'kind') FROM tph.act('join', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM tph_trip), 'road') AS r), 'joined road');
SELECT tph.same('he is on it under his login''s name, with no roster row', (SELECT person_name || ' / ' || (person_id IS NULL)::text || ' / ' || (days ->> tph.today()) FROM public.trip_people WHERE user_id = '00000000-0000-0000-0000-0000003791a4'), 'Hector Helper / true / road');
SELECT tph.same('he now reads the trip and who else is on it', (SELECT count(*)::text FROM public.trips) || ' ' || (SELECT count(*)::text FROM public.trip_people), '1 2');
SELECT tph.same('Clock in paints his today At the site', (SELECT (r->>'did') FROM tph.act('day', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM tph_trip), 'site') AS r) || ' ' || (SELECT days ->> tph.today() FROM public.trip_people WHERE user_id = '00000000-0000-0000-0000-0000003791a4'), 'day site');
SELECT tph.same('the state names his trip and who he is with', (SELECT ((s->'mine'->>'trip_id') = (SELECT id::text FROM tph_trip))::text || ' ' || (s->'mine'->'with')::text || ' ' || (s->'open')::text FROM public.trip_phone_state('00000000-0000-0000-0000-0000003791b1') AS s), 'true ["Luis"] []');
UPDATE public.trip_people SET days = '{}'::jsonb WHERE user_id = '00000000-0000-0000-0000-0000003791a4';
DELETE FROM public.trips;
RESET ROLE;
SELECT tph.same('his own row written straight to the table changed nothing, and neither did his delete', (SELECT (days ->> tph.today()) FROM public.trip_people WHERE user_id = '00000000-0000-0000-0000-0000003791a4') || ' ' || (SELECT count(*)::text FROM public.trips WHERE via = 'phone'), 'site 1');

-- 4 · Cleo, on no crew and clocked in today, joins too. A trip of another site is not hers to join from this job.
INSERT INTO public.trips (id, development_id, via) VALUES ('00000000-0000-0000-0000-0000003791e2', '00000000-0000-0000-0000-0000003791d2', 'app');
INSERT INTO public.trip_people (trip_id, person_name, days) VALUES ('00000000-0000-0000-0000-0000003791e2', 'Omar Other', jsonb_build_object(tph.today(), 'site'));
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a5'); SET LOCAL ROLE authenticated;
SELECT tph.same('someone clocked in on the job joins', (SELECT (r->>'did') FROM tph.act('join', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM tph_trip)) AS r), 'joined');
SELECT tph.refused('a trip of another site joined from this job', $q$SELECT tph.act('join', '00000000-0000-0000-0000-0000003791b1', '00000000-0000-0000-0000-0000003791e2')$q$, 'not on this job''s site');
RESET ROLE;

-- 5 · Training, a twin, and someone who left: refused, and nothing written.
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a7'); SET LOCAL ROLE authenticated;
SELECT tph.refused('a training account starting a trip', $q$SELECT tph.act('start', '00000000-0000-0000-0000-0000003791b1')$q$, 'Training mode is read-only');
RESET ROLE;
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a9'); SET LOCAL ROLE authenticated;
SELECT tph.refused('a twin starting a trip', $q$SELECT tph.act('start', '00000000-0000-0000-0000-0000003791b1')$q$, 'A digital twin keeps no trip');
RESET ROLE;
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a8'); SET LOCAL ROLE authenticated;
SELECT tph.refused('someone who left starting a trip', $q$SELECT tph.act('start', '00000000-0000-0000-0000-0000003791b1')$q$, '');
SELECT tph.same('and they are told nothing', public.trip_phone_state('00000000-0000-0000-0000-0000003791b1')::text, '{"ok": false}');
RESET ROLE;
SELECT tph.same('three people are on the phone trip, and no more', (SELECT count(*)::text FROM public.trip_people WHERE trip_id = (SELECT id FROM tph_trip)), '3');

-- 6 · The stamp trip_save names: null for a new trip, the stored stamp for one that exists. (Every statement of this
-- bed shares one transaction and so one now(), so that a later change moves the stamp is not shown here.)
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a1'); SET LOCAL ROLE authenticated;
SELECT tph.same('a new trip has no stamp to name', (SELECT (r ? 'was_updated_at')::text || ' ' || coalesce(r->>'was_updated_at', 'none') FROM public.trip_save('{"development_id": "00000000-0000-0000-0000-0000003791d1", "people": [{"name": "Dana", "days": {"2026-12-01": "site"}}]}'::jsonb, true) AS r), 'true none');
SELECT tph.same('a trip that exists names its stamp, and the dry run says change', (SELECT (r->>'would') || ' ' || ((r->>'was_updated_at')::timestamptz = (SELECT updated_at FROM public.trips WHERE id = (SELECT id FROM tph_trip)))::text FROM public.trip_save(jsonb_build_object('id', (SELECT id FROM tph_trip), 'development_id', '00000000-0000-0000-0000-0000003791d1', 'people', jsonb_build_array(jsonb_build_object('name', 'Dana', 'days', jsonb_build_object('2026-12-01', 'site')))), true) AS r), 'change true');
SELECT tph.same('the dry run wrote nothing', (SELECT count(*)::text FROM public.trip_people WHERE trip_id = (SELECT id FROM tph_trip)), '3');
RESET ROLE;

-- 7 · End the trip: stamped once, the outcome kept when there was none, and no more joins or days.
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a4'); SET LOCAL ROLE authenticated;
SELECT tph.same('end says what it did', (SELECT (r->>'did') || ' ' || (r->>'already') FROM tph.act('end', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM tph_trip), NULL, 'Did the work. Counted 98 boxes.') AS r), 'ended false');
SELECT tph.same('the trip is stamped and keeps how it went', (SELECT (ended_at IS NOT NULL)::text || ' / ' || outcome FROM public.trips WHERE id = (SELECT id FROM tph_trip)), 'true / Did the work. Counted 98 boxes.');
SELECT tph.refused('a day on an ended trip', $q$SELECT tph.act('day', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM tph_trip))$q$, 'has ended');
RESET ROLE;
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a3'); SET LOCAL ROLE authenticated;
SELECT tph.same('ending again changes nothing, and a second outcome does not replace the first', (SELECT (r->>'already') FROM tph.act('end', '00000000-0000-0000-0000-0000003791b1', (SELECT id FROM tph_trip), NULL, 'Something else.') AS r) || ' / ' || (SELECT outcome FROM public.trips WHERE id = (SELECT id FROM tph_trip)), 'true / Did the work. Counted 98 boxes.');
SELECT tph.same('an ended trip is no longer his open trip, and a new start makes a new one', (SELECT coalesce(s->>'mine', 'none') FROM public.trip_phone_state('00000000-0000-0000-0000-0000003791b1') AS s) || ' ' || (SELECT (r->>'did') FROM tph.act('start', '00000000-0000-0000-0000-0000003791b1') AS r), 'none started');
RESET ROLE;

-- 8 · The office still changes and deletes a phone trip like any other, and no clock row was written by any of it.
SELECT tph.as_user('00000000-0000-0000-0000-0000003791a1'); SET LOCAL ROLE authenticated;
SELECT tph.same('the office changes a phone trip', (SELECT (r->>'did') FROM public.trip_save(jsonb_build_object('id', (SELECT id FROM tph_trip), 'development_id', '00000000-0000-0000-0000-0000003791d1', 'purpose', 'Lift stations before the pour', 'people', jsonb_build_array(jsonb_build_object('name', 'Luis Ortega', 'user_id', '00000000-0000-0000-0000-0000003791a3', 'days', jsonb_build_object(tph.today(), 'site'))))) AS r) || ' ' || (SELECT via || ' ' || (ended_at IS NOT NULL)::text FROM public.trips WHERE id = (SELECT id FROM tph_trip)), 'changed phone true');
DELETE FROM public.trips WHERE id = (SELECT id FROM tph_trip);
SELECT tph.same('and deletes it', (SELECT count(*)::text FROM public.trips WHERE id = (SELECT id FROM tph_trip)), '0');
RESET ROLE;
SELECT tph.same('no clock row was written', (SELECT count(*) FROM public.clock_sessions)::text, (SELECT n::text FROM tph_clock_before));

DO $$ BEGIN RAISE NOTICE 'trips phone PASSED'; END $$;
ROLLBACK;
