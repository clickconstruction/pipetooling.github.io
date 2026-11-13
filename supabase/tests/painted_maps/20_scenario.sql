-- Paint a map (v2.7202, punch list #345 PR 1, migration *_painted_maps): the three tables, their gate and the photo
-- bucket. Who reads a map on a job, on a development and on nothing; who may add a stroke or a place and who may
-- change one; the checks that hold a line whole; the fences. Fixtures are written as postgres; the tries run as each
-- account under RLS; everything rolls back. Raises on the first failed assertion; ends with "painted_maps PASSED".
-- See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of every job here. Hal is a helper on job A's crew. Hank is a helper on no crew.
-- Tess is a dev in training, Tom a dev that is a twin, Ava a helper on job A's crew who has left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000345a001', 'dee@paintedmaps.test'),
  ('00000000-0000-0000-0000-00000345a002', 'hal@paintedmaps.test'),
  ('00000000-0000-0000-0000-00000345a003', 'hank@paintedmaps.test'),
  ('00000000-0000-0000-0000-00000345a004', 'tess@paintedmaps.test'),
  ('00000000-0000-0000-0000-00000345a005', 'tom@paintedmaps.test'),
  ('00000000-0000-0000-0000-00000345a006', 'ava@paintedmaps.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00000345a001', 'dee@paintedmaps.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00000345a002', 'hal@paintedmaps.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00000345a003', 'hank@paintedmaps.test', 'Hank Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00000345a004', 'tess@paintedmaps.test', 'Tess Training', 'dev', true, false, NULL),
  ('00000000-0000-0000-0000-00000345a005', 'tom@paintedmaps.test', 'Tom Twin', 'dev', false, true, NULL),
  ('00000000-0000-0000-0000-00000345a006', 'ava@paintedmaps.test', 'Ava Away', 'helpers', false, false, '2026-11-04 15:00+00')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- A development with two lots, and a third job outside it. Hal and Ava are on lot A's crew.
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-00000345f001', 'Painted maps bed work', 'PM');
INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-00000345d001', '00000000-0000-0000-0000-00000345a001', 'Painted Maps Bed Ridge'),
  ('00000000-0000-0000-0000-00000345d002', '00000000-0000-0000-0000-00000345a001', 'Painted Maps Bed Hollow');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, development_id) VALUES
  ('00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345a001', '00000000-0000-0000-0000-00000345f001', 'Bed lot A', '3451', '00000000-0000-0000-0000-00000345d001'),
  ('00000000-0000-0000-0000-00000345b002', '00000000-0000-0000-0000-00000345a001', '00000000-0000-0000-0000-00000345f001', 'Bed lot B', '3452', '00000000-0000-0000-0000-00000345d001'),
  ('00000000-0000-0000-0000-00000345b003', '00000000-0000-0000-0000-00000345a001', '00000000-0000-0000-0000-00000345f001', 'Bed job C', '3453', NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345a002'),
  ('00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345a006');

CREATE SCHEMA pm;
GRANT USAGE ON SCHEMA pm TO authenticated;
CREATE FUNCTION pm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION pm.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (42501 is a row-level violation).
CREATE FUNCTION pm.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- A write that must not land, whatever refuses it (a policy's 42501, a check's 23514, a training trigger's own code).
CREATE FUNCTION pm.refused(p_sql text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN t.r LIKE 'rows %' AND t.r <> 'rows 0' THEN 'landed' ELSE 'refused' END FROM (SELECT pm.try(p_sql) AS r) t
$$;
-- The maps the caller reads, by name.
CREATE FUNCTION pm.maps() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(name, ', ' ORDER BY name), 'none') FROM public.painted_maps
$$;
-- A row read past RLS, to tell "gone" from "hidden".
CREATE FUNCTION pm.past(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pm TO authenticated;

-- The structure.
SELECT pm.same('each table carries the archived seal and the twin fences', (
  SELECT string_agg(tablename || ' ' || n, ', ' ORDER BY tablename) FROM (
    SELECT tablename, count(*)::text AS n FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('painted_maps', 'painted_map_lines', 'painted_map_places')
      AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
    GROUP BY tablename
  ) t
), 'painted_map_lines 4, painted_map_places 4, painted_maps 4');
SELECT pm.same('row security is on for all three', (
  SELECT string_agg(relname, ', ' ORDER BY relname) FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relname IN ('painted_maps', 'painted_map_lines', 'painted_map_places') AND relrowsecurity
), 'painted_map_lines, painted_map_places, painted_maps');
SELECT pm.same('the crew question is closed to anon', (
  has_function_privilege('authenticated', 'public.painted_map_on_development_team(uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.painted_map_on_development_team(uuid)', 'EXECUTE')::text
), 'true false');
SELECT pm.same('the photo bucket is private', (SELECT public::text FROM storage.buckets WHERE id = 'painted-map-photos'), 'false');

SET LOCAL ROLE authenticated;

-- Dee paints the way in for lot A, a map for the whole development, a map for job C and a map for nothing yet.
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a001');
SELECT pm.same('Dee makes a map on lot A', pm.try($q$
  INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES ('00000000-0000-0000-0000-00000345c001', 'A way in', '00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');
SELECT pm.same('Dee makes a map on the development', pm.try($q$
  INSERT INTO public.painted_maps (id, name, development_id, created_by) VALUES ('00000000-0000-0000-0000-00000345c002', 'Ridge truck route', '00000000-0000-0000-0000-00000345d001', '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');
SELECT pm.same('Dee makes a map on job C', pm.try($q$
  INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES ('00000000-0000-0000-0000-00000345c003', 'C side door', '00000000-0000-0000-0000-00000345b003', '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');
SELECT pm.same('Dee makes a map on the other development', pm.try($q$
  INSERT INTO public.painted_maps (id, name, development_id, created_by) VALUES ('00000000-0000-0000-0000-00000345c004', 'Hollow gate', '00000000-0000-0000-0000-00000345d002', '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');
SELECT pm.same('a map cannot have two homes', pm.try($q$
  INSERT INTO public.painted_maps (name, job_id, development_id, created_by) VALUES ('Two homes', '00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345d001', '00000000-0000-0000-0000-00000345a001')
$q$), '23514');
SELECT pm.same('a map needs a name', pm.try($q$
  INSERT INTO public.painted_maps (name, job_id, created_by) VALUES ('   ', '00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345a001')
$q$), '23514');
SELECT pm.same('Dee draws a line on lot A''s map', pm.try($q$
  INSERT INTO public.painted_map_lines (id, map_id, how, points, length_m, margin_m, made_by)
  VALUES ('00000000-0000-0000-0000-00000345e001', '00000000-0000-0000-0000-00000345c001', 'drawn', '[[29.5,-98.2],[29.501,-98.201]]', 147.5, 2.1, '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');
SELECT pm.same('Dee sets a place on lot A''s map', pm.try($q$
  INSERT INTO public.painted_map_places (id, map_id, name, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00000345e101', '00000000-0000-0000-0000-00000345c001', 'Truck gate', 29.5, -98.2, '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');

-- The checks that hold a line whole.
SELECT pm.same('a line of one point is refused', pm.try($q$
  INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by) VALUES ('00000000-0000-0000-0000-00000345c001', 'drawn', '[[29.5,-98.2]]', 0, '00000000-0000-0000-0000-00000345a001')
$q$), '23514');
SELECT pm.same('points that are not a list are refused, not an error of their own', pm.try($q$
  INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by) VALUES ('00000000-0000-0000-0000-00000345c001', 'drawn', '{"a":1}', 0, '00000000-0000-0000-0000-00000345a001')
$q$), '23514');
SELECT pm.same('a way of making a line outside the three is refused', pm.try($q$
  INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by) VALUES ('00000000-0000-0000-0000-00000345c001', 'flown', '[[29.5,-98.2],[29.501,-98.201]]', 1, '00000000-0000-0000-0000-00000345a001')
$q$), '23514');
SELECT pm.same('a measured length without how it was measured is refused', pm.try($q$
  UPDATE public.painted_map_lines SET measured_ft = 462 WHERE id = '00000000-0000-0000-0000-00000345e001'
$q$), '23514');
SELECT pm.same('a measured length with its way lands', pm.try($q$
  UPDATE public.painted_map_lines SET measured_ft = 462, measured_how = 'wheel' WHERE id = '00000000-0000-0000-0000-00000345e001'
$q$), 'rows 1');
SELECT pm.same('a place off the globe is refused', pm.try($q$
  INSERT INTO public.painted_map_places (map_id, name, lat, lng, set_by) VALUES ('00000000-0000-0000-0000-00000345c001', 'Nowhere', 95, -98.2, '00000000-0000-0000-0000-00000345a001')
$q$), '23514');

-- Hal is on lot A's crew: he reads lot A's map and the development's, and nothing else.
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a002');
SELECT pm.same('Hal reads lot A''s map and its development''s', pm.maps(), 'A way in, Ridge truck route');
SELECT pm.same('Hal reads the line and the place', (SELECT count(*) FROM public.painted_map_lines)::text || ' ' || (SELECT count(*) FROM public.painted_map_places)::text, '1 1');
SELECT pm.same('Hal adds a stroke of his own to lot A''s map', pm.try($q$
  INSERT INTO public.painted_map_lines (id, map_id, how, points, poor_parts, length_m, margin_m, made_by)
  VALUES ('00000000-0000-0000-0000-00000345e002', '00000000-0000-0000-0000-00000345c001', 'walked', '[[29.5,-98.2],[29.5005,-98.2004],[29.501,-98.201]]', '[[1,2]]', 80, 12, '00000000-0000-0000-0000-00000345a002')
$q$), 'rows 1');
SELECT pm.same('Hal adds a place of his own', pm.try($q$
  INSERT INTO public.painted_map_places (id, map_id, name, lat, lng, accuracy_m, set_by)
  VALUES ('00000000-0000-0000-0000-00000345e102', '00000000-0000-0000-0000-00000345c001', 'Meter', 29.5004, -98.2003, 6, '00000000-0000-0000-0000-00000345a002')
$q$), 'rows 1');
SELECT pm.same('Hal cannot sign a stroke with Dee''s name', pm.try($q$
  INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by)
  VALUES ('00000000-0000-0000-0000-00000345c001', 'walked', '[[29.5,-98.2],[29.501,-98.201]]', 80, '00000000-0000-0000-0000-00000345a001')
$q$), '42501');
SELECT pm.same('Hal fixes his own stroke', pm.try($q$UPDATE public.painted_map_lines SET fixed_by_hand = true WHERE id = '00000000-0000-0000-0000-00000345e002'$q$), 'rows 1');
SELECT pm.same('Hal cannot change Dee''s stroke', pm.try($q$UPDATE public.painted_map_lines SET label = 'mine now' WHERE id = '00000000-0000-0000-0000-00000345e001'$q$), 'rows 0');
SELECT pm.same('Hal cannot remove Dee''s place', pm.try($q$DELETE FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00000345e101'$q$), 'rows 0');
SELECT pm.same('Hal cannot rename Dee''s map', pm.try($q$UPDATE public.painted_maps SET name = 'Hal was here' WHERE id = '00000000-0000-0000-0000-00000345c001'$q$), 'rows 0');
SELECT pm.same('Hal cannot throw Dee''s map away', pm.try($q$DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00000345c001'$q$), 'rows 0');
SELECT pm.same('Hal paints a map of his own on lot A', pm.try($q$
  INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES ('00000000-0000-0000-0000-00000345c005', 'Hal back way', '00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345a002')
$q$), 'rows 1');
SELECT pm.same('Hal cannot paint on job C, which he is not on', pm.try($q$
  INSERT INTO public.painted_maps (name, job_id, created_by) VALUES ('Not his', '00000000-0000-0000-0000-00000345b003', '00000000-0000-0000-0000-00000345a002')
$q$), '42501');
SELECT pm.same('Hal cannot add to job C''s map', pm.try($q$
  INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by)
  VALUES ('00000000-0000-0000-0000-00000345c003', 'drawn', '[[29.5,-98.2],[29.501,-98.201]]', 80, '00000000-0000-0000-0000-00000345a002')
$q$), '42501');
SELECT pm.same('Hal cannot move his map onto job C', pm.refused($q$
  UPDATE public.painted_maps SET job_id = '00000000-0000-0000-0000-00000345b003' WHERE id = '00000000-0000-0000-0000-00000345c005'
$q$), 'refused');
SELECT pm.same('Hal paints a map tied to nothing yet', pm.try($q$
  INSERT INTO public.painted_maps (id, name, created_by) VALUES ('00000000-0000-0000-0000-00000345c006', 'Hal loose map', '00000000-0000-0000-0000-00000345a002')
$q$), 'rows 1');
SELECT pm.same('Hal reads his own too', pm.maps(), 'A way in, Hal back way, Hal loose map, Ridge truck route');

-- Hank is on no crew: he reads nothing and adds nothing.
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a003');
SELECT pm.same('Hank reads no map', pm.maps(), 'none');
SELECT pm.same('Hank reads no line and no place', (SELECT count(*) FROM public.painted_map_lines)::text || ' ' || (SELECT count(*) FROM public.painted_map_places)::text, '0 0');
SELECT pm.same('Hank cannot add a stroke to lot A''s map', pm.try($q$
  INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by)
  VALUES ('00000000-0000-0000-0000-00000345c001', 'drawn', '[[29.5,-98.2],[29.501,-98.201]]', 80, '00000000-0000-0000-0000-00000345a003')
$q$), '42501');
SELECT pm.same('Hank cannot paint on lot A', pm.try($q$
  INSERT INTO public.painted_maps (name, job_id, created_by) VALUES ('Not his', '00000000-0000-0000-0000-00000345b001', '00000000-0000-0000-0000-00000345a003')
$q$), '42501');
SELECT pm.same('Hank cannot paint on the development', pm.try($q$
  INSERT INTO public.painted_maps (name, development_id, created_by) VALUES ('Not his', '00000000-0000-0000-0000-00000345d001', '00000000-0000-0000-0000-00000345a003')
$q$), '42501');

-- The office reads every map, a loose one too, and may change another person's stroke.
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a001');
SELECT pm.same('Dee reads all six', pm.maps(), 'A way in, C side door, Hal back way, Hal loose map, Hollow gate, Ridge truck route');
SELECT pm.same('Dee types a measured length onto Hal''s stroke', pm.try($q$
  UPDATE public.painted_map_lines SET measured_ft = 255.5, measured_how = 'tape' WHERE id = '00000000-0000-0000-0000-00000345e002'
$q$), 'rows 1');
SELECT pm.same('Dee moves Hal''s loose map onto job C', pm.try($q$
  UPDATE public.painted_maps SET job_id = '00000000-0000-0000-0000-00000345b003' WHERE id = '00000000-0000-0000-0000-00000345c006'
$q$), 'rows 1');

-- The photo bucket follows the map.
SELECT pm.same('Dee puts a photo under lot A''s map', pm.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('painted-map-photos', '00000000-0000-0000-0000-00000345c001/gate.jpg', '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');
SELECT pm.same('a path that names no map is refused', pm.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('painted-map-photos', 'not-a-map/gate.jpg', '00000000-0000-0000-0000-00000345a001')
$q$), '42501');
SELECT pm.same('Dee puts a photo under job C''s map', pm.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('painted-map-photos', '00000000-0000-0000-0000-00000345c003/door.jpg', '00000000-0000-0000-0000-00000345a001')
$q$), 'rows 1');
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a002');
SELECT pm.same('Hal reads lot A''s photo and not job C''s', (SELECT string_agg(name, ', ' ORDER BY name) FROM storage.objects WHERE bucket_id = 'painted-map-photos'), '00000000-0000-0000-0000-00000345c001/gate.jpg');
SELECT pm.same('Hal adds a photo to lot A''s map', pm.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('painted-map-photos', '00000000-0000-0000-0000-00000345c001/meter.jpg', '00000000-0000-0000-0000-00000345a002')
$q$), 'rows 1');
SELECT pm.same('Hal cannot add a photo to job C''s map', pm.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('painted-map-photos', '00000000-0000-0000-0000-00000345c003/x.jpg', '00000000-0000-0000-0000-00000345a002')
$q$), '42501');
SELECT pm.same('Hal removes his own photo and not Dee''s', pm.try($q$DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos'$q$), 'rows 1');
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a003');
SELECT pm.same('Hank reads no photo', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'painted-map-photos')::text, '0');

-- Training, a twin and someone who left.
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a004');
SELECT pm.same('an account in training reads the maps', (SELECT (count(*) > 0)::text FROM public.painted_maps), 'true');
SELECT pm.same('an account in training paints nothing', pm.refused($q$
  INSERT INTO public.painted_maps (name, created_by) VALUES ('Training map', '00000000-0000-0000-0000-00000345a004')
$q$), 'refused');
SELECT pm.same('an account in training adds no stroke', pm.refused($q$
  INSERT INTO public.painted_map_lines (map_id, how, points, length_m, made_by)
  VALUES ('00000000-0000-0000-0000-00000345c001', 'drawn', '[[29.5,-98.2],[29.501,-98.201]]', 80, '00000000-0000-0000-0000-00000345a004')
$q$), 'refused');
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a005');
SELECT pm.same('a twin paints nothing', pm.refused($q$
  INSERT INTO public.painted_maps (name, created_by) VALUES ('Twin map', '00000000-0000-0000-0000-00000345a005')
$q$), 'refused');
SELECT pm.same('a twin sets no place', pm.refused($q$
  INSERT INTO public.painted_map_places (map_id, name, lat, lng, set_by) VALUES ('00000000-0000-0000-0000-00000345c001', 'Twin dot', 29.5, -98.2, '00000000-0000-0000-0000-00000345a005')
$q$), 'refused');
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a006');
SELECT pm.same('Ava, who left, reads no map though she was on the crew', pm.maps(), 'none');
SELECT pm.same('Ava reads no line and no place', (SELECT count(*) FROM public.painted_map_lines)::text || ' ' || (SELECT count(*) FROM public.painted_map_places)::text, '0 0');

-- A job that goes leaves its map with its maker and the office; a map that goes takes its lines and places.
RESET ROLE;
UPDATE public.painted_maps SET job_id = NULL WHERE id = '00000000-0000-0000-0000-00000345c001';
SET LOCAL ROLE authenticated;
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a002');
SELECT pm.same('with its job gone, lot A''s map is no longer Hal''s to read', pm.maps(), 'Hal back way, Ridge truck route');
SELECT pm.sign_in('00000000-0000-0000-0000-00000345a001');
SELECT pm.same('Dee still reads it', (SELECT count(*)::text FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00000345c001'), '1');
SELECT pm.same('Dee throws it away', pm.try($q$DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00000345c001'$q$), 'rows 1');
SELECT pm.same('its lines and places went with it', pm.past($q$
  SELECT (SELECT count(*) FROM public.painted_map_lines WHERE map_id = '00000000-0000-0000-0000-00000345c001')::text || ' ' ||
         (SELECT count(*) FROM public.painted_map_places WHERE map_id = '00000000-0000-0000-0000-00000345c001')::text
$q$), '0 0');
RESET ROLE;

SELECT 'painted_maps PASSED';
ROLLBACK;
