-- Paint a map, who opened a link (v2.7411, punch list #345, migration *_painted_map_link_visits): one row a device a
-- link, read by the office and the map's painter and by nobody else, written by nobody signed in. A point is whole or
-- not there. A visit goes with its link and with its map. Fixtures are written as postgres; the tries run as each
-- account under RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "painted_map_link_visits PASSED". See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of the job. Hal is a helper on its crew. Hank is a helper on no crew. Ava was on the
-- crew and has left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000345fa001', 'dee@paintedvisits.test'),
  ('00000000-0000-0000-0000-0000345fa002', 'hal@paintedvisits.test'),
  ('00000000-0000-0000-0000-0000345fa003', 'hank@paintedvisits.test'),
  ('00000000-0000-0000-0000-0000345fa006', 'ava@paintedvisits.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000345fa001', 'dee@paintedvisits.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000345fa002', 'hal@paintedvisits.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000345fa003', 'hank@paintedvisits.test', 'Hank Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000345fa006', 'ava@paintedvisits.test', 'Ava Away', 'helpers', false, false, '2026-11-04 15:00+00')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000345ff001', 'Painted visits bed work', 'PV');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000345fb001', '00000000-0000-0000-0000-0000345fa001', '00000000-0000-0000-0000-0000345ff001', 'Visits bed lot', '3460');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000345fb001', '00000000-0000-0000-0000-0000345fa002'),
  ('00000000-0000-0000-0000-0000345fb001', '00000000-0000-0000-0000-0000345fa006');
-- Dee painted the lot's map and the loose one. Hal painted one of his own on the lot: a helper who painted a map
-- reads who opened it, and reads nobody else's visitors, though he reads the lot's other map.
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-0000345fc001', 'Lot way in', '00000000-0000-0000-0000-0000345fb001', '00000000-0000-0000-0000-0000345fa001'),
  ('00000000-0000-0000-0000-0000345fc002', 'Loose map', NULL, '00000000-0000-0000-0000-0000345fa001'),
  ('00000000-0000-0000-0000-0000345fc003', 'Hal''s own map', '00000000-0000-0000-0000-0000345fb001', '00000000-0000-0000-0000-0000345fa002');
INSERT INTO public.painted_map_links (id, map_id, code_hash, made_by, expires_at) VALUES
  ('00000000-0000-0000-0000-0000345f1001', '00000000-0000-0000-0000-0000345fc001', repeat('a', 64), '00000000-0000-0000-0000-0000345fa001', now() + interval '90 days'),
  ('00000000-0000-0000-0000-0000345f1002', '00000000-0000-0000-0000-0000345fc002', repeat('b', 64), '00000000-0000-0000-0000-0000345fa001', now() + interval '90 days'),
  ('00000000-0000-0000-0000-0000345f1003', '00000000-0000-0000-0000-0000345fc003', repeat('c', 64), '00000000-0000-0000-0000-0000345fa002', now() + interval '90 days');

CREATE SCHEMA pmv;
GRANT USAGE ON SCHEMA pmv TO authenticated, service_role;
CREATE FUNCTION pmv.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pmv.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The claims the edge function's own client carries: the service role, and nobody signed in.
CREATE FUNCTION pmv.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
-- What a write does under the caller's rights: 'rows N', or the sqlstate it raised (42501 is a refusal).
CREATE FUNCTION pmv.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The visits the caller reads, by the name each reader gave.
CREATE FUNCTION pmv.visits() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(v.visitor_name, ', ' ORDER BY v.visitor_name), 'none') FROM public.painted_map_link_visits v
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmv TO authenticated, service_role;

-- The structure.
SELECT pmv.same('the table carries the archived seal and the twin fences', (
  SELECT count(*)::text FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'painted_map_link_visits'
    AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
), '4');
SELECT pmv.same('row security is on', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.painted_map_link_visits'::regclass), 'true');
SELECT pmv.same('anon holds no right on the table', (
  has_table_privilege('anon', 'public.painted_map_link_visits', 'SELECT')::text || ' ' ||
  has_table_privilege('anon', 'public.painted_map_link_visits', 'INSERT')::text
), 'false false');
SELECT pmv.same('a signed-in account may read and nothing more', (
  has_table_privilege('authenticated', 'public.painted_map_link_visits', 'SELECT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.painted_map_link_visits', 'INSERT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.painted_map_link_visits', 'UPDATE')::text || ' ' ||
  has_table_privilege('authenticated', 'public.painted_map_link_visits', 'DELETE')::text
), 'true false false false');

-- The function's door: the service role keeps a visit on each link.
SET LOCAL ROLE service_role;
SELECT pmv.as_service();
SELECT pmv.same('the function keeps a visit on the lot''s link', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (id, link_id, map_id, visitor_name, device_id, device_words, ip)
  VALUES ('00000000-0000-0000-0000-0000345f2001', '00000000-0000-0000-0000-0000345f1001', '00000000-0000-0000-0000-0000345fc001', 'Carla Customer', '11111111-1111-4111-8111-111111111111', 'iPhone · Safari', '203.0.113.7')
$q$), 'rows 1');
SELECT pmv.same('one on the loose map''s link', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (link_id, map_id, visitor_name, device_id)
  VALUES ('00000000-0000-0000-0000-0000345f1002', '00000000-0000-0000-0000-0000345fc002', 'Dan Driver', '22222222-2222-4222-8222-222222222222')
$q$), 'rows 1');
SELECT pmv.same('and one on the link to the map Hal painted', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (link_id, map_id, visitor_name, device_id)
  VALUES ('00000000-0000-0000-0000-0000345f1003', '00000000-0000-0000-0000-0000345fc003', 'Ines Inspector', '33333333-3333-4333-8333-333333333333')
$q$), 'rows 1');
SELECT pmv.same('the same device on the same link is one row', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (link_id, map_id, visitor_name, device_id)
  VALUES ('00000000-0000-0000-0000-0000345f1001', '00000000-0000-0000-0000-0000345fc001', 'Carla again', '11111111-1111-4111-8111-111111111111')
$q$), '23505');
SELECT pmv.same('a visit with no name is refused', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (link_id, map_id, visitor_name, device_id)
  VALUES ('00000000-0000-0000-0000-0000345f1001', '00000000-0000-0000-0000-0000345fc001', '   ', '44444444-4444-4444-8444-444444444444')
$q$), '23514');
SELECT pmv.same('a device id that is not one is refused', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (link_id, map_id, visitor_name, device_id)
  VALUES ('00000000-0000-0000-0000-0000345f1001', '00000000-0000-0000-0000-0000345fc001', 'Nobody', 'my phone')
$q$), '23514');
SELECT pmv.same('a visit on no link is refused', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (link_id, map_id, visitor_name, device_id)
  VALUES ('00000000-0000-0000-0000-0000345f10ff', '00000000-0000-0000-0000-0000345fc001', 'Nobody', '55555555-5555-4555-8555-555555555555')
$q$), '23503');
SELECT pmv.same('the function counts a second open', pmv.try($q$
  UPDATE public.painted_map_link_visits SET open_count = open_count + 1, last_opened_at = now() WHERE id = '00000000-0000-0000-0000-0000345f2001'
$q$), 'rows 1');
SELECT pmv.same('a point with no time is refused', pmv.try($q$
  UPDATE public.painted_map_link_visits SET first_lat = 30.35, first_lng = -97.75 WHERE id = '00000000-0000-0000-0000-0000345f2001'
$q$), '23514');
SELECT pmv.same('half a point is refused', pmv.try($q$
  UPDATE public.painted_map_link_visits SET first_lat = 30.35, first_located_at = now() WHERE id = '00000000-0000-0000-0000-0000345f2001'
$q$), '23514');
SELECT pmv.same('a point off the globe is refused', pmv.try($q$
  UPDATE public.painted_map_link_visits SET first_lat = 130, first_lng = -97.75, first_located_at = now() WHERE id = '00000000-0000-0000-0000-0000345f2001'
$q$), '23514');
SELECT pmv.same('the latest point is never there without the first', pmv.try($q$
  UPDATE public.painted_map_link_visits SET last_lat = 30.35, last_lng = -97.75, last_located_at = now() WHERE id = '00000000-0000-0000-0000-0000345f2001'
$q$), '23514');
SELECT pmv.same('the function keeps where the reader showed they were', pmv.try($q$
  UPDATE public.painted_map_link_visits
  SET first_lat = 30.35, first_lng = -97.75, first_accuracy_m = 12, first_located_at = now(),
      last_lat = 30.351, last_lng = -97.751, last_accuracy_m = 9, last_located_at = now()
  WHERE id = '00000000-0000-0000-0000-0000345f2001'
$q$), 'rows 1');
RESET ROLE;

-- Who reads a visit: the office and whoever painted the map. Not everyone who can open the map.
SET LOCAL ROLE authenticated;
SELECT pmv.sign_in('00000000-0000-0000-0000-0000345fa001');
SELECT pmv.same('a dev reads every visit', pmv.visits(), 'Carla Customer, Dan Driver, Ines Inspector');
SELECT pmv.sign_in('00000000-0000-0000-0000-0000345fa002');
SELECT pmv.same('the helper on the crew reads the lot''s map', (SELECT count(*)::text FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-0000345fc001'), '1');
SELECT pmv.same('and reads who opened the map he painted, and nobody else''s visitors', pmv.visits(), 'Ines Inspector');
SELECT pmv.same('he keeps no visit himself', pmv.try($q$
  INSERT INTO public.painted_map_link_visits (link_id, map_id, visitor_name, device_id)
  VALUES ('00000000-0000-0000-0000-0000345f1003', '00000000-0000-0000-0000-0000345fc003', 'Made up', '66666666-6666-4666-8666-666666666666')
$q$), '42501');
SELECT pmv.same('and changes none', pmv.try($q$ UPDATE public.painted_map_link_visits SET visitor_name = 'Changed' $q$), '42501');
SELECT pmv.same('and removes none', pmv.try($q$ DELETE FROM public.painted_map_link_visits $q$), '42501');
SELECT pmv.sign_in('00000000-0000-0000-0000-0000345fa003');
SELECT pmv.same('a helper on no crew reads no visit', pmv.visits(), 'none');
SELECT pmv.sign_in('00000000-0000-0000-0000-0000345fa006');
SELECT pmv.same('someone who left reads no visit', pmv.visits(), 'none');
-- The claims outlive the role: the removals below are a plain dev's, not the account that left.
SELECT pmv.sign_in('00000000-0000-0000-0000-0000345fa001');
RESET ROLE;

-- A visit goes with its link, and with its map.
SELECT pmv.same('a visit outlives the account of a signed-in reader', (
  SELECT string_agg(a.attname || ' ' || c.confdeltype::text, ', ' ORDER BY a.attname)
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.conrelid = 'public.painted_map_link_visits'::regclass AND c.contype = 'f'
), 'link_id c, map_id c, user_id n');
DELETE FROM public.painted_map_links WHERE id = '00000000-0000-0000-0000-0000345f1003';
SELECT pmv.same('a link that is removed takes its visits', (SELECT count(*)::text FROM public.painted_map_link_visits WHERE map_id = '00000000-0000-0000-0000-0000345fc003'), '0');
DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-0000345fc001';
SELECT pmv.same('a map thrown away takes its visits', (SELECT count(*)::text FROM public.painted_map_link_visits), '1');

SELECT 'painted_map_link_visits PASSED';
ROLLBACK;
