-- Paint a map, the photos of a map that is gone (v2.7454, punch list #345, migration *_painted_map_photos_after_the_map):
-- while a map stands its photos are read by whoever reads the map and removed by their uploader and the office, as
-- before. Once the map is thrown away, a file's uploader and the office may list and remove it, and nobody else
-- reads it. A map the caller cannot read is never taken for a map that is gone. Fixtures are written as postgres;
-- the tries run as each account under RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "painted_map_photos_after PASSED". See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of both jobs. Mia, Hal and Hank are helpers on the lot's crew: Mia painted the lot's
-- map, Hal added photos to it, Hank added nothing. None of the three is on the other job.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00003456a001', 'dee@paintedphotos.test'),
  ('00000000-0000-0000-0000-00003456a002', 'mia@paintedphotos.test'),
  ('00000000-0000-0000-0000-00003456a003', 'hal@paintedphotos.test'),
  ('00000000-0000-0000-0000-00003456a004', 'hank@paintedphotos.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00003456a001', 'dee@paintedphotos.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00003456a002', 'mia@paintedphotos.test', 'Mia Maker', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00003456a003', 'hal@paintedphotos.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00003456a004', 'hank@paintedphotos.test', 'Hank Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-00003456f001', 'Painted photos bed work', 'PP');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-00003456b001', '00000000-0000-0000-0000-00003456a001', '00000000-0000-0000-0000-00003456f001', 'Photos bed lot', '3461'),
  ('00000000-0000-0000-0000-00003456b002', '00000000-0000-0000-0000-00003456a001', '00000000-0000-0000-0000-00003456f001', 'Photos bed other job', '3462');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00003456b001', '00000000-0000-0000-0000-00003456a002'),
  ('00000000-0000-0000-0000-00003456b001', '00000000-0000-0000-0000-00003456a003'),
  ('00000000-0000-0000-0000-00003456b001', '00000000-0000-0000-0000-00003456a004');
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-00003456c001', 'Lot way in', '00000000-0000-0000-0000-00003456b001', '00000000-0000-0000-0000-00003456a002'),
  ('00000000-0000-0000-0000-00003456c002', 'Other job side door', '00000000-0000-0000-0000-00003456b002', '00000000-0000-0000-0000-00003456a001');
-- Three photos under the lot's map: Mia's gate, Hal's meter and Hal's shutoff. And one under the other job's map
-- with Hal's name on it, which no screen could make: it is here to show that a map Hal cannot read is not a map
-- that is gone.
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('painted-map-photos', '00000000-0000-0000-0000-00003456c001/gate.jpg', '00000000-0000-0000-0000-00003456a002'),
  ('painted-map-photos', '00000000-0000-0000-0000-00003456c001/meter.jpg', '00000000-0000-0000-0000-00003456a003'),
  ('painted-map-photos', '00000000-0000-0000-0000-00003456c001/shutoff.jpg', '00000000-0000-0000-0000-00003456a003'),
  ('painted-map-photos', '00000000-0000-0000-0000-00003456c002/door.jpg', '00000000-0000-0000-0000-00003456a003');

CREATE SCHEMA pmp;
GRANT USAGE ON SCHEMA pmp TO authenticated, anon;
CREATE FUNCTION pmp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION pmp.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The claims of a caller who is signed out.
CREATE FUNCTION pmp.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (42501 is a refusal).
CREATE FUNCTION pmp.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The bucket's files the caller reads, by the file's own name and the last four of its map: 'none' for no file, and
-- for a caller with no right on the table at all.
CREATE FUNCTION pmp.files() RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  SELECT coalesce(string_agg(right(split_part(o.name, '/', 1), 4) || '/' || split_part(o.name, '/', 2), ', ' ORDER BY o.name), 'none') INTO v
  FROM storage.objects o WHERE o.bucket_id = 'painted-map-photos';
  RETURN v;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN 'none';
END $$;
-- A write that must not land, whatever refuses it: no row, or a refusal.
CREATE FUNCTION pmp.refused(p_sql text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN t.r LIKE 'rows %' AND t.r <> 'rows 0' THEN 'landed' ELSE 'refused' END FROM (SELECT pmp.try(p_sql) AS r) t
$$;
-- A row read past RLS, to tell "gone" from "hidden".
CREATE FUNCTION pmp.past(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmp TO authenticated, anon;

-- The structure.
SELECT pmp.same('the question is closed to anon and answers past row security with a pinned path', (
  SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ' ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
    || ' ' || p.prosecdef::text || ' ' || p.proconfig::text || ' ' || pg_get_function_result(p.oid)
  FROM pg_proc p WHERE p.oid = 'public.painted_map_stands(text)'::regprocedure
), 'true false true {search_path=public} boolean');
SELECT pmp.same('the bucket''s three policies are for signed-in callers only', (
  SELECT string_agg(policyname || ' ' || cmd || ' ' || roles::text, ', ' ORDER BY policyname) FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'painted\_map\_photos\_files\_%'
), 'painted_map_photos_files_delete DELETE {authenticated}, painted_map_photos_files_insert INSERT {authenticated}, painted_map_photos_files_select SELECT {authenticated}');

-- While the map stands, nothing has changed.
SET LOCAL ROLE authenticated;
SELECT pmp.sign_in('00000000-0000-0000-0000-00003456a004');
SELECT pmp.same('Hank, on the crew, reads the lot''s three photos', pmp.files(), 'c001/gate.jpg, c001/meter.jpg, c001/shutoff.jpg');
SELECT pmp.same('Hank removes none of them', pmp.try($q$DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos'$q$), 'rows 0');
SELECT pmp.sign_in('00000000-0000-0000-0000-00003456a003');
SELECT pmp.same('Hal reads the lot''s three and not the other job''s, his name on it or not', pmp.files(), 'c001/gate.jpg, c001/meter.jpg, c001/shutoff.jpg');
SELECT pmp.same('Hal cannot read the other job''s map, and the question still says it stands', (
  (SELECT count(*) FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00003456c002')::text || ' ' ||
  public.painted_map_stands('00000000-0000-0000-0000-00003456c002')::text
), '0 true');
SELECT pmp.same('a map Hal cannot read is not a map that is gone: he removes nothing under it', pmp.try($q$
  DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos' AND name = '00000000-0000-0000-0000-00003456c002/door.jpg'
$q$), 'rows 0');
SELECT pmp.same('the question says no for an id that is no map and for a folder that is no id', (
  public.painted_map_stands('00000000-0000-0000-0000-00003456cfff')::text || ' ' || public.painted_map_stands('not-a-map')::text
), 'false false');
SET LOCAL ROLE anon;
SELECT pmp.sign_out();
SELECT pmp.same('signed out, nobody reads a photo', pmp.files(), 'none');
SELECT pmp.same('signed out, nobody removes one', pmp.refused($q$DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos'$q$), 'refused');

-- Mia throws her map away.
SET LOCAL ROLE authenticated;
SELECT pmp.sign_in('00000000-0000-0000-0000-00003456a002');
SELECT pmp.same('Mia throws the lot''s map away', pmp.try($q$DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00003456c001'$q$), 'rows 1');
SELECT pmp.same('the question now says the map is gone', public.painted_map_stands('00000000-0000-0000-0000-00003456c001')::text, 'false');

-- Another signed-in person, who read the photos a moment ago, has nothing.
SELECT pmp.sign_in('00000000-0000-0000-0000-00003456a004');
SELECT pmp.same('Hank reads no photo of the map that is gone', pmp.files(), 'none');
SELECT pmp.same('Hank removes none', pmp.try($q$DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos'$q$), 'rows 0');

-- The maker takes her own upload, and no teammate's.
SELECT pmp.sign_in('00000000-0000-0000-0000-00003456a002');
SELECT pmp.same('Mia reads her own photo and not Hal''s two', pmp.files(), 'c001/gate.jpg');
SELECT pmp.same('Mia removes her own, and only it', pmp.try($q$DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos'$q$), 'rows 1');
SELECT pmp.same('Hal''s two are still in the bucket', pmp.past($q$
  SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'painted-map-photos' AND name LIKE '00000000-0000-0000-0000-00003456c001/%'
$q$), '2');
SELECT pmp.same('nobody adds a file under a map that is gone', pmp.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('painted-map-photos', '00000000-0000-0000-0000-00003456c001/late.jpg', '00000000-0000-0000-0000-00003456a002')
$q$), '42501');

-- The uploader takes his own.
SELECT pmp.sign_in('00000000-0000-0000-0000-00003456a003');
SELECT pmp.same('Hal reads his two, and still not the one under the map that stands', pmp.files(), 'c001/meter.jpg, c001/shutoff.jpg');
SELECT pmp.same('Hal removes his meter', pmp.try($q$
  DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos' AND name = '00000000-0000-0000-0000-00003456c001/meter.jpg'
$q$), 'rows 1');

-- The office takes what is left behind.
SELECT pmp.sign_in('00000000-0000-0000-0000-00003456a001');
SELECT pmp.same('Dee reads the photo left behind, and the other job''s', pmp.files(), 'c001/shutoff.jpg, c002/door.jpg');
SELECT pmp.same('Dee removes the photo left behind, another person''s upload', pmp.try($q$
  DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos' AND name LIKE '00000000-0000-0000-0000-00003456c001/%'
$q$), 'rows 1');

-- Signed out, still nothing.
SET LOCAL ROLE anon;
SELECT pmp.sign_out();
SELECT pmp.same('signed out, nobody reads a photo once the map is gone', pmp.files(), 'none');
SELECT pmp.same('signed out, nobody removes one', pmp.refused($q$DELETE FROM storage.objects WHERE bucket_id = 'painted-map-photos'$q$), 'refused');
RESET ROLE;

SELECT pmp.same('only the photo of the map that stands is left', (
  SELECT string_agg(right(split_part(name, '/', 1), 4) || '/' || split_part(name, '/', 2), ', ' ORDER BY name) FROM storage.objects WHERE bucket_id = 'painted-map-photos'
), 'c002/door.jpg');

SELECT 'painted_map_photos_after PASSED';
ROLLBACK;
