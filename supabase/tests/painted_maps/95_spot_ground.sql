-- A photo keeps its spot on the job, the ground for the later steps (v2.8195, punch list #413, migration
-- *_photo_spot_ground): a job photo and a report photo keep the phone's reading; a place counts the times someone
-- other than its setter opened it, may point at a line and may hold more photos; and a job's own list of places is
-- read from every job at the same customer address, and from no other. Fixtures are written as postgres; the tries
-- run as each account under RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "photo_spot_ground PASSED". See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev. Four helpers, each on one job's crew: Mia on the sewer job at the house, Hal on next year's drain
-- call at the same house, Ned on a job at another address, and Ola on a job with no customer address at all.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00004135a001', 'dee@spotground.test'),
  ('00000000-0000-0000-0000-00004135a002', 'mia@spotground.test'),
  ('00000000-0000-0000-0000-00004135a003', 'hal@spotground.test'),
  ('00000000-0000-0000-0000-00004135a004', 'ned@spotground.test'),
  ('00000000-0000-0000-0000-00004135a005', 'ola@spotground.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00004135a001', 'dee@spotground.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00004135a002', 'mia@spotground.test', 'Mia Maker', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00004135a003', 'hal@spotground.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00004135a004', 'ned@spotground.test', 'Ned Neighbor', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00004135a005', 'ola@spotground.test', 'Ola Other', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-00004135f001', 'Spot ground bed work', 'PG');
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-00004135d101', 'Spot ground bed customer', '00000000-0000-0000-0000-00004135a001');
INSERT INTO public.customer_addresses (id, customer_id, address, property_kind) VALUES
  ('00000000-0000-0000-0000-00004135d001', '00000000-0000-0000-0000-00004135d101', '418 Made Up Run', 'non_residential'),
  ('00000000-0000-0000-0000-00004135d002', '00000000-0000-0000-0000-00004135d101', '9 Made Up Road', 'non_residential');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, customer_address_id) VALUES
  ('00000000-0000-0000-0000-00004135b001', '00000000-0000-0000-0000-00004135a001', '00000000-0000-0000-0000-00004135f001', 'Sewer line at the house', '4135', '00000000-0000-0000-0000-00004135d001'),
  ('00000000-0000-0000-0000-00004135b002', '00000000-0000-0000-0000-00004135a001', '00000000-0000-0000-0000-00004135f001', 'Drain call at the house', '4136', '00000000-0000-0000-0000-00004135d001'),
  ('00000000-0000-0000-0000-00004135b003', '00000000-0000-0000-0000-00004135a001', '00000000-0000-0000-0000-00004135f001', 'A job down the road', '4137', '00000000-0000-0000-0000-00004135d002'),
  ('00000000-0000-0000-0000-00004135b004', '00000000-0000-0000-0000-00004135a001', '00000000-0000-0000-0000-00004135f001', 'A job with no address on file', '4138', NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00004135b001', '00000000-0000-0000-0000-00004135a002'),
  ('00000000-0000-0000-0000-00004135b002', '00000000-0000-0000-0000-00004135a003'),
  ('00000000-0000-0000-0000-00004135b003', '00000000-0000-0000-0000-00004135a004'),
  ('00000000-0000-0000-0000-00004135b004', '00000000-0000-0000-0000-00004135a005');
-- The sewer job has its list of places and a painted map of the way in. The job with no address has a list too.
INSERT INTO public.painted_maps (id, name, job_id, job_list, created_by, created_at) VALUES
  ('00000000-0000-0000-0000-00004135c001', 'Places on this job', '00000000-0000-0000-0000-00004135b001', true, '00000000-0000-0000-0000-00004135a002', '2026-11-21T15:00:00Z'),
  ('00000000-0000-0000-0000-00004135c002', 'The way in', '00000000-0000-0000-0000-00004135b001', false, '00000000-0000-0000-0000-00004135a002', '2026-11-21T15:05:00Z'),
  ('00000000-0000-0000-0000-00004135c003', 'Places on this job', '00000000-0000-0000-0000-00004135b004', true, '00000000-0000-0000-0000-00004135a005', '2026-11-21T15:10:00Z');
INSERT INTO public.painted_map_places (id, map_id, name, kind, lat, lng, set_by) VALUES
  ('00000000-0000-0000-0000-00004135e001', '00000000-0000-0000-0000-00004135c001', 'Cleanout', 'cleanout', 29.5, -98.2, '00000000-0000-0000-0000-00004135a002'),
  ('00000000-0000-0000-0000-00004135e002', '00000000-0000-0000-0000-00004135c002', 'Truck gate', 'gate', 29.5001, -98.2001, '00000000-0000-0000-0000-00004135a002'),
  ('00000000-0000-0000-0000-00004135e003', '00000000-0000-0000-0000-00004135c003', 'Meter', 'meter', 29.6, -98.3, '00000000-0000-0000-0000-00004135a005');
INSERT INTO public.painted_map_lines (id, map_id, label, how, points, length_m, made_by) VALUES
  ('00000000-0000-0000-0000-00004135e101', '00000000-0000-0000-0000-00004135c002', 'Sewer run', 'walked', '[[29.5,-98.2],[29.5002,-98.2002]]'::jsonb, 30, '00000000-0000-0000-0000-00004135a002');
INSERT INTO public.job_photo_notes (id, job_id, by_user_id, by_name) VALUES
  ('00000000-0000-0000-0000-00004135e201', '00000000-0000-0000-0000-00004135b001', '00000000-0000-0000-0000-00004135a002', 'Mia Maker');
INSERT INTO public.report_photos (id, job_id, by_user_id, by_name) VALUES
  ('00000000-0000-0000-0000-00004135e301', '00000000-0000-0000-0000-00004135b001', '00000000-0000-0000-0000-00004135a002', 'Mia Maker');

CREATE SCHEMA psg;
GRANT USAGE ON SCHEMA psg TO authenticated, anon;
CREATE FUNCTION psg.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION psg.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (23514 is a check, 42501 a refusal).
CREATE FUNCTION psg.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA psg TO authenticated, anon;

-- The structure.
SELECT psg.same('a job photo and a report photo each gain a point and a margin, all of which may be empty', (
  SELECT string_agg(table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable, ', ' ORDER BY table_name, column_name)
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('job_photo_notes', 'report_photos') AND column_name LIKE 'taken\_%' AND column_name <> 'taken_at'
), 'job_photo_notes.taken_accuracy_m integer YES, job_photo_notes.taken_lat double precision YES, job_photo_notes.taken_lng double precision YES, report_photos.taken_accuracy_m integer YES, report_photos.taken_lat double precision YES, report_photos.taken_lng double precision YES');
SELECT psg.same('a place gains its count of opens, its line and its other photos', (
  SELECT string_agg(column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, 'no default'), ', ' ORDER BY column_name)
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'painted_map_places' AND column_name IN ('opened_count', 'last_opened_at', 'line_id', 'more_photos')
), 'last_opened_at timestamp with time zone YES no default, line_id uuid YES no default, more_photos jsonb NO ''[]''::jsonb, opened_count integer NO 0');
SELECT psg.same('a place from before has no opens, no line and no other photo', (
  SELECT opened_count || ' ' || coalesce(line_id::text, 'no line') || ' ' || more_photos::text FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004135e001'
), '0 no line []');
SELECT psg.same('one more way to read a painted map, for a signed-in account and for reading alone', (
  SELECT cmd || ' ' || permissive || ' ' || roles::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'painted_maps' AND policyname = 'painted_maps_select_at_my_address'
), 'SELECT PERMISSIVE {authenticated}');
SELECT psg.same('nobody signed out may run the new functions', (
  SELECT string_agg(p.proname || ' ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text, ', ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('note_painted_place_opened', 'painted_place_opened_bump', 'painted_list_address_jobs', 'painted_address_jobs_of', 'painted_map_at_my_address', 'job_address_place_lists')
), 'job_address_place_lists false, note_painted_place_opened false, painted_address_jobs_of false, painted_list_address_jobs false, painted_map_at_my_address false, painted_place_opened_bump false');

-- A photo's point: both or neither, on the globe, and a margin only with a point. Written as postgres: the checks
-- are the table's, whoever writes.
SELECT psg.same('a job photo keeps a point and a margin', psg.try($q$
  UPDATE public.job_photo_notes SET taken_lat = 29.5, taken_lng = -98.2, taken_accuracy_m = 6 WHERE id = '00000000-0000-0000-0000-00004135e201'
$q$), 'rows 1');
SELECT psg.same('a point with no margin is kept', psg.try($q$
  UPDATE public.job_photo_notes SET taken_accuracy_m = NULL WHERE id = '00000000-0000-0000-0000-00004135e201'
$q$), 'rows 1');
SELECT psg.same('half a point is refused', psg.try($q$
  UPDATE public.job_photo_notes SET taken_lng = NULL WHERE id = '00000000-0000-0000-0000-00004135e201'
$q$), '23514');
SELECT psg.same('a point off the globe is refused', psg.try($q$
  UPDATE public.job_photo_notes SET taken_lat = 91 WHERE id = '00000000-0000-0000-0000-00004135e201'
$q$), '23514');
SELECT psg.same('a report photo keeps a point', psg.try($q$
  UPDATE public.report_photos SET taken_lat = 29.5, taken_lng = -98.2, taken_accuracy_m = 12 WHERE id = '00000000-0000-0000-0000-00004135e301'
$q$), 'rows 1');
SELECT psg.same('a margin with no point is refused', psg.try($q$
  UPDATE public.report_photos SET taken_lat = NULL, taken_lng = NULL WHERE id = '00000000-0000-0000-0000-00004135e301'
$q$), '23514');
SELECT psg.same('a margin below zero is refused', psg.try($q$
  UPDATE public.report_photos SET taken_accuracy_m = -1 WHERE id = '00000000-0000-0000-0000-00004135e301'
$q$), '23514');
SELECT psg.same('a report photo with no point is still a photo', psg.try($q$
  UPDATE public.report_photos SET taken_lat = NULL, taken_lng = NULL, taken_accuracy_m = NULL WHERE id = '00000000-0000-0000-0000-00004135e301'
$q$), 'rows 1');

-- Step 4. Hal is on next year's job at the same house.
SET LOCAL ROLE authenticated;
SELECT psg.sign_in('00000000-0000-0000-0000-00004135a003');
SELECT psg.same('Hal cannot read the sewer job itself', (
  SELECT count(*)::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-00004135b001'
), '0');
SELECT psg.same('Hal reads the list of places the sewer job kept at this house', (
  SELECT string_agg(name, ', ' ORDER BY name) FROM public.painted_maps WHERE job_id = '00000000-0000-0000-0000-00004135b001'
), 'Places on this job');
SELECT psg.same('and its places', (
  SELECT string_agg(name, ', ' ORDER BY name) FROM public.painted_map_places WHERE map_id = '00000000-0000-0000-0000-00004135c001'
), 'Cleanout');
SELECT psg.same('but not the painted map of the way in, which is that job''s own', (
  SELECT count(*)::text FROM public.painted_map_places WHERE map_id = '00000000-0000-0000-0000-00004135c002'
), '0');
SELECT psg.same('nor its line', (
  SELECT count(*)::text FROM public.painted_map_lines WHERE map_id = '00000000-0000-0000-0000-00004135c002'
), '0');
SELECT psg.same('Hal''s job window is told of that list, with the job that kept it and when', (
  SELECT string_agg(map_id::text || ' ' || job_id::text || ' ' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), ', ') FROM public.job_address_place_lists('00000000-0000-0000-0000-00004135b002')
), '00000000-0000-0000-0000-00004135c001 00000000-0000-0000-0000-00004135b001 2026-11-21');
SELECT psg.same('asking about a job Hal is not on answers nothing', (
  SELECT count(*)::text FROM public.job_address_place_lists('00000000-0000-0000-0000-00004135b001')
), '0');
SELECT psg.same('Hal does not read a list at no address', (
  SELECT count(*)::text FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00004135c003'
), '0');
-- A reader of a map may add to it, as on every painted map. Changing another's place stays the setter's.
SELECT psg.same('Hal cannot change Mia''s place', psg.try($q$
  UPDATE public.painted_map_places SET name = 'Mine now' WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), 'rows 0');
SELECT psg.same('Hal cannot rename or throw away the list', psg.try($q$
  UPDATE public.painted_maps SET name = 'Mine now' WHERE id = '00000000-0000-0000-0000-00004135c001'
$q$), 'rows 0');
SELECT psg.same('Hal may add a place to it, as any reader of a map may', psg.try($q$
  INSERT INTO public.painted_map_places (id, map_id, name, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00004135e004', '00000000-0000-0000-0000-00004135c001', 'Second cleanout', 29.5003, -98.2003, '00000000-0000-0000-0000-00004135a003')
$q$), 'rows 1');

-- Step 3b. Hal opens Mia's place. The count goes up by one. He cannot write the count himself.
SELECT public.note_painted_place_opened('00000000-0000-0000-0000-00004135e001');
SELECT psg.same('a reader''s open is counted', (
  SELECT opened_count || ' ' || (last_opened_at IS NOT NULL)::text FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004135e001'
), '1 true');
SELECT psg.same('the count is not Hal''s to write', psg.try($q$
  UPDATE public.painted_map_places SET opened_count = 99 WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), 'rows 0');
SELECT public.note_painted_place_opened('00000000-0000-0000-0000-00004135e004');
SELECT psg.same('Hal opening his own place counts nothing', (
  SELECT opened_count::text FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004135e004'
), '0');

-- Ned is at another address, and Ola on a job with no address.
SELECT psg.sign_in('00000000-0000-0000-0000-00004135a004');
SELECT psg.same('Ned, at another address, reads no list of the house', (
  SELECT count(*)::text FROM public.painted_maps WHERE id IN ('00000000-0000-0000-0000-00004135c001', '00000000-0000-0000-0000-00004135c003')
), '0');
SELECT psg.same('and is told of none for his own job', (
  SELECT count(*)::text FROM public.job_address_place_lists('00000000-0000-0000-0000-00004135b003')
), '0');
SELECT public.note_painted_place_opened('00000000-0000-0000-0000-00004135e001');
SELECT psg.sign_in('00000000-0000-0000-0000-00004135a005');
SELECT psg.same('Ola, on a job with no address, reads her own list and no other', (
  SELECT string_agg(id::text, ', ' ORDER BY id) FROM public.painted_maps WHERE job_list
), '00000000-0000-0000-0000-00004135c003');
SELECT psg.same('and is told of none: a job with no address shares nothing', (
  SELECT count(*)::text FROM public.job_address_place_lists('00000000-0000-0000-0000-00004135b004')
), '0');

-- Mia, who set the place.
SELECT psg.sign_in('00000000-0000-0000-0000-00004135a002');
SELECT psg.same('an open by someone who cannot read the place was not counted', (
  SELECT opened_count::text FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004135e001'
), '1');
SELECT public.note_painted_place_opened('00000000-0000-0000-0000-00004135e001');
SELECT psg.same('nor is the setter''s own', (
  SELECT opened_count::text FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004135e001'
), '1');
SELECT psg.same('Mia does not read the list of the job with no address', (
  SELECT count(*)::text FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00004135c003'
), '0');
SELECT psg.same('Mia is told of no list for her own job: the drain call kept none', (
  SELECT count(*)::text FROM public.job_address_place_lists('00000000-0000-0000-0000-00004135b001')
), '0');

-- Step 6. A place points at a line, and is left standing when the line goes.
SELECT psg.same('Mia ties her place to the line she walked', psg.try($q$
  UPDATE public.painted_map_places SET line_id = '00000000-0000-0000-0000-00004135e101' WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), 'rows 1');
SELECT psg.same('a line that does not exist is refused', psg.try($q$
  UPDATE public.painted_map_places SET line_id = '00000000-0000-0000-0000-0000413599ff' WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), '23503');

-- Step 7. More photos: a list, of twelve at most.
SELECT psg.same('Mia adds two more photos to her place', psg.try($q$
  UPDATE public.painted_map_places SET more_photos = '[{"path":"00000000-0000-0000-0000-00004135c001/open.jpg","words":"Open"},{"path":"00000000-0000-0000-0000-00004135c001/covered.jpg","words":"Covered"}]'::jsonb
  WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), 'rows 1');
SELECT psg.same('something that is not a list is refused', psg.try($q$
  UPDATE public.painted_map_places SET more_photos = '{"path":"x"}'::jsonb WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), '23514');
SELECT psg.same('thirteen photos are refused', psg.try($q$
  UPDATE public.painted_map_places SET more_photos = (SELECT jsonb_agg(jsonb_build_object('path', 'p' || g)) FROM generate_series(1, 13) g) WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), '23514');
SELECT psg.same('twelve are kept', psg.try($q$
  UPDATE public.painted_map_places SET more_photos = (SELECT jsonb_agg(jsonb_build_object('path', 'p' || g)) FROM generate_series(1, 12) g) WHERE id = '00000000-0000-0000-0000-00004135e001'
$q$), 'rows 1');
SELECT psg.same('Mia removes the line she walked', psg.try($q$
  DELETE FROM public.painted_map_lines WHERE id = '00000000-0000-0000-0000-00004135e101'
$q$), 'rows 1');
SELECT psg.same('and the place stands, with no line', (
  SELECT name || ' ' || coalesce(line_id::text, 'no line') FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004135e001'
), 'Cleanout no line');
RESET ROLE;

SELECT 'photo_spot_ground PASSED';
ROLLBACK;
