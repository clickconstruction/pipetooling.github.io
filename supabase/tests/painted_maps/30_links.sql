-- Paint a map, the link (v2.7223, punch list #345 PR 4, migration *_painted_map_links): one row a link, read by
-- whoever reads the map and written by nobody signed in. The code is kept only as its hash; a link goes with its map.
-- Fixtures are written as postgres; the tries run as each account under RLS; everything rolls back. Raises on the
-- first failed assertion; ends with "painted_map_links PASSED". See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of the job. Hal is a helper on its crew. Hank is a helper on no crew. Ava was on the
-- crew and has left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000345ea001', 'dee@paintedlinks.test'),
  ('00000000-0000-0000-0000-0000345ea002', 'hal@paintedlinks.test'),
  ('00000000-0000-0000-0000-0000345ea003', 'hank@paintedlinks.test'),
  ('00000000-0000-0000-0000-0000345ea006', 'ava@paintedlinks.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000345ea001', 'dee@paintedlinks.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000345ea002', 'hal@paintedlinks.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000345ea003', 'hank@paintedlinks.test', 'Hank Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000345ea006', 'ava@paintedlinks.test', 'Ava Away', 'helpers', false, false, '2026-11-04 15:00+00')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000345ef001', 'Painted links bed work', 'PL');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000345eb001', '00000000-0000-0000-0000-0000345ea001', '00000000-0000-0000-0000-0000345ef001', 'Links bed lot', '3459');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000345eb001', '00000000-0000-0000-0000-0000345ea002'),
  ('00000000-0000-0000-0000-0000345eb001', '00000000-0000-0000-0000-0000345ea006');
-- Two maps of Dee's: one on the lot, one on nothing, which only Dee and the office read.
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-0000345ec001', 'Lot way in', '00000000-0000-0000-0000-0000345eb001', '00000000-0000-0000-0000-0000345ea001'),
  ('00000000-0000-0000-0000-0000345ec002', 'Loose map', NULL, '00000000-0000-0000-0000-0000345ea001');

CREATE SCHEMA pml;
GRANT USAGE ON SCHEMA pml TO authenticated, service_role;
CREATE FUNCTION pml.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pml.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The claims the edge function's own client carries: the service role, and nobody signed in.
CREATE FUNCTION pml.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
-- What a write does under the caller's rights: 'rows N', or the sqlstate it raised (42501 is a refusal).
CREATE FUNCTION pml.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The links the caller reads, by the map each opens.
CREATE FUNCTION pml.links() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(m.name, ', ' ORDER BY m.name, l.made_at), 'none')
  FROM public.painted_map_links l JOIN public.painted_maps m ON m.id = l.map_id
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pml TO authenticated, service_role;

-- The structure.
SELECT pml.same('the table carries the archived seal and the twin fences', (
  SELECT count(*)::text FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'painted_map_links'
    AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
), '4');
SELECT pml.same('row security is on', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.painted_map_links'::regclass), 'true');
SELECT pml.same('anon holds no right on the table', (
  has_table_privilege('anon', 'public.painted_map_links', 'SELECT')::text || ' ' ||
  has_table_privilege('anon', 'public.painted_map_links', 'INSERT')::text
), 'false false');
SELECT pml.same('a signed-in account may read and nothing more', (
  has_table_privilege('authenticated', 'public.painted_map_links', 'SELECT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.painted_map_links', 'INSERT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.painted_map_links', 'UPDATE')::text || ' ' ||
  has_table_privilege('authenticated', 'public.painted_map_links', 'DELETE')::text
), 'true false false false');
SELECT pml.same('no column keeps a code', (
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'painted_map_links'
), 'id, map_id, code_hash, made_by, made_at, expires_at, ended_at, ended_by, opened_at, last_opened_at, open_count');

-- The function's door: the service role makes a link on each map, marks one opened and ends another.
SET LOCAL ROLE service_role;
SELECT pml.as_service();
SELECT pml.same('the function makes a link on the lot''s map', pml.try($q$
  INSERT INTO public.painted_map_links (id, map_id, code_hash, made_by, expires_at)
  VALUES ('00000000-0000-0000-0000-0000345e1001', '00000000-0000-0000-0000-0000345ec001', repeat('a', 64), '00000000-0000-0000-0000-0000345ea001', now() + interval '90 days')
$q$), 'rows 1');
SELECT pml.same('and one on the loose map', pml.try($q$
  INSERT INTO public.painted_map_links (id, map_id, code_hash, made_by, expires_at)
  VALUES ('00000000-0000-0000-0000-0000345e1002', '00000000-0000-0000-0000-0000345ec002', repeat('b', 64), '00000000-0000-0000-0000-0000345ea001', now() + interval '90 days')
$q$), 'rows 1');
SELECT pml.same('a hash that is not a hash is refused', pml.try($q$
  INSERT INTO public.painted_map_links (map_id, code_hash, expires_at) VALUES ('00000000-0000-0000-0000-0000345ec001', 'q7m2kd4x9p', now() + interval '90 days')
$q$), '23514');
SELECT pml.same('the same hash cannot open two links', pml.try($q$
  INSERT INTO public.painted_map_links (map_id, code_hash, expires_at) VALUES ('00000000-0000-0000-0000-0000345ec002', repeat('a', 64), now() + interval '90 days')
$q$), '23505');
SELECT pml.same('a link on no map is refused', pml.try($q$
  INSERT INTO public.painted_map_links (map_id, code_hash, expires_at) VALUES ('00000000-0000-0000-0000-0000345ec0ff', repeat('c', 64), now() + interval '90 days')
$q$), '23503');
SELECT pml.same('the function counts an open', pml.try($q$
  UPDATE public.painted_map_links SET open_count = open_count + 1, opened_at = now(), last_opened_at = now() WHERE id = '00000000-0000-0000-0000-0000345e1001'
$q$), 'rows 1');
SELECT pml.same('a count cannot go below nothing', pml.try($q$
  UPDATE public.painted_map_links SET open_count = -1 WHERE id = '00000000-0000-0000-0000-0000345e1001'
$q$), '23514');
RESET ROLE;

SET LOCAL ROLE authenticated;

-- Who reads a link: whoever reads its map.
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea001');
SELECT pml.same('Dee reads both links', pml.links(), 'Loose map, Lot way in');
SELECT pml.same('Dee reads that the lot''s link was opened once', (SELECT open_count::text FROM public.painted_map_links WHERE id = '00000000-0000-0000-0000-0000345e1001'), '1');
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea002');
SELECT pml.same('Hal, on the lot''s crew, reads the lot''s link and not the loose map''s', pml.links(), 'Lot way in');
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea003');
SELECT pml.same('Hank, on no crew, reads no link', pml.links(), 'none');
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea006');
SELECT pml.same('Ava, who left, reads no link though she was on the crew', pml.links(), 'none');

-- Nobody signed in writes a link, not even its map's maker: the function is the one door.
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea001');
SELECT pml.same('Dee cannot make a link by hand', pml.try($q$
  INSERT INTO public.painted_map_links (map_id, code_hash, made_by, expires_at)
  VALUES ('00000000-0000-0000-0000-0000345ec001', repeat('d', 64), '00000000-0000-0000-0000-0000345ea001', now() + interval '90 days')
$q$), '42501');
SELECT pml.same('Dee cannot push a link''s day out', pml.try($q$
  UPDATE public.painted_map_links SET expires_at = now() + interval '10 years' WHERE id = '00000000-0000-0000-0000-0000345e1001'
$q$), '42501');
SELECT pml.same('Dee cannot remove a link by hand', pml.try($q$
  DELETE FROM public.painted_map_links WHERE id = '00000000-0000-0000-0000-0000345e1001'
$q$), '42501');
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea002');
SELECT pml.same('Hal cannot bring an ended link back', pml.try($q$
  UPDATE public.painted_map_links SET ended_at = NULL WHERE map_id = '00000000-0000-0000-0000-0000345ec001'
$q$), '42501');
RESET ROLE;

-- The function ends a link, and the row stays to say so.
SET LOCAL ROLE service_role;
SELECT pml.as_service();
SELECT pml.same('the function ends the lot''s link', pml.try($q$
  UPDATE public.painted_map_links SET ended_at = now(), ended_by = '00000000-0000-0000-0000-0000345ea001' WHERE id = '00000000-0000-0000-0000-0000345e1001' AND ended_at IS NULL
$q$), 'rows 1');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea002');
SELECT pml.same('Hal reads that it was ended', (SELECT (ended_at IS NOT NULL)::text FROM public.painted_map_links WHERE id = '00000000-0000-0000-0000-0000345e1001'), 'true');

-- A map that is thrown away takes its links: the page then reads as it does for a wrong code.
SELECT pml.sign_in('00000000-0000-0000-0000-0000345ea001');
SELECT pml.same('Dee throws the loose map away', pml.try($q$DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-0000345ec002'$q$), 'rows 1');
RESET ROLE;
SELECT pml.same('its link went with it', (SELECT count(*)::text FROM public.painted_map_links WHERE map_id = '00000000-0000-0000-0000-0000345ec002'), '0');
-- Whoever made or ended a link may leave the company; the link stays, unsigned.
SELECT pml.same('a link outlives the account that made it or ended it', (
  SELECT string_agg(a.attname || ' ' || c.confdeltype::text, ', ' ORDER BY a.attname)
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.conrelid = 'public.painted_map_links'::regclass AND c.contype = 'f' AND c.confrelid = 'public.users'::regclass
), 'ended_by n, made_by n');

SELECT 'painted_map_links PASSED';
ROLLBACK;
