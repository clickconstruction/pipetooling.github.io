-- A joined trip stays joined (migration *_trip_joined_stays_gone): a trip that trip_join joined into another is not
-- made again under its own id. A screen that still held it from before the join sends the trip's own save (Put back
-- on an old fold, Change then Save, the Undo of a delete), and the save is refused in words that name both trips and
-- the way back. The site, the line and the counter stay as the join left them, and Deleted trips still says it was
-- joined. The dev's restore of its bundle is refused the same way. A trip somebody deleted still goes back with its
-- number. Split in two still takes the join back, the halves join again, and the half that went is refused in turn.
-- With the joined trip itself deleted, the words say to put it back first. A trip made before numbers is named as the
-- fold names it. A mark the guard cannot read lets the save through. Days are counted from the bed's own today.
-- Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on the first failed
-- assertion; ends with "trips joined back PASSED". See scripts/pgtest-trips.sh. Never against prod. Every name here is
-- made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is in the office. Marcus is a master. Devon is the dev.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000008127a1', 'dana@tripjoinedback.test'),
  ('00000000-0000-0000-0000-0000008127a2', 'marcus@tripjoinedback.test'),
  ('00000000-0000-0000-0000-0000008127a7', 'devon@tripjoinedback.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000008127a1', 'dana@tripjoinedback.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000008127a2', 'marcus@tripjoinedback.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000008127a7', 'devon@tripjoinedback.test', 'Devon Dev', 'dev', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA jb;
CREATE FUNCTION jb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Refused with these words, and with the code a refusal in words carries.
CREATE FUNCTION jb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM want OR SQLSTATE <> '22023' THEN RAISE EXCEPTION E'% was refused another way.\n--- got ---\n% %\n--- want ---\n22023 %', label, SQLSTATE, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION jb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A day counted from the bed's today: d(-5) is five days ago.
CREATE FUNCTION jb.d(n integer) RETURNS text LANGUAGE sql STABLE AS $$ SELECT (public.app_today() + n)::text $$;
CREATE FUNCTION jb.day(n integer) RETURNS date LANGUAGE sql STABLE AS $$ SELECT public.app_today() + n $$;
-- An Extra trip on Heron Point with its work on the lodge job, with the people given.
CREATE FUNCTION jb.trip(p_id uuid, p_people jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('id', p_id, 'development_id', '00000000-0000-0000-0000-0000008127d1', 'purpose', 'Reset the riser',
    'billing', 'extra', 'people', p_people, 'job_ids', jsonb_build_array('00000000-0000-0000-0000-0000008127b1'))
$$;
-- The record a screen holds of a trip as it reads it now, number and all, which is what its save sends. Read as postgres.
CREATE FUNCTION jb.held(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT jsonb_build_object('id', t.id, 'trip_number', t.trip_number, 'development_id', t.development_id, 'purpose', t.purpose, 'billing', t.billing,
    'people', (SELECT jsonb_agg(jsonb_build_object('name', tp.person_name, 'days', tp.days) ORDER BY tp.person_name) FROM public.trip_people tp WHERE tp.trip_id = t.id),
    'job_ids', (SELECT COALESCE(jsonb_agg(tj.job_id ORDER BY tj.job_id), '[]'::jsonb) FROM public.trip_jobs tj WHERE tj.trip_id = t.id))::text
  FROM public.trips t WHERE t.id = p_trip
$$;
-- A trip's people, each with a count of days, read as postgres.
CREATE FUNCTION jb.people(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(tp.person_name || ':' || (SELECT count(*) FROM jsonb_object_keys(tp.days))::text, ',' ORDER BY tp.person_name), 'nobody')
  FROM public.trip_people tp WHERE tp.trip_id = p_trip
$$;
-- The site's trips by number, and the last number its counter handed out, read as postgres.
CREATE FUNCTION jb.site() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE((SELECT string_agg('Trip ' || t.trip_number, ',' ORDER BY t.trip_number) FROM public.trips t WHERE t.development_id = '00000000-0000-0000-0000-0000008127d1'), 'no trip')
    || ' · last number ' || COALESCE((SELECT last_number::text FROM public.trip_number_counters WHERE development_id = '00000000-0000-0000-0000-0000008127d1'), 'none')
$$;
-- What Deleted trips says of a trip: the number of the trip it was joined into, or deleted. Read as the office.
CREATE FUNCTION jb.gone(p_trip uuid) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE((SELECT CASE WHEN jsonb_typeof(i -> 'joined_into') = 'object' THEN 'joined into Trip ' || (i #>> '{joined_into,trip_number}') ELSE 'deleted' END
    FROM jsonb_array_elements(public.trip_deleted_list('00000000-0000-0000-0000-0000008127d1')) AS i WHERE i #>> '{trip,id}' = p_trip::text), 'not listed')
$$;
GRANT USAGE ON SCHEMA jb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jb TO authenticated, anon;

INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000008127d1', '00000000-0000-0000-0000-0000008127a2', 'Heron Point');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000008127f9', 'Trip Joined Back Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000008127b1', '00000000-0000-0000-0000-0000008127a2', '00000000-0000-0000-0000-0000008127f9', 'Heron Point Lodge', '00000000-0000-0000-0000-0000008127d1');

-- 0 · Nobody calls the guard, and it stands before the number is taken.
SELECT jb.same('the guard is a trigger nobody calls', has_function_privilege('authenticated', 'public.trips_refuse_joined_back()', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.trips_refuse_joined_back()', 'EXECUTE')::text, 'false false');
SELECT jb.same('it runs before each trip is made, and before the trip takes its number',
  (SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger WHERE tgrelid = 'public.trips'::regclass AND NOT tgisinternal AND tgname IN ('trips_refuse_joined_back', 'trips_take_number')) || ' '
  || (SELECT (pg_get_triggerdef(oid) LIKE '%BEFORE INSERT ON public.trips FOR EACH ROW%')::text FROM pg_trigger WHERE tgrelid = 'public.trips'::regclass AND tgname = 'trips_refuse_joined_back'),
  'trips_refuse_joined_back,trips_take_number true');

-- 1 · Trip 1 and Trip 2 on Heron Point. Trip 2 is on a bill as an $1,800 line. Dana's screen reads Trip 2, and is left open.
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
SELECT jb.same('Trip 1 is saved', (SELECT (r->>'did') || ' ' || (r->>'trip_number') FROM public.trip_save(jb.trip('00000000-0000-0000-0000-0000008127e1', jsonb_build_array(
  jsonb_build_object('name', 'Dana', 'days', jsonb_build_object(jb.d(-10), 'road', jb.d(-9), 'site', jb.d(-8), 'site')),
  jsonb_build_object('name', 'Luis', 'days', jsonb_build_object(jb.d(-9), 'site', jb.d(-8), 'site'))))) AS r), 'added 1');
SELECT jb.same('Trip 2 is saved', (SELECT (r->>'did') || ' ' || (r->>'trip_number') FROM public.trip_save(jb.trip('00000000-0000-0000-0000-0000008127e2', jsonb_build_array(
  jsonb_build_object('name', 'Dana', 'days', jsonb_build_object(jb.d(-6), 'site', jb.d(-5), 'road'))))) AS r), 'added 2');
RESET ROLE;
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, count, sequence_order, line_unit_price, line_kind) VALUES
  ('00000000-0000-0000-0000-0000008127c1', '00000000-0000-0000-0000-0000008127b1', 'Trip 2, 1 person', 1, 0, 1800, 'work');
UPDATE public.jobs_ledger_fixtures SET trip_id = '00000000-0000-0000-0000-0000008127e2' WHERE id = '00000000-0000-0000-0000-0000008127c1';
SELECT jb.held('00000000-0000-0000-0000-0000008127e2') AS stale_two \gset

-- 2 · Marcus, on his own screen, joins Trip 1 with Trip 2. Trip 1 holds every day and the line.
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a2');
SET LOCAL ROLE authenticated;
SELECT jb.same('Marcus joins them, and the line moves to Trip 1', (SELECT (r->>'did') || ' ' || (r->>'line') || ' ' || (r->>'gone_trip_number') FROM public.trip_join('00000000-0000-0000-0000-0000008127e1', '00000000-0000-0000-0000-0000008127e2') AS r), 'join moves 2');
RESET ROLE;

-- 3 · Dana's screen saves Trip 2: Put back on a fold read before the join, the Undo of a delete, or Change then Save.
--     Each sends the trip's own save under its own id. It is refused, in words that name both trips and the way back.
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
SELECT jb.refused('the save of a trip that was joined away, from a screen read before the join', format('SELECT public.trip_save(%L::jsonb)', :'stale_two'),
  'Trip 2 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.');
SELECT jb.refused('the same trip changed on a sheet opened before the join', format('SELECT public.trip_save(%L::jsonb || %L::jsonb)', :'stale_two', '{"purpose": "Changed on an old sheet"}'),
  'Trip 2 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.');
SELECT jb.same('the dry run writes nothing, so it does not hear the refusal: the save itself does', (SELECT r->>'would' FROM public.trip_save(:'stale_two'::jsonb, true) AS r), 'add');
SELECT jb.same('Deleted trips still says Trip 2 was joined', jb.gone('00000000-0000-0000-0000-0000008127e2'), 'joined into Trip 1');
RESET ROLE;
SELECT jb.same('the site is as the join left it, and the counter did not move', jb.site() || ' · ' || jb.people('00000000-0000-0000-0000-0000008127e1'), 'Trip 1 · last number 2 · Dana:5,Luis:2');
SELECT jb.same('the line is still Trip 1''s, once', (SELECT string_agg(trip_id::text, ',') FROM public.jobs_ledger_fixtures WHERE job_id = '00000000-0000-0000-0000-0000008127b1'), '00000000-0000-0000-0000-0000008127e1');
SELECT jb.same('the mark is not settled away', (SELECT count(*)::text FROM public.deleted_records_archive WHERE table_name = 'trips' AND record_id = '00000000-0000-0000-0000-0000008127e2' AND restored_at IS NULL AND row_data ? 'joined_into'), '1');

-- 4 · The dev's restore of its bundle is refused the same way, and so is its dry run.
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a7');
SET LOCAL ROLE authenticated;
SELECT jb.same('the dev''s restore of the trip that was joined away', (SELECT (r->>'ok') || ' ' || (r->>'code') || ' ' || (r->>'error') FROM public.restore_deleted_records('00000000-0000-0000-0000-0000008127e2', false) AS r),
  'false 22023 Trip 2 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.');
SELECT jb.same('and its dry run', (SELECT (r->>'ok') || ' ' || (r->>'code') FROM public.restore_deleted_records('00000000-0000-0000-0000-0000008127e2', true) AS r), 'false 22023');
RESET ROLE;
SELECT jb.same('the site is still as the join left it', jb.site(), 'Trip 1 · last number 2');

-- 5 · A trip somebody deleted carries no mark. It goes back with its number, as before.
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
SELECT jb.same('Trip 3 is saved', (SELECT (r->>'did') || ' ' || (r->>'trip_number') FROM public.trip_save(jb.trip('00000000-0000-0000-0000-0000008127e3', jsonb_build_array(jsonb_build_object('name', 'Dana', 'days', jsonb_build_object(jb.d(-2), 'site'))))) AS r), 'added 3');
RESET ROLE;
SELECT jb.held('00000000-0000-0000-0000-0000008127e3') AS held_three \gset
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000008127e3';
SELECT jb.same('Deleted trips says Trip 3 was deleted', jb.gone('00000000-0000-0000-0000-0000008127e3'), 'deleted');
SELECT jb.same('and Put back saves it again with its number', (SELECT (r->>'did') || ' ' || (r->>'trip_number') FROM public.trip_save(:'held_three'::jsonb) AS r), 'added 3');
RESET ROLE;
SELECT jb.same('the site holds Trip 1 and Trip 3', jb.site(), 'Trip 1,Trip 3 · last number 3');

-- 6 · Split in two still takes the join back, and the halves join again. Trip 2 stays refused all the while, and the
--     half that went in the second join is refused in turn.
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a2');
SET LOCAL ROLE authenticated;
SELECT public.trip_split('00000000-0000-0000-0000-0000008127e1', jb.day(-6)) AS split_one \gset
RESET ROLE;
SELECT jb.same('Split in two on Trip 1 makes Trip 4 from the days Trip 2 had', (:'split_one'::jsonb ->> 'did') || ' ' || (:'split_one'::jsonb ->> 'new_trip_number') || ' ' || jb.people((:'split_one'::jsonb ->> 'new_trip_id')::uuid), 'split 4 Dana:2');
SELECT jb.held((:'split_one'::jsonb ->> 'new_trip_id')::uuid) AS held_four \gset
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
SELECT jb.refused('Trip 2 is still refused after the split, which made a new trip', format('SELECT public.trip_save(%L::jsonb)', :'stale_two'),
  'Trip 2 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.');
SELECT jb.same('the halves join again', (SELECT (r->>'did') || ' ' || (r->>'gone_trip_number') FROM public.trip_join('00000000-0000-0000-0000-0000008127e1', public.trip_next_id('00000000-0000-0000-0000-0000008127e1')) AS r), 'join 4');
SELECT jb.refused('and Trip 4, joined away in its turn, is refused too', format('SELECT public.trip_save(%L::jsonb)', :'held_four'),
  'Trip 4 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.');
RESET ROLE;
SELECT jb.same('Trip 1 holds every day again', jb.site() || ' · ' || jb.people('00000000-0000-0000-0000-0000008127e1'), 'Trip 1,Trip 3 · last number 4 · Dana:5,Luis:2');

-- 7 · The joined trip itself deleted: Trip 2 is still refused, and the words say to put Trip 1 back first. Put back
--     on Trip 1 is a plain one, and then the words are the first ones again.
SELECT jb.held('00000000-0000-0000-0000-0000008127e1') AS held_one \gset
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000008127e1';
SELECT jb.refused('Trip 2, with Trip 1 deleted', format('SELECT public.trip_save(%L::jsonb)', :'stale_two'),
  'Trip 2 was joined into Trip 1, which holds its days. Put Trip 1 back, then press Split in two on it.');
SELECT jb.same('Trip 1 goes back with its number', (SELECT (r->>'did') || ' ' || (r->>'trip_number') FROM public.trip_save(:'held_one'::jsonb) AS r), 'added 1');
SELECT jb.refused('Trip 2, with Trip 1 back', format('SELECT public.trip_save(%L::jsonb)', :'stale_two'),
  'Trip 2 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.');
RESET ROLE;

-- 8 · A trip made before numbers is named as the Deleted trips fold names it.
UPDATE public.deleted_records_archive SET row_data = (row_data - 'trip_number') #- '{joined_into,trip_number}'
  WHERE table_name = 'trips' AND record_id = '00000000-0000-0000-0000-0000008127e2' AND restored_at IS NULL;
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
SELECT jb.refused('a trip with no number, joined into a trip with none', format('SELECT public.trip_save(%L::jsonb)', :'stale_two'),
  'That trip was joined into another trip, which holds its days. To take the join back, press Split in two on that trip.');
RESET ROLE;

-- 9 · A mark the guard cannot read lets the save through, as every save went before the guard.
UPDATE public.deleted_records_archive SET row_data = jsonb_set(row_data, '{joined_into,trip_id}', '"not a trip id"')
  WHERE table_name = 'trips' AND record_id = '00000000-0000-0000-0000-0000008127e2' AND restored_at IS NULL;
SELECT jb.as_user('00000000-0000-0000-0000-0000008127a1');
SET LOCAL ROLE authenticated;
SELECT jb.same('a mark it cannot read lets the save through', (SELECT r->>'did' FROM public.trip_save(:'stale_two'::jsonb) AS r), 'added');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'trips joined back PASSED'; END $$;
ROLLBACK;
