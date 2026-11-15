-- Paint a map, on a task (punch list #345 step 5, migration *_task_painted_maps): a task and a roadmap task point at
-- a painted map, whoever reads the task reads the map, and a task may point only at a map its writer can read.
-- Fixtures are written as postgres; the tries run as each account under RLS; everything rolls back. Raises on the
-- first failed assertion; ends with "task_painted_maps PASSED". See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of the job. Hal is a helper on its crew. Hank is a helper on no crew, and the person
-- the tasks are given to. Ava is a helper who has left, and is on the task too.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000345da001', 'dee@paintedtasks.test'),
  ('00000000-0000-0000-0000-0000345da002', 'hal@paintedtasks.test'),
  ('00000000-0000-0000-0000-0000345da003', 'hank@paintedtasks.test'),
  ('00000000-0000-0000-0000-0000345da006', 'ava@paintedtasks.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000345da001', 'dee@paintedtasks.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000345da002', 'hal@paintedtasks.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000345da003', 'hank@paintedtasks.test', 'Hank Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000345da006', 'ava@paintedtasks.test', 'Ava Away', 'helpers', false, false, '2026-11-04 15:00+00')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000345df001', 'Painted tasks bed work', 'PT');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000345db001', '00000000-0000-0000-0000-0000345da001', '00000000-0000-0000-0000-0000345df001', 'Tasks bed lot', '3458');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000345db001', '00000000-0000-0000-0000-0000345da002');
-- Three maps: Dee's on the lot, Dee's on nothing, and Hank's own on nothing. The loose one has a line.
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-0000345dc001', 'Lot way in', '00000000-0000-0000-0000-0000345db001', '00000000-0000-0000-0000-0000345da001'),
  ('00000000-0000-0000-0000-0000345dc002', 'Loose map', NULL, '00000000-0000-0000-0000-0000345da001'),
  ('00000000-0000-0000-0000-0000345dc003', 'Hank own', NULL, '00000000-0000-0000-0000-0000345da003');
INSERT INTO public.painted_map_lines (id, map_id, how, points, length_m, made_by) VALUES
  ('00000000-0000-0000-0000-0000345de001', '00000000-0000-0000-0000-0000345dc002', 'drawn', '[[29.5,-98.2],[29.501,-98.201]]', 147.5, '00000000-0000-0000-0000-0000345da001');
-- A task of Dee's, given to Hank and to Ava. A task of Hank's own. Neither carries a map yet.
INSERT INTO public.checklist_items (id, title, created_by_user_id, repeat_type, start_date) VALUES
  ('00000000-0000-0000-0000-0000345dd001', 'Set the water stub', '00000000-0000-0000-0000-0000345da001', 'once', '2026-11-16'),
  ('00000000-0000-0000-0000-0000345dd002', 'Hank''s own task', '00000000-0000-0000-0000-0000345da003', 'once', '2026-11-16');
INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000345dd001', '00000000-0000-0000-0000-0000345da003'),
  ('00000000-0000-0000-0000-0000345dd001', '00000000-0000-0000-0000-0000345da006');
-- A roadmap of Dee's with one task, given to Hank.
INSERT INTO public.checklist_tech_tree_roadmaps (id, title, created_by_user_id) VALUES
  ('00000000-0000-0000-0000-0000345d0001', 'Tasks bed roadmap', '00000000-0000-0000-0000-0000345da001');
INSERT INTO public.checklist_tech_tree_groups (id, title, created_by_user_id, roadmap_id) VALUES
  ('00000000-0000-0000-0000-0000345d0002', 'Tasks bed stage', '00000000-0000-0000-0000-0000345da001', '00000000-0000-0000-0000-0000345d0001');
INSERT INTO public.checklist_tech_tree_group_tasks (id, group_id, title) VALUES
  ('00000000-0000-0000-0000-0000345d0003', '00000000-0000-0000-0000-0000345d0002', 'Trench to the meter');
INSERT INTO public.checklist_tech_tree_task_assignees (task_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000345d0003', '00000000-0000-0000-0000-0000345da003');

CREATE SCHEMA pmt;
GRANT USAGE ON SCHEMA pmt TO authenticated;
CREATE FUNCTION pmt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION pmt.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised.
CREATE FUNCTION pmt.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The maps the caller reads, by name.
CREATE FUNCTION pmt.maps() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(name, ', ' ORDER BY name), 'none') FROM public.painted_maps
$$;
-- A value read past RLS, to tell "gone" from "hidden".
CREATE FUNCTION pmt.past(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmt TO authenticated;

-- The structure.
SELECT pmt.same('both homes of a task carry the pointer, and a map thrown away sets it null', (
  SELECT string_agg(c.conrelid::regclass::text || ' ' || c.confdeltype::text, ', ' ORDER BY c.conrelid::regclass::text)
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f' AND c.confrelid = 'public.painted_maps'::regclass AND a.attname = 'painted_map_id'
    AND c.conrelid IN ('public.checklist_items'::regclass, 'public.checklist_tech_tree_group_tasks'::regclass)
), 'checklist_items n, checklist_tech_tree_group_tasks n');
SELECT pmt.same('the map has its second way in, for SELECT alone', (
  SELECT cmd || ' ' || permissive FROM pg_policies WHERE schemaname = 'public' AND tablename = 'painted_maps' AND policyname = 'painted_maps_select_on_a_task'
), 'SELECT PERMISSIVE');
SELECT pmt.same('each task table has its guard', (
  SELECT string_agg(tgrelid::regclass::text, ', ' ORDER BY tgrelid::regclass::text) FROM pg_trigger
  WHERE NOT tgisinternal AND tgname IN ('checklist_items_painted_map_guard', 'checklist_tech_tree_group_tasks_painted_map_guard')
), 'checklist_items, checklist_tech_tree_group_tasks');
SELECT pmt.same('the question is closed to anon', (
  has_function_privilege('authenticated', 'public.painted_map_on_a_task_i_read(uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.painted_map_on_a_task_i_read(uuid)', 'EXECUTE')::text
), 'true false');
SELECT pmt.same('the question and the guard both read as the caller', (
  SELECT string_agg(proname || ' ' || prosecdef::text, ', ' ORDER BY proname) FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND proname IN ('painted_map_on_a_task_i_read', 'task_painted_map_guard')
), 'painted_map_on_a_task_i_read false, task_painted_map_guard false');

SET LOCAL ROLE authenticated;

-- Before any task carries a map, each person reads what the map's own gate gives them.
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da003');
SELECT pmt.same('Hank, on no crew, reads his own map alone', pmt.maps(), 'Hank own');
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da002');
SELECT pmt.same('Hal, on the crew, reads the lot''s map alone', pmt.maps(), 'Lot way in');

-- Dee puts the loose map on the task she gave Hank.
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da001');
SELECT pmt.same('Dee puts the loose map on her task', pmt.try($q$
  UPDATE public.checklist_items SET painted_map_id = '00000000-0000-0000-0000-0000345dc002' WHERE id = '00000000-0000-0000-0000-0000345dd001'
$q$), 'rows 1');

-- Whoever reads the task reads the map, its lines with it. Nobody else gains anything.
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da003');
SELECT pmt.same('Hank now reads the map his task carries', pmt.maps(), 'Hank own, Loose map');
SELECT pmt.same('and its line', (SELECT count(*)::text FROM public.painted_map_lines WHERE map_id = '00000000-0000-0000-0000-0000345dc002'), '1');
SELECT pmt.same('Hank cannot rename it', pmt.try($q$
  UPDATE public.painted_maps SET name = 'Hank was here' WHERE id = '00000000-0000-0000-0000-0000345dc002'
$q$), 'rows 0');
SELECT pmt.same('or throw it away', pmt.try($q$
  DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-0000345dc002'
$q$), 'rows 0');
-- The map's standing rule: whoever reads a map may add a place to it.
SELECT pmt.same('Hank adds a place to it, as anyone who reads a map may', pmt.try($q$
  INSERT INTO public.painted_map_places (map_id, name, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-0000345dc002', 'The valve', 29.5005, -98.2005, '00000000-0000-0000-0000-0000345da003')
$q$), 'rows 1');
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da002');
SELECT pmt.same('Hal is not on the task and gains nothing', pmt.maps(), 'Lot way in');
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da006');
SELECT pmt.same('Ava is on the task and has left: the seal holds', pmt.maps(), 'none');

-- The guard: a task may point only at a map its writer can read.
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da003');
SELECT pmt.same('Hank cannot point his own task at the lot''s map, which he cannot open', pmt.try($q$
  UPDATE public.checklist_items SET painted_map_id = '00000000-0000-0000-0000-0000345dc001' WHERE id = '00000000-0000-0000-0000-0000345dd002'
$q$), '42501');
SELECT pmt.same('nor make a new task that points at it', pmt.try($q$
  INSERT INTO public.checklist_items (title, created_by_user_id, repeat_type, start_date, painted_map_id)
  VALUES ('A way round the gate', '00000000-0000-0000-0000-0000345da003', 'once', '2026-11-16', '00000000-0000-0000-0000-0000345dc001')
$q$), '42501');
SELECT pmt.same('nor point it at a map that does not exist', pmt.try($q$
  UPDATE public.checklist_items SET painted_map_id = '00000000-0000-0000-0000-0000345dcfff' WHERE id = '00000000-0000-0000-0000-0000345dd002'
$q$), '42501');
SELECT pmt.same('the lot''s map stayed closed to him', pmt.maps(), 'Hank own, Loose map');
SELECT pmt.same('Hank points his own task at his own map', pmt.try($q$
  UPDATE public.checklist_items SET painted_map_id = '00000000-0000-0000-0000-0000345dc003' WHERE id = '00000000-0000-0000-0000-0000345dd002'
$q$), 'rows 1');
SELECT pmt.same('a write that leaves the pointer alone is not asked again', pmt.try($q$
  UPDATE public.checklist_items SET title = 'Hank''s own task, renamed' WHERE id = '00000000-0000-0000-0000-0000345dd002'
$q$), 'rows 1');

-- Taking the map off the task takes the read with it.
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da001');
SELECT pmt.same('Dee takes the map off her task', pmt.try($q$
  UPDATE public.checklist_items SET painted_map_id = NULL WHERE id = '00000000-0000-0000-0000-0000345dd001'
$q$), 'rows 1');
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da003');
SELECT pmt.same('Hank reads his own map alone again', pmt.maps(), 'Hank own');

-- A roadmap task carries a map the same way, and the person it is given to reads it.
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da001');
SELECT pmt.same('Dee puts the lot''s map on the roadmap task', pmt.try($q$
  UPDATE public.checklist_tech_tree_group_tasks SET painted_map_id = '00000000-0000-0000-0000-0000345dc001' WHERE id = '00000000-0000-0000-0000-0000345d0003'
$q$), 'rows 1');
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da003');
SELECT pmt.same('Hank reads the map his roadmap task carries', pmt.maps(), 'Hank own, Lot way in');
-- An assignee may write a roadmap task's row. The guard still holds the pointer.
SELECT pmt.same('Hank cannot move the roadmap task onto a map he cannot open', pmt.try($q$
  UPDATE public.checklist_tech_tree_group_tasks SET painted_map_id = '00000000-0000-0000-0000-0000345dc002' WHERE id = '00000000-0000-0000-0000-0000345d0003'
$q$), '42501');

-- A map thrown away leaves its task standing, with no map.
SELECT pmt.sign_in('00000000-0000-0000-0000-0000345da001');
SELECT pmt.same('Dee throws the lot''s map away', pmt.try($q$
  DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-0000345dc001'
$q$), 'rows 1');
RESET ROLE;
SELECT pmt.same('the roadmap task stands, with no map', (
  SELECT title || ' ' || coalesce(painted_map_id::text, 'no map') FROM public.checklist_tech_tree_group_tasks WHERE id = '00000000-0000-0000-0000-0000345d0003'
), 'Trench to the meter no map');

SELECT 'task_painted_maps PASSED';
ROLLBACK;
