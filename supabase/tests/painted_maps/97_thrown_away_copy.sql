-- Presses nothing takes back (punch list #443, row 15): a test map thrown away keeps a copy (migration
-- *_test_painted_map_keeps_a_copy). throw_away_test_painted_map copies a ZZ-named map's row and its lines, places,
-- links and link opens into deleted_records_archive under the map's id, then deletes the map, for a developer alone.
-- The put-back is restore_deleted_records as it stands, which this file does not change and only calls.
-- Devon the dev throws a ZZ map away: the answer counts what was copied and what carried the map, the five tables
-- hold nothing of it, the archive holds each row as it stood, and the task, the roadmap task and the Materials place
-- that carried it stand without it. Recently deleted lists the bundle by the map's name. The dry run of the restore
-- answers the counts and leaves nothing; the restore puts every row back equal to its copy and marks the copies
-- restored; the carriers do not get the map back. A second throw-away and restore of the same map works. Nobody
-- signed in, Rosa the assistant, Hal the maker of his own ZZ map, Tess the dev in training, a map that is not there
-- and a map not named ZZ are each refused in words, with nothing archived. A plain delete of a ZZ map by its maker
-- still works and archives nothing. Fixtures made as postgres, the link and its open as the service role; everything
-- runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "painted_map_thrown_away_copy PASSED". See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA pmc;
CREATE FUNCTION pmc.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000044315' || p)::uuid $$;
-- Each row of the map that goes, as it stood before the throw-away: the copy and the put-back are held against it.
CREATE TABLE pmc.before (t text NOT NULL, id text NOT NULL, body jsonb NOT NULL);
CREATE FUNCTION pmc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pmc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The claims the edge function's own client carries: the service role, and nobody signed in.
CREATE FUNCTION pmc.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
-- The function's answer as text, or the refusal's words.
CREATE FUNCTION pmc.throw(p_map uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN public.throw_away_test_painted_map(p_map)::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A plain delete of a map, as the client sends it under the caller's own row security: 'rows N' or the refusal's words.
CREATE FUNCTION pmc.plain_delete(p_map uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM public.painted_maps WHERE id = p_map;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A statement refused with words that hold `want`.
CREATE FUNCTION pmc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A map and everything on it, past RLS: one row a row, with its table, its id and the row whole.
CREATE FUNCTION pmc.rows_of(p_map uuid) RETURNS TABLE (t text, id text, body jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'painted_maps'::text, m.id::text, to_jsonb(m) FROM public.painted_maps m WHERE m.id = p_map
  UNION ALL SELECT 'painted_map_lines', l.id::text, to_jsonb(l) FROM public.painted_map_lines l WHERE l.map_id = p_map
  UNION ALL SELECT 'painted_map_places', p.id::text, to_jsonb(p) FROM public.painted_map_places p WHERE p.map_id = p_map
  UNION ALL SELECT 'painted_map_links', k.id::text, to_jsonb(k) FROM public.painted_map_links k WHERE k.map_id = p_map
  UNION ALL SELECT 'painted_map_link_visits', v.id::text, to_jsonb(v) FROM public.painted_map_link_visits v WHERE v.map_id = p_map
$$;
-- What stands of a map, past RLS, as words: "painted_map_lines 2, painted_maps 1", or "nothing".
CREATE FUNCTION pmc.live(p_map uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(x.t || ' ' || x.n, ', ' ORDER BY x.t), 'nothing') FROM (SELECT r.t, count(*)::text AS n FROM pmc.rows_of(p_map) r GROUP BY r.t) x
$$;
-- The copies kept under a map's id, past RLS, the same way. `p_restored` picks the copies already put back.
CREATE FUNCTION pmc.kept(p_map uuid, p_restored boolean DEFAULT false) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(x.table_name || ' ' || x.n, ', ' ORDER BY x.table_name), 'nothing')
  FROM (SELECT a.table_name, count(*)::text AS n FROM public.deleted_records_archive a
        WHERE a.group_key = p_map::text AND (a.restored_at IS NOT NULL) = p_restored GROUP BY a.table_name) x
$$;
-- How many copies under the map's id, not yet put back, are whole: its own table and id, signed by `p_by`, and the
-- row word for word as the bed kept it before the throw-away.
CREATE FUNCTION pmc.kept_whole(p_map uuid, p_by uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.deleted_records_archive a JOIN pmc.before b ON b.t = a.table_name AND b.id = a.record_id
  WHERE a.group_key = p_map::text AND a.restored_at IS NULL AND a.deleted_by = p_by AND a.row_data = b.body
$$;
-- How many live rows of the map are word for word what the bed kept before the throw-away.
CREATE FUNCTION pmc.back_whole(p_map uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM pmc.rows_of(p_map) r JOIN pmc.before b ON b.t = r.t AND b.id = r.id WHERE r.body = b.body
$$;
-- What carried the map, past RLS: the task, the roadmap task and the Materials place, each with its map or "no map".
CREATE FUNCTION pmc.carriers() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'task ' || coalesce((SELECT right(i.painted_map_id::text, 2) FROM public.checklist_items i WHERE i.id = pmc.id('d1')), 'no map')
      || ' / roadmap task ' || coalesce((SELECT right(g.painted_map_id::text, 2) FROM public.checklist_tech_tree_group_tasks g WHERE g.id = pmc.id('d4')), 'no map')
      || ' / place ' || coalesce((SELECT right(jp.painted_map_id::text, 2) FROM public.job_places jp WHERE jp.id = pmc.id('d5')), 'no map')
      || ' / standing ' || ((SELECT count(*) FROM public.checklist_items i WHERE i.id = pmc.id('d1'))
                          + (SELECT count(*) FROM public.checklist_tech_tree_group_tasks g WHERE g.id = pmc.id('d4'))
                          + (SELECT count(*) FROM public.job_places jp WHERE jp.id = pmc.id('d5')))::text
$$;
-- Recently deleted's line for a bundle, as the caller reads it: "kind | label | rows", or "not listed".
CREATE FUNCTION pmc.listed(p_map uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((SELECT d.kind || ' | ' || d.label || ' | ' || d.row_count FROM public.list_deleted_records(200) d WHERE d.group_key = p_map::text), 'not listed')
$$;
GRANT USAGE ON SCHEMA pmc TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmc TO anon, authenticated, service_role;

-- Who: Devon the dev, Rosa the assistant, Hal a helper who paints his own map, Tess a dev in training.
INSERT INTO auth.users (id, email) VALUES
  (pmc.id('a1'), 'devon@mapcopy.test'), (pmc.id('a2'), 'rosa@mapcopy.test'), (pmc.id('a3'), 'hal@mapcopy.test'), (pmc.id('a4'), 'tess@mapcopy.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  (pmc.id('a1'), 'devon@mapcopy.test', 'Devon Dev Pmc', 'dev', false, false, NULL),
  (pmc.id('a2'), 'rosa@mapcopy.test', 'Rosa Office Pmc', 'assistant', false, false, NULL),
  (pmc.id('a3'), 'hal@mapcopy.test', 'Hal Helper Pmc', 'helpers', false, false, NULL),
  (pmc.id('a4'), 'tess@mapcopy.test', 'Tess Training Pmc', 'dev', true, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- One ZZ Test job of Devon's. The maps:
--   c1  "ZZ Test way in", Devon's, on the job: the one that goes and comes back. Two lines, two places, a link, an open.
--   c2  "Lot ZZ way in", Devon's, on no job: ZZ is not at the start of its name, so it keeps no copy and stays.
--   c3  "ZZ Test helper map", Hal's own, on no job: the function refuses Hal, and his plain delete takes it.
--   c4  "  zz small map", Devon's, on no job: the rule reads any case, after trimming.
INSERT INTO public.service_types (id, name) VALUES (pmc.id('f0'), 'Map copy bed work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  (pmc.id('b1'), pmc.id('a1'), pmc.id('f0'), 'ZZ Test map copy job', 'J44315');
INSERT INTO public.painted_maps (id, name, words, job_id, created_by) VALUES
  (pmc.id('c1'), 'ZZ Test way in', 'Start at the truck gate.', pmc.id('b1'), pmc.id('a1')),
  (pmc.id('c2'), 'Lot ZZ way in', '', NULL, pmc.id('a1')),
  (pmc.id('c3'), 'ZZ Test helper map', '', NULL, pmc.id('a3')),
  (pmc.id('c4'), '  zz small map', '', NULL, pmc.id('a1'));
INSERT INTO public.painted_map_lines (id, map_id, label, how, points, poor_parts, fixed_by_hand, length_m, margin_m, measured_ft, measured_how, made_by) VALUES
  (pmc.id('e1'), pmc.id('c1'), 'Water line', 'walked', '[[29.5,-98.2],[29.5005,-98.2004],[29.501,-98.201]]', '[[1,2]]', true, 147.5, 2.12, 480.5, 'wheel', pmc.id('a1')),
  (pmc.id('e2'), pmc.id('c1'), '', 'drawn', '[[29.501,-98.201],[29.502,-98.202]]', '[]', false, 150.25, NULL, NULL, NULL, pmc.id('a3')),
  (pmc.id('e3'), pmc.id('c2'), '', 'drawn', '[[29.6,-98.3],[29.601,-98.301]]', '[]', false, 140, NULL, NULL, NULL, pmc.id('a1'));
-- Place p1 has a photo and two more. Place p2 runs along line e1.
INSERT INTO public.painted_map_places (id, map_id, name, words, lat, lng, accuracy_m, photo_path, kind, set_by, more_photos) VALUES
  (pmc.id('71'), pmc.id('c1'), 'Truck gate', 'Code is on the box.', 29.5001, -98.2001, 5, pmc.id('c1')::text || '/aaa.jpg', 'gate', pmc.id('a1'),
   jsonb_build_array(jsonb_build_object('path', pmc.id('c1')::text || '/bbb.jpg', 'words', 'Open', 'at', '2026-11-20T15:00:00Z', 'by', pmc.id('a1'))));
INSERT INTO public.painted_map_places (id, map_id, name, lat, lng, set_by, line_id) VALUES
  (pmc.id('72'), pmc.id('c1'), 'Buried water', 29.5005, -98.2004, pmc.id('a3'), pmc.id('e1'));
-- What carries map c1: a task, a roadmap task and a Materials place on the map's own job.
INSERT INTO public.checklist_items (id, title, created_by_user_id, repeat_type, start_date, painted_map_id) VALUES
  (pmc.id('d1'), 'ZZ Test set the water stub', pmc.id('a1'), 'once', '2026-11-27', pmc.id('c1'));
INSERT INTO public.checklist_tech_tree_roadmaps (id, title, created_by_user_id) VALUES (pmc.id('d2'), 'ZZ Test map copy roadmap', pmc.id('a1'));
INSERT INTO public.checklist_tech_tree_groups (id, title, created_by_user_id, roadmap_id) VALUES (pmc.id('d3'), 'ZZ Test map copy stage', pmc.id('a1'), pmc.id('d2'));
INSERT INTO public.checklist_tech_tree_group_tasks (id, group_id, title, painted_map_id) VALUES (pmc.id('d4'), pmc.id('d3'), 'ZZ Test trench to the meter', pmc.id('c1'));
INSERT INTO public.job_places (id, job_id, name, painted_map_id) VALUES (pmc.id('d5'), pmc.id('b1'), 'ZZ Test yard', pmc.id('c1'));

-- The link and its open, written as the painted-map-link function writes them: as the service role.
SET LOCAL ROLE service_role;
SELECT pmc.as_service();
INSERT INTO public.painted_map_links (id, map_id, code_hash, made_by, expires_at, opened_at, last_opened_at, open_count)
  VALUES (pmc.id('81'), pmc.id('c1'), repeat('e', 64), pmc.id('a1'), now() + interval '90 days', now(), now(), 2);
INSERT INTO public.painted_map_link_visits (id, link_id, map_id, visitor_name, device_id, device_words, ip, first_lat, first_lng, first_accuracy_m, first_located_at)
  VALUES (pmc.id('91'), pmc.id('81'), pmc.id('c1'), 'ZZ Test Driver', '11111111-1111-4111-8111-111111111111', 'iPhone · Safari', '203.0.113.7', 29.5, -98.2, 12.5, now());
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);

-- Each row of map c1 as it stands now, kept to hold the copy and the put-back against.
INSERT INTO pmc.before (t, id, body) SELECT r.t, r.id, r.body FROM pmc.rows_of(pmc.id('c1')) r;

-- ---------------------------------------------------------------------------------------------------------------
-- 0. The structure.
SELECT pmc.same('the function runs as its owner, and is closed to anon', (
  SELECT p.prosecdef::text || ' ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ' ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
  FROM pg_proc p WHERE p.oid = 'public.throw_away_test_painted_map(uuid)'::regprocedure
), 'true true false');
SELECT pmc.same('no painted map table carries the archive trigger: the function alone keeps a copy', (
  SELECT count(*)::text FROM pg_trigger tg
  WHERE NOT tg.tgisinternal AND tg.tgname = 'zzz_archive_on_delete'
    AND tg.tgrelid IN ('public.painted_maps'::regclass, 'public.painted_map_lines'::regclass, 'public.painted_map_places'::regclass,
                       'public.painted_map_links'::regclass, 'public.painted_map_link_visits'::regclass)
), '0');
SELECT pmc.same('map c1 stands whole', pmc.live(pmc.id('c1')), 'painted_map_lines 2, painted_map_link_visits 1, painted_map_links 1, painted_map_places 2, painted_maps 1');
SELECT pmc.same('three things carry it', pmc.carriers(), 'task c1 / roadmap task c1 / place c1 / standing 3');
SELECT pmc.same('nothing is archived yet', pmc.kept(pmc.id('c1')) || ' / ' || pmc.kept(pmc.id('c2')) || ' / ' || pmc.kept(pmc.id('c3')) || ' / ' || pmc.kept(pmc.id('c4')), 'nothing / nothing / nothing / nothing');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The refusals, each with its sentence, and nothing changed by any of them.
SELECT pmc.same('with nobody signed in the function says so', pmc.throw(pmc.id('c1')), 'Sign in first.');
SET LOCAL ROLE anon;
SELECT pmc.refused('signed out, the call is refused at the door', format($q$SELECT public.throw_away_test_painted_map(%L)$q$, pmc.id('c1')), 'permission denied');
RESET ROLE;

-- Rosa the assistant may throw any map away by the table's own policy. The function keeps no copy for her.
SELECT pmc.as_user(pmc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('an assistant is refused', pmc.throw(pmc.id('c1')), 'Only a developer can throw a map away and keep a copy.');
RESET ROLE;
-- Hal painted map c3 and may throw it away himself. The function keeps no copy for him either.
SELECT pmc.as_user(pmc.id('a3'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('a map''s own maker who is no developer is refused', pmc.throw(pmc.id('c3')), 'Only a developer can throw a map away and keep a copy.');
RESET ROLE;
-- Tess is a developer in training. The training guard on the map's table stops the delete inside the function.
SELECT pmc.as_user(pmc.id('a4'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('a developer in training is refused by the training guard', pmc.throw(pmc.id('c1')), 'Read-only (training) mode: changes are blocked.');
RESET ROLE;

SELECT pmc.as_user(pmc.id('a1'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('a map that is not there is refused', pmc.throw(pmc.id('cf')), 'The map is not there any more. Read the list again.');
SELECT pmc.same('a map whose name does not start with ZZ is refused', pmc.throw(pmc.id('c2')), 'Only a test map keeps a copy. This map’s name does not start with ZZ.');
RESET ROLE;
SELECT pmc.same('nothing changed: every map stands', pmc.live(pmc.id('c1')) || ' / ' || pmc.live(pmc.id('c2')) || ' / ' || pmc.live(pmc.id('c3')) || ' / ' || pmc.live(pmc.id('c4')),
  'painted_map_lines 2, painted_map_link_visits 1, painted_map_links 1, painted_map_places 2, painted_maps 1 / painted_map_lines 1, painted_maps 1 / painted_maps 1 / painted_maps 1');
SELECT pmc.same('nothing changed: no refusal kept a copy', pmc.kept(pmc.id('c1')) || ' / ' || pmc.kept(pmc.id('c2')) || ' / ' || pmc.kept(pmc.id('c3')), 'nothing / nothing / nothing');
SELECT pmc.same('nothing changed: the carriers', pmc.carriers(), 'task c1 / roadmap task c1 / place c1 / standing 3');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Devon throws the test map away. The answer counts what was copied and what carried the map.
SELECT pmc.as_user(pmc.id('a1'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('the test map goes, and the answer counts the copy and the carriers', pmc.throw(pmc.id('c1')), jsonb_build_object(
  'ok', true, 'map_id', pmc.id('c1'), 'name', 'ZZ Test way in',
  'copied', jsonb_build_object('painted_maps', 1, 'painted_map_lines', 2, 'painted_map_places', 2, 'painted_map_links', 1, 'painted_map_link_visits', 1),
  'total', 7,
  'carriers', jsonb_build_object('checklist_items', 1, 'checklist_tech_tree_group_tasks', 1, 'job_places', 1))::text);
SELECT pmc.same('the dev reads the seven copies through the archive''s own policy', (SELECT count(*)::text FROM public.deleted_records_archive a WHERE a.group_key = pmc.id('c1')::text), '7');
SELECT pmc.same('Recently deleted lists the bundle by the map''s table and its name', pmc.listed(pmc.id('c1')), 'painted_maps | ZZ Test way in | 7');
SELECT pmc.same('a second throw-away of the same map is refused', pmc.throw(pmc.id('c1')), 'The map is not there any more. Read the list again.');
RESET ROLE;
SELECT pmc.same('the five tables hold nothing of the map', pmc.live(pmc.id('c1')), 'nothing');
SELECT pmc.same('the archive holds 1 + 2 + 2 + 1 + 1 rows under the map''s id', pmc.kept(pmc.id('c1')), 'painted_map_lines 2, painted_map_link_visits 1, painted_map_links 1, painted_map_places 2, painted_maps 1');
SELECT pmc.same('each copy is its row as it stood, under its own table and id, signed by the dev', pmc.kept_whole(pmc.id('c1'), pmc.id('a1')), '7');
SELECT pmc.same('the task, the roadmap task and the Materials place stand, each with no map', pmc.carriers(), 'task no map / roadmap task no map / place no map / standing 3');
SELECT pmc.same('the other maps were not touched', pmc.live(pmc.id('c2')) || ' / ' || pmc.live(pmc.id('c3')) || ' / ' || pmc.live(pmc.id('c4')), 'painted_map_lines 1, painted_maps 1 / painted_maps 1 / painted_maps 1');
-- Rosa reads no copy: the archive is the dev's alone, so the link's hash and the reader's name stay closed to her.
SELECT pmc.as_user(pmc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('an assistant reads no copy', (SELECT count(*)::text FROM public.deleted_records_archive a WHERE a.group_key = pmc.id('c1')::text), '0');
SELECT pmc.same('and Recently deleted lists her nothing', pmc.listed(pmc.id('c1')), 'not listed');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The put-back: restore_deleted_records, as Recently deleted calls it. First the dry run, then the restore.
SELECT pmc.as_user(pmc.id('a1'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('the dry run answers ok with the counts', public.restore_deleted_records(pmc.id('c1')::text, true)::text, jsonb_build_object(
  'ok', true, 'dry_run', true, 'group_key', pmc.id('c1')::text,
  'inserted', jsonb_build_object('painted_maps', 1, 'painted_map_lines', 2, 'painted_map_places', 2, 'painted_map_links', 1, 'painted_map_link_visits', 1),
  'total', 7, 'warnings', '[]'::jsonb, 'blockers', '[]'::jsonb)::text);
RESET ROLE;
SELECT pmc.same('the dry run left nothing in the five tables', pmc.live(pmc.id('c1')), 'nothing');
SELECT pmc.same('and marked no copy restored', pmc.kept(pmc.id('c1')) || ' / ' || pmc.kept(pmc.id('c1'), true), 'painted_map_lines 2, painted_map_link_visits 1, painted_map_links 1, painted_map_places 2, painted_maps 1 / nothing');

SELECT pmc.as_user(pmc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('an assistant cannot put the map back', public.restore_deleted_records(pmc.id('c1')::text, false) ->> 'code', 'forbidden');
RESET ROLE;

SELECT pmc.as_user(pmc.id('a1'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('the restore answers ok with the same counts', public.restore_deleted_records(pmc.id('c1')::text, false)::text, jsonb_build_object(
  'ok', true, 'dry_run', false, 'group_key', pmc.id('c1')::text,
  'inserted', jsonb_build_object('painted_maps', 1, 'painted_map_lines', 2, 'painted_map_places', 2, 'painted_map_links', 1, 'painted_map_link_visits', 1),
  'total', 7, 'warnings', '[]'::jsonb, 'blockers', '[]'::jsonb)::text);
SELECT pmc.same('Recently deleted lists the bundle no more', pmc.listed(pmc.id('c1')), 'not listed');
SELECT pmc.same('the dev reads the map again under its own policy', (SELECT m.name FROM public.painted_maps m WHERE m.id = pmc.id('c1')), 'ZZ Test way in');
RESET ROLE;
SELECT pmc.same('every row is back', pmc.live(pmc.id('c1')), 'painted_map_lines 2, painted_map_link_visits 1, painted_map_links 1, painted_map_places 2, painted_maps 1');
SELECT pmc.same('each row is back word for word as it stood', pmc.back_whole(pmc.id('c1')), '7');
SELECT pmc.same('each row equals its archived copy', (
  SELECT count(*)::text FROM pmc.rows_of(pmc.id('c1')) r JOIN public.deleted_records_archive a ON a.table_name = r.t AND a.record_id = r.id
  WHERE a.group_key = pmc.id('c1')::text AND a.row_data = r.body
), '7');
SELECT pmc.same('the copies carry restored_at, signed by the dev', (
  SELECT count(*)::text FROM public.deleted_records_archive a
  WHERE a.group_key = pmc.id('c1')::text AND a.restored_at IS NOT NULL AND a.restored_by = pmc.id('a1')
), '7');
SELECT pmc.same('none is left to restore', pmc.kept(pmc.id('c1')), 'nothing');
SELECT pmc.same('the place runs along its line again, and the link opens at its old address', (
  SELECT (SELECT right(p.line_id::text, 2) FROM public.painted_map_places p WHERE p.id = pmc.id('72'))
      || ' / ' || (SELECT (k.code_hash = repeat('e', 64))::text || ' ' || k.open_count::text FROM public.painted_map_links k WHERE k.id = pmc.id('81'))
), 'e1 / true 2');
SELECT pmc.same('what carried the map does not get it back', pmc.carriers(), 'task no map / roadmap task no map / place no map / standing 3');

-- A second round of the same map: thrown away again, with nothing carrying it now, and put back again.
SELECT pmc.as_user(pmc.id('a1'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('the map goes a second time, and nothing carries it now', pmc.throw(pmc.id('c1')), jsonb_build_object(
  'ok', true, 'map_id', pmc.id('c1'), 'name', 'ZZ Test way in',
  'copied', jsonb_build_object('painted_maps', 1, 'painted_map_lines', 2, 'painted_map_places', 2, 'painted_map_links', 1, 'painted_map_link_visits', 1),
  'total', 7,
  'carriers', jsonb_build_object('checklist_items', 0, 'checklist_tech_tree_group_tasks', 0, 'job_places', 0))::text);
SELECT pmc.same('the second put-back takes the new copies alone', public.restore_deleted_records(pmc.id('c1')::text, false) ->> 'total', '7');
RESET ROLE;
SELECT pmc.same('the map is back whole a second time', pmc.back_whole(pmc.id('c1')) || ' / ' || pmc.kept(pmc.id('c1')), '7 / nothing');
SELECT pmc.same('both rounds of copies are kept, marked restored', (SELECT count(*)::text FROM public.deleted_records_archive a WHERE a.group_key = pmc.id('c1')::text AND a.restored_at IS NOT NULL), '14');

-- ---------------------------------------------------------------------------------------------------------------
-- 4. The rule reads any case, after trimming: "  zz small map" is a test map. It holds nothing but its own row.
SELECT pmc.as_user(pmc.id('a1'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('a name that starts with zz after its spaces is a test map', pmc.throw(pmc.id('c4')) :: jsonb ->> 'total', '1');
RESET ROLE;
SELECT pmc.same('it is gone, with its one copy', pmc.live(pmc.id('c4')) || ' / ' || pmc.kept(pmc.id('c4')), 'nothing / painted_maps 1');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Today's path is untouched: Hal throws his own ZZ map away with a plain delete, and nothing is archived.
SELECT pmc.as_user(pmc.id('a3'));
SET LOCAL ROLE authenticated;
SELECT pmc.same('the maker''s plain delete of his own ZZ map still works', pmc.plain_delete(pmc.id('c3')), 'rows 1');
RESET ROLE;
SELECT pmc.same('the map is gone and no copy was kept', pmc.live(pmc.id('c3')) || ' / ' || pmc.kept(pmc.id('c3')), 'nothing / nothing');
-- And the map not named ZZ stands to the end, with nothing archived under it.
SELECT pmc.same('the map not named ZZ stands to the end, with no copy', pmc.live(pmc.id('c2')) || ' / ' || pmc.kept(pmc.id('c2')), 'painted_map_lines 1, painted_maps 1 / nothing');

DO $$ BEGIN RAISE NOTICE 'painted_map_thrown_away_copy PASSED'; END $$;
ROLLBACK;
