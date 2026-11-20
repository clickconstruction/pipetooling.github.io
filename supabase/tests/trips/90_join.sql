-- Join a trip with the next (migration *_trip_join): which trip is the next one on a home; the dry run says both
-- trips and the one they become, and writes nothing; the join keeps the trip's id, number and words, takes the next
-- trip's where its own are empty, merges people by name with every day from both, keeps this trip's kind on a day
-- both give one person, and takes both trips' jobs; what it refuses, in words; the next trip kept as deleted and
-- marked with the trip it was joined into; a split joined back is the trip as it was; the phone's ended stamp; a
-- line only the next trip holds tied to the joined trip, by a primary who reads no line; two lines and two billings
-- refused. Days are counted from the bed's own today. Fixtures are written as postgres; presses run as each user;
-- everything rolls back. Raises on the first failed assertion; ends with "trips join PASSED". See
-- scripts/pgtest-trips.sh. Never against prod. Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is in the office. Marcus is a master. Luis leads a crew. Tara is an assistant in training. Pat is a primary.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000007960a1', 'dana@tripjoin.test'),
  ('00000000-0000-0000-0000-0000007960a2', 'marcus@tripjoin.test'),
  ('00000000-0000-0000-0000-0000007960a3', 'luis@tripjoin.test'),
  ('00000000-0000-0000-0000-0000007960a4', 'tara@tripjoin.test'),
  ('00000000-0000-0000-0000-0000007960a5', 'pat@tripjoin.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000007960a1', 'dana@tripjoin.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007960a2', 'marcus@tripjoin.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007960a3', 'luis@tripjoin.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007960a4', 'tara@tripjoin.test', 'Tara Trainee', 'assistant', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007960a5', 'pat@tripjoin.test', 'Pat Primary', 'primary', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA jn;
CREATE FUNCTION jn.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jn.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jn.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A day counted from the bed's today: d(-5) is five days ago.
CREATE FUNCTION jn.d(n integer) RETURNS text LANGUAGE sql STABLE AS $$ SELECT (public.app_today() + n)::text $$;
CREATE FUNCTION jn.day(n integer) RETURNS date LANGUAGE sql STABLE AS $$ SELECT public.app_today() + n $$;
-- An Extra trip on Heron Point with its work on the lodge job, with the people given. p_over replaces any of it.
CREATE FUNCTION jn.trip(p_id uuid, p_people jsonb, p_over jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'id', p_id, 'development_id', '00000000-0000-0000-0000-0000007960d1', 'purpose', 'Reset the riser', 'asked_by', 'them',
    'asked_who', 'Walt, the super', 'asked_how', 'by phone', 'outcome', 'Passed.', 'billing', 'extra',
    'people', p_people, 'job_ids', jsonb_build_array('00000000-0000-0000-0000-0000007960b1')) || p_over
$$;
-- Dana alone, at the site, on the days given.
CREATE FUNCTION jn.dana(VARIADIC p_days integer[]) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_array(jsonb_build_object('name', 'Dana', 'days', (SELECT jsonb_object_agg(jn.d(n), 'site') FROM unnest(p_days) AS n)))
$$;
-- A trip's people, each with a count of days, read as postgres.
CREATE FUNCTION jn.people(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(tp.person_name || ':' || (SELECT count(*) FROM jsonb_object_keys(tp.days))::text, ',' ORDER BY tp.person_name), 'nobody')
  FROM public.trip_people tp WHERE tp.trip_id = p_trip
$$;
-- A trip's first and last day.
CREATE FUNCTION jn.span(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT min(k) || ' to ' || max(k) FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = p_trip
$$;
-- The words a trip carries.
CREATE FUNCTION jn.words(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', t.purpose, COALESCE(t.asked_by, 'nobody'), t.asked_who, t.asked_how, t.outcome, COALESCE(t.billing, 'not said'), t.via) FROM public.trips t WHERE t.id = p_trip
$$;
-- How many trips the site holds, read as postgres.
CREATE FUNCTION jn.kept() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.trips WHERE development_id = '00000000-0000-0000-0000-0000007960d1'
$$;
GRANT USAGE ON SCHEMA jn TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jn TO authenticated, anon;

INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000007960d1', '00000000-0000-0000-0000-0000007960a2', 'Heron Point'),
  ('00000000-0000-0000-0000-0000007960d2', '00000000-0000-0000-0000-0000007960a2', 'Osprey Landing');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000007960f9', 'Trip Join Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000007960b1', '00000000-0000-0000-0000-0000007960a2', '00000000-0000-0000-0000-0000007960f9', 'Heron Point Lodge', '00000000-0000-0000-0000-0000007960d1'),
  ('00000000-0000-0000-0000-0000007960b2', '00000000-0000-0000-0000-0000007960a2', '00000000-0000-0000-0000-0000007960f9', 'Heron Point Boathouse', '00000000-0000-0000-0000-0000007960d1'),
  ('00000000-0000-0000-0000-0000007960b9', '00000000-0000-0000-0000-0000007960a2', '00000000-0000-0000-0000-0000007960f9', 'A job on no site', NULL);

-- 0 · The functions are the signed-in app's, not the anon key's.
SELECT jn.same('a signed-in user may call the join, and the anon key may not',
  has_function_privilege('authenticated', 'public.trip_join(uuid, uuid, boolean)', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.trip_join(uuid, uuid, boolean)', 'EXECUTE')::text, 'true false');
SELECT jn.same('the same for the line''s step and for the next trip',
  has_function_privilege('authenticated', 'public.trip_join_line(uuid, uuid, boolean)', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.trip_join_line(uuid, uuid, boolean)', 'EXECUTE')::text || ' '
  || has_function_privilege('authenticated', 'public.trip_next_id(uuid)', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.trip_next_id(uuid)', 'EXECUTE')::text, 'true false true false');

-- 1 · Two trips that were really one, and a third after them. The first says no one asked and not how it went. The
--     second names Dana in capitals, gives her one day the first trip also gives her, and brings Walt and a second job.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.same('the first trip is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e1', jsonb_build_array(
  jsonb_build_object('name', 'Dana', 'days', jsonb_build_object(jn.d(-10), 'road', jn.d(-9), 'site', jn.d(-8), 'site')),
  jsonb_build_object('name', 'Luis', 'days', jsonb_build_object(jn.d(-9), 'site', jn.d(-8), 'site'))),
  jsonb_build_object('asked_by', NULL, 'asked_who', '', 'asked_how', '', 'outcome', ''))) AS r), 'added');
SELECT jn.same('the second trip is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e2', jsonb_build_array(
  jsonb_build_object('name', 'DANA', 'days', jsonb_build_object(jn.d(-8), 'road', jn.d(-5), 'site', jn.d(-4), 'road')),
  jsonb_build_object('name', 'Walt Outside', 'days', jsonb_build_object(jn.d(-5), 'site'))),
  jsonb_build_object('purpose', 'Second words', 'billing', NULL, 'job_ids', jsonb_build_array('00000000-0000-0000-0000-0000007960b2')))) AS r), 'added');
SELECT jn.same('the third trip is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e3', jn.dana(-2))) AS r), 'added');
-- Another site, and a job on no site with two trips of its own.
SELECT jn.same('a trip on another site is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960f1', jn.dana(-1),
  jsonb_build_object('development_id', '00000000-0000-0000-0000-0000007960d2', 'job_ids', '[]'::jsonb))) AS r), 'added');
SELECT jn.same('a job on no site holds a trip', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960f2', jn.dana(-7),
  jsonb_build_object('development_id', NULL, 'job_id', '00000000-0000-0000-0000-0000007960b9', 'job_ids', '[]'::jsonb))) AS r), 'added');
SELECT jn.same('and a second', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960f3', jn.dana(-6),
  jsonb_build_object('development_id', NULL, 'job_id', '00000000-0000-0000-0000-0000007960b9', 'job_ids', '[]'::jsonb))) AS r), 'added');

SELECT jn.same('the next trip is the one that went out next on the same site', COALESCE(public.trip_next_id('00000000-0000-0000-0000-0000007960e1')::text, 'none') || ' ' || COALESCE(public.trip_next_id('00000000-0000-0000-0000-0000007960e2')::text, 'none'),
  '00000000-0000-0000-0000-0000007960e2 00000000-0000-0000-0000-0000007960e3');
SELECT jn.same('the last trip on a site has no next, whatever another site holds', COALESCE(public.trip_next_id('00000000-0000-0000-0000-0000007960e3')::text, 'none'), 'none');
SELECT jn.same('a job on no site is a home of its own', COALESCE(public.trip_next_id('00000000-0000-0000-0000-0000007960f2')::text, 'none') || ' ' || COALESCE(public.trip_next_id('00000000-0000-0000-0000-0000007960f3')::text, 'none'),
  '00000000-0000-0000-0000-0000007960f3 none');

SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e2', true) AS dry_one \gset
SELECT jn.same('the dry run says it would join, and names both numbers', (:'dry_one'::jsonb ->> 'would') || ' ' || (:'dry_one'::jsonb ->> 'trip_number') || ' ' || (:'dry_one'::jsonb ->> 'next_trip_number') || ' ' || (:'dry_one'::jsonb ->> 'dry_run'), 'join 1 2 true');
SELECT jn.same('both trips as they stand', (:'dry_one'::jsonb #>> '{first,people}') || ' ' || (:'dry_one'::jsonb #>> '{first,first_day}') || ' ' || (:'dry_one'::jsonb #>> '{first,last_day}') || ' / ' || (:'dry_one'::jsonb #>> '{second,people}') || ' ' || (:'dry_one'::jsonb #>> '{second,first_day}') || ' ' || (:'dry_one'::jsonb #>> '{second,last_day}'),
  '2 ' || jn.d(-10) || ' ' || jn.d(-8) || ' / 2 ' || jn.d(-8) || ' ' || jn.d(-4));
SELECT jn.same('the one trip they become: a change, three people, the first day to the last, both jobs', (:'dry_one'::jsonb #>> '{joined,would}') || ' ' || (:'dry_one'::jsonb #>> '{joined,people}') || ' ' || (:'dry_one'::jsonb #>> '{joined,person_days}') || ' ' || (:'dry_one'::jsonb #>> '{joined,first_day}') || ' ' || (:'dry_one'::jsonb #>> '{joined,last_day}') || ' ' || (:'dry_one'::jsonb #>> '{joined,jobs}'),
  'change 3 8 ' || jn.d(-10) || ' ' || jn.d(-4) || ' 2');
SELECT jn.same('the day both give Dana is named, with the kind that stays', (:'dry_one'::jsonb -> 'shared_days')::text, jsonb_build_array(jsonb_build_object('name', 'Dana', 'day', jn.d(-8), 'kept', 'site', 'dropped', 'road'))::text);
SELECT jn.same('no line, the billing the first trip said, and not ended', (:'dry_one'::jsonb ->> 'line') || ' ' || (:'dry_one'::jsonb ->> 'billing') || ' ' || (:'dry_one'::jsonb ->> 'ended'), 'none extra false');
RESET ROLE;
SELECT jn.same('the dry run wrote nothing', jn.kept() || ' ' || jn.people('00000000-0000-0000-0000-0000007960e1') || ' / ' || jn.people('00000000-0000-0000-0000-0000007960e2'), '3 Dana:3,Luis:2 / DANA:3,Walt Outside:1');

-- 2 · What it refuses, in words.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.refused('a join with a trip that is not the next one', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e3')$q$, 'That is not the next trip on this site any more.');
SELECT jn.refused('a join the wrong way round', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e2', '00000000-0000-0000-0000-0000007960e1')$q$, 'That is not the next trip on this site any more.');
SELECT jn.refused('a join with a trip on another site', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e3', '00000000-0000-0000-0000-0000007960f1')$q$, 'That is not the next trip on this site any more.');
SELECT jn.refused('a join of a trip with itself', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e1')$q$, 'not with itself');
SELECT jn.refused('a join of a trip that is not there', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960ef', '00000000-0000-0000-0000-0000007960e2')$q$, 'That trip is not here any more.');
SELECT jn.refused('a join with a next trip that is not there', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960ef')$q$, 'The next trip is not here any more.');
SELECT jn.refused('a join with no next trip named', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', NULL)$q$, 'Name the trip and the trip that went out next.');
RESET ROLE;
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a3');
SET LOCAL ROLE authenticated;
SELECT jn.refused('a crew lead joining trips', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e2')$q$, 'Trips are joined by the office or a leader.');
SELECT jn.refused('a crew lead asking for the line''s step', $q$SELECT public.trip_join_line('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e2', true)$q$, 'Trips are joined by the office or a leader.');
RESET ROLE;
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a4');
SET LOCAL ROLE authenticated;
SELECT jn.refused('a training account joining trips', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e2')$q$, '');
SELECT jn.refused('a training account asking for the line''s move', $q$SELECT public.trip_join_line('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e2', true)$q$, 'Training mode is read-only.');
RESET ROLE;
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.refused('the line''s step for a pair that is not a trip and its next', $q$SELECT public.trip_join_line('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e3', true)$q$, 'That is not the next trip on this site any more.');
RESET ROLE;
SELECT jn.same('every refusal left both trips whole', jn.kept() || ' ' || jn.people('00000000-0000-0000-0000-0000007960e1') || ' / ' || jn.people('00000000-0000-0000-0000-0000007960e2'), '3 Dana:3,Luis:2 / DANA:3,Walt Outside:1');

-- 3 · The join.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT public.trip_join('00000000-0000-0000-0000-0000007960e1', '00000000-0000-0000-0000-0000007960e2') AS join_one \gset
RESET ROLE;
SELECT jn.same('the join says what it did, the number kept and the number that went', (:'join_one'::jsonb ->> 'did') || ' ' || (:'join_one'::jsonb ->> 'trip_number') || ' ' || (:'join_one'::jsonb ->> 'gone_trip_number') || ' ' || (:'join_one'::jsonb ->> 'gone_trip_id'), 'join 1 2 00000000-0000-0000-0000-0000007960e2');
SELECT jn.same('the trip keeps its id and its number, with everyone and the first day to the last', (SELECT trip_number::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007960e1') || ' ' || jn.people('00000000-0000-0000-0000-0000007960e1') || ' ' || jn.span('00000000-0000-0000-0000-0000007960e1'),
  '1 Dana:5,Luis:2,Walt Outside:1 ' || jn.d(-10) || ' to ' || jn.d(-4));
SELECT jn.same('Dana is one person, and the day both gave her keeps this trip''s kind', (SELECT tp.days::text FROM public.trip_people tp WHERE tp.trip_id = '00000000-0000-0000-0000-0000007960e1' AND tp.person_name = 'Dana'),
  jsonb_build_object(jn.d(-10), 'road', jn.d(-9), 'site', jn.d(-8), 'site', jn.d(-5), 'site', jn.d(-4), 'road')::text);
SELECT jn.same('its own words stay, and the empty ones are the next trip''s', jn.words('00000000-0000-0000-0000-0000007960e1'), 'Reset the riser|them|Walt, the super|by phone|Passed.|extra|app');
SELECT jn.same('it names both jobs', (SELECT string_agg(job_id::text, ',' ORDER BY job_id) FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000007960e1'), '00000000-0000-0000-0000-0000007960b1,00000000-0000-0000-0000-0000007960b2');
SELECT jn.same('the next trip is gone with its people and its jobs', (SELECT count(*)::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007960e2') || ' ' || (SELECT count(*)::text FROM public.trip_people WHERE trip_id = '00000000-0000-0000-0000-0000007960e2') || ' ' || (SELECT count(*)::text FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000007960e2'), '0 0 0');
SELECT jn.same('it is kept as deleted, marked with the trip it was joined into', (SELECT (a.row_data #>> '{joined_into,trip_id}') || ' ' || (a.row_data #>> '{joined_into,trip_number}') || ' ' || (a.row_data ->> 'trip_number') FROM public.deleted_records_archive a WHERE a.table_name = 'trips' AND a.record_id = '00000000-0000-0000-0000-0000007960e2' AND a.restored_at IS NULL),
  '00000000-0000-0000-0000-0000007960e1 1 2');
SELECT jn.same('the joined trip is now the one before the third', COALESCE(public.trip_next_id('00000000-0000-0000-0000-0000007960e1')::text, 'none'), '00000000-0000-0000-0000-0000007960e3');

-- A trip somebody deletes carries no such mark, and the site's deleted trips say which is which.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007960e3';
SELECT public.trip_deleted_list('00000000-0000-0000-0000-0000007960d1') AS gone \gset
RESET ROLE;
SELECT jn.same('the office reads two deleted trips on the site', jsonb_array_length(:'gone'::jsonb)::text, '2');
SELECT jn.same('the one that was joined away names the trip that holds its days', (SELECT (i #>> '{joined_into,trip_id}') || ' ' || (i #>> '{joined_into,trip_number}') FROM jsonb_array_elements(:'gone'::jsonb) AS i WHERE i #>> '{trip,id}' = '00000000-0000-0000-0000-0000007960e2'), '00000000-0000-0000-0000-0000007960e1 1');
SELECT jn.same('the one somebody deleted names none', (SELECT jsonb_typeof(COALESCE(i -> 'joined_into', 'null'::jsonb)) FROM jsonb_array_elements(:'gone'::jsonb) AS i WHERE i #>> '{trip,id}' = '00000000-0000-0000-0000-0000007960e3'), 'null');
SELECT jn.same('a capture outside a join carries no mark', (SELECT (a.row_data ? 'joined_into')::text FROM public.deleted_records_archive a WHERE a.table_name = 'trips' AND a.record_id = '00000000-0000-0000-0000-0000007960e3' AND a.restored_at IS NULL), 'false');

-- 4 · A split joined back is the trip as it was, all but the second number. The number that went is not given again.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a2');
SET LOCAL ROLE authenticated;
SELECT jn.same('a trip that will be split is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e4', jsonb_build_array(
  jsonb_build_object('name', 'Dana', 'days', jsonb_build_object(jn.d(-40), 'road', jn.d(-39), 'site', jn.d(-35), 'site', jn.d(-34), 'road')),
  jsonb_build_object('name', 'Luis', 'days', jsonb_build_object(jn.d(-39), 'site'))))) AS r), 'added');
RESET ROLE;
SELECT (SELECT jsonb_agg(jsonb_build_object('name', tp.person_name, 'days', tp.days) ORDER BY tp.person_name) FROM public.trip_people tp WHERE tp.trip_id = '00000000-0000-0000-0000-0000007960e4') AS people_before \gset
SELECT jn.words('00000000-0000-0000-0000-0000007960e4') AS words_before \gset
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a2');
SET LOCAL ROLE authenticated;
SELECT public.trip_split('00000000-0000-0000-0000-0000007960e4', jn.day(-35)) AS split_four \gset
SELECT public.trip_join('00000000-0000-0000-0000-0000007960e4', (:'split_four'::jsonb ->> 'new_trip_id')::uuid) AS join_four \gset
RESET ROLE;
SELECT jn.same('a master joins the halves, and the trip keeps the number it had', (:'split_four'::jsonb ->> 'trip_number') || ' ' || (:'split_four'::jsonb ->> 'new_trip_number') || ' ' || (:'join_four'::jsonb ->> 'did') || ' ' || (:'join_four'::jsonb ->> 'trip_number') || ' ' || (:'join_four'::jsonb ->> 'gone_trip_number'), '4 5 join 4 5');
SELECT jn.same('everyone and every day as before the split', (SELECT jsonb_agg(jsonb_build_object('name', tp.person_name, 'days', tp.days) ORDER BY tp.person_name)::text FROM public.trip_people tp WHERE tp.trip_id = '00000000-0000-0000-0000-0000007960e4'), :'people_before'::jsonb::text);
SELECT jn.same('its words as before the split', jn.words('00000000-0000-0000-0000-0000007960e4'), :'words_before');
SELECT jn.same('the split ended the first part, and the join opens it as the second part was', (SELECT (ended_at IS NULL)::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007960e4'), 'true');
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.same('the site''s next trip takes a new number, never one that went', (SELECT r->>'trip_number' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e5', jn.dana(-32))) AS r), '6');

-- 5 · The phone's ended stamp is the next trip's.
SELECT jn.same('a trip before an ended one is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e6', jn.dana(-30))) AS r), 'added');
SELECT jn.same('the ended one is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e7', jn.dana(-29))) AS r), 'added');
RESET ROLE;
UPDATE public.trips SET ended_at = '2026-01-02 03:04:05+00' WHERE id = '00000000-0000-0000-0000-0000007960e7';
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.same('the dry run says the joined trip would be ended', (SELECT r ->> 'ended' FROM public.trip_join('00000000-0000-0000-0000-0000007960e6', '00000000-0000-0000-0000-0000007960e7', true) AS r), 'true');
SELECT jn.same('the join is made', (SELECT r ->> 'did' FROM public.trip_join('00000000-0000-0000-0000-0000007960e6', '00000000-0000-0000-0000-0000007960e7') AS r), 'join');
RESET ROLE;
SELECT jn.same('the joined trip carries the stamp the next trip had', (SELECT to_char(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007960e6'), '2026-01-02 03:04:05');

-- 6 · A line only the next trip holds is tied to the joined trip. Pat is a primary: the trips office, and no reader
--     of a job's lines, so the line's step stands behind the lines table's own policies.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.same('a trip with no billing said is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e8', jn.dana(-27), jsonb_build_object('billing', NULL))) AS r), 'added');
SELECT jn.same('the trip after it, an Extra one, is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960e9', jn.dana(-26))) AS r), 'added');
RESET ROLE;
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, count, sequence_order, line_unit_price, line_kind) VALUES
  ('00000000-0000-0000-0000-0000007960c1', '00000000-0000-0000-0000-0000007960b1', 'Trip line', 1, 0, 1800, 'work');
UPDATE public.jobs_ledger_fixtures SET trip_id = '00000000-0000-0000-0000-0000007960e9' WHERE id = '00000000-0000-0000-0000-0000007960c1';
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a5');
SET LOCAL ROLE authenticated;
SELECT jn.same('the dry run says the line would move, and moves nothing', (SELECT r ->> 'line' FROM public.trip_join('00000000-0000-0000-0000-0000007960e8', '00000000-0000-0000-0000-0000007960e9', true) AS r), 'moves');
RESET ROLE;
SELECT jn.same('the line is still the next trip''s', (SELECT trip_id::text FROM public.jobs_ledger_fixtures WHERE id = '00000000-0000-0000-0000-0000007960c1'), '00000000-0000-0000-0000-0000007960e9');
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a5');
SET LOCAL ROLE authenticated;
SELECT public.trip_join('00000000-0000-0000-0000-0000007960e8', '00000000-0000-0000-0000-0000007960e9') AS join_line \gset
RESET ROLE;
SELECT jn.same('a primary joins them, and the reply says the line moved', (:'join_line'::jsonb ->> 'did') || ' ' || (:'join_line'::jsonb ->> 'line') || ' ' || (:'join_line'::jsonb ->> 'billing'), 'join moves extra');
SELECT jn.same('the line is tied to the joined trip, its price as it was', (SELECT trip_id::text || ' ' || line_unit_price::numeric(12,0)::text FROM public.jobs_ledger_fixtures WHERE id = '00000000-0000-0000-0000-0000007960c1'), '00000000-0000-0000-0000-0000007960e8 1800');
SELECT jn.same('the joined trip takes the billing the next trip said', jn.words('00000000-0000-0000-0000-0000007960e8'), 'Reset the riser|them|Walt, the super|by phone|Passed.|extra|app');
SELECT jn.same('the trip that went held no line when it went', (SELECT (a.row_data ? 'held_line_id')::text || ' ' || (a.row_data #>> '{joined_into,trip_id}') FROM public.deleted_records_archive a WHERE a.table_name = 'trips' AND a.record_id = '00000000-0000-0000-0000-0000007960e9' AND a.restored_at IS NULL), 'false 00000000-0000-0000-0000-0000007960e8');

-- 7 · Both on a bill: refused. With one line taken off its trip, the line that is left stays where it is.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.same('a trip on a bill is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960ea', jn.dana(-24))) AS r), 'added');
SELECT jn.same('and the next, on a bill too', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960eb', jn.dana(-23))) AS r), 'added');
RESET ROLE;
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, count, sequence_order, line_unit_price, line_kind) VALUES
  ('00000000-0000-0000-0000-0000007960c2', '00000000-0000-0000-0000-0000007960b1', 'First trip line', 1, 1, 900, 'work'),
  ('00000000-0000-0000-0000-0000007960c3', '00000000-0000-0000-0000-0000007960b1', 'Second trip line', 1, 2, 700, 'work');
UPDATE public.jobs_ledger_fixtures SET trip_id = '00000000-0000-0000-0000-0000007960ea' WHERE id = '00000000-0000-0000-0000-0000007960c2';
UPDATE public.jobs_ledger_fixtures SET trip_id = '00000000-0000-0000-0000-0000007960eb' WHERE id = '00000000-0000-0000-0000-0000007960c3';
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.refused('a join of two trips that are each on a bill', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960ea', '00000000-0000-0000-0000-0000007960eb')$q$, 'Both trips are on a bill');
SELECT jn.refused('the dry run of it', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960ea', '00000000-0000-0000-0000-0000007960eb', true)$q$, 'Both trips are on a bill');
RESET ROLE;
SELECT jn.same('both lines are where they were', (SELECT string_agg(trip_id::text, ',' ORDER BY sequence_order) FROM public.jobs_ledger_fixtures WHERE id IN ('00000000-0000-0000-0000-0000007960c2', '00000000-0000-0000-0000-0000007960c3')), '00000000-0000-0000-0000-0000007960ea,00000000-0000-0000-0000-0000007960eb');
UPDATE public.jobs_ledger_fixtures SET trip_id = NULL WHERE id = '00000000-0000-0000-0000-0000007960c3';
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.same('with one line taken off, the dry run says the other stays', (SELECT r ->> 'line' FROM public.trip_join('00000000-0000-0000-0000-0000007960ea', '00000000-0000-0000-0000-0000007960eb', true) AS r), 'stays');
SELECT jn.same('and the join is made', (SELECT (r ->> 'did') || ' ' || (r ->> 'line') FROM public.trip_join('00000000-0000-0000-0000-0000007960ea', '00000000-0000-0000-0000-0000007960eb') AS r), 'join stays');
RESET ROLE;
SELECT jn.same('the line the trip held is still its own', (SELECT trip_id::text FROM public.jobs_ledger_fixtures WHERE id = '00000000-0000-0000-0000-0000007960c2'), '00000000-0000-0000-0000-0000007960ea');

-- 8 · Two different billings wait for Change.
SELECT jn.as_user('00000000-0000-0000-0000-0000007960a1');
SET LOCAL ROLE authenticated;
SELECT jn.same('an Extra trip is saved', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960ec', jn.dana(-21))) AS r), 'added');
SELECT jn.same('and the next, marked Ours', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960ed', jn.dana(-20), jsonb_build_object('billing', 'ours'))) AS r), 'added');
SELECT jn.refused('a join of an Extra trip with one marked Ours', $q$SELECT public.trip_join('00000000-0000-0000-0000-0000007960ec', '00000000-0000-0000-0000-0000007960ed')$q$, 'two different billings: Extra and Ours. Make them match with Change, then join.');
SELECT jn.same('Change makes them match', (SELECT r->>'did' FROM public.trip_save(jn.trip('00000000-0000-0000-0000-0000007960ed', jn.dana(-20))) AS r), 'changed');
SELECT jn.same('and then they join', (SELECT r ->> 'did' FROM public.trip_join('00000000-0000-0000-0000-0000007960ec', '00000000-0000-0000-0000-0000007960ed') AS r), 'join');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'trips join PASSED'; END $$;
ROLLBACK;
