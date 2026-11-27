SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 15): a test map thrown away keeps a copy.
--
-- Throw this map away deletes the painted_maps row from the client (the table's own delete policy: its maker and the
-- office). Its lines, places, links and the opens of its links go with it by their keys (ON DELETE CASCADE,
-- 20261113220000, 20261114010000, 20261116173000), and the client then takes the map's photos out of the bucket. No
-- painted map table carries the archive trigger, so nothing is kept and Recently deleted has nothing to put back.
-- The owner's answer of 2026-11-25: build the take-backs that need a migration, each on its own yes.
--
-- One function, and no table, column, policy, grant or trigger. No table is locked.
--
--   throw_away_test_painted_map(p_map_id)   a developer alone, a test map alone (the map's name starts with ZZ, the
--                                           rule painted-map-link's desk.reopen holds, isZzTestName). It copies the
--                                           map's row and every line, place, link and link open of it into
--                                           deleted_records_archive under the map's id, then deletes the map, in
--                                           one transaction. It refuses nobody signed in, anyone but a dev, a map
--                                           that is not there and a map whose name does not start with ZZ, in
--                                           words. It answers { ok, map_id, name, copied, total, carriers }.
--
-- The put-back needs nothing new: restore_deleted_records (20260828031500) reads a bundle by its handle, sorts the
-- tables by their keys from the catalog, and inserts the map before its children and a link before its opens. The
-- client that calls this function leaves the map's photos in the bucket, so a place put back still finds its photo.
--
-- Why a function and not the archive trigger on the five tables: the trigger would copy every row any path deletes,
-- on real maps too. A painter erases a stroke as part of painting, each erased stroke would be kept under its map's
-- id, and a later restore of the map would bring back strokes its painter had erased. The trigger on a child also
-- cannot tell a test map from a real one. The function copies the map as it stands at the moment it is thrown away.
--
-- What a put-back does not restore: a task, a roadmap task or a Materials place that carried the map lost its
-- pointer when the map went (their keys are ON DELETE SET NULL) and does not get it back. The answer counts them
-- under carriers, so the screen can say so before the map goes.
--
-- Safe to run twice.

CREATE OR REPLACE FUNCTION public.throw_away_test_painted_map(p_map_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_map public.painted_maps%ROWTYPE;
  v_group text;
  v_copied jsonb := '{}'::jsonb;
  v_carriers jsonb := '{}'::jsonb;
  v_total bigint := 0;
  v_n bigint;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a developer can throw a map away and keep a copy.' USING ERRCODE = 'P0001';
  END IF;
  -- The row is held until this transaction ends: a stroke, a place or a link added at the same moment waits on its
  -- own key to the map, then finds the map gone and is refused, where it would otherwise go with the map uncopied.
  SELECT * INTO v_map FROM public.painted_maps m WHERE m.id = p_map_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The map is not there any more. Read the list again.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (btrim(coalesce(v_map.name, ''), E' \t\n\r') ~* '^zz') THEN
    RAISE EXCEPTION 'Only a test map keeps a copy. This map’s name does not start with ZZ.' USING ERRCODE = 'P0001';
  END IF;

  v_group := p_map_id::text;

  -- What carried the map and loses it when it goes. Counted before the delete clears the pointers.
  SELECT count(*) INTO v_n FROM public.checklist_items i WHERE i.painted_map_id = p_map_id;
  v_carriers := v_carriers || jsonb_build_object('checklist_items', v_n);
  SELECT count(*) INTO v_n FROM public.checklist_tech_tree_group_tasks g WHERE g.painted_map_id = p_map_id;
  v_carriers := v_carriers || jsonb_build_object('checklist_tech_tree_group_tasks', v_n);
  SELECT count(*) INTO v_n FROM public.job_places jp WHERE jp.painted_map_id = p_map_id;
  v_carriers := v_carriers || jsonb_build_object('job_places', v_n);

  -- The copy: the map under its own id, and each child under the map's id with its own id as the record.
  INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
  VALUES ('painted_maps', v_group, v_group, to_jsonb(v_map), v_caller);
  v_copied := v_copied || jsonb_build_object('painted_maps', 1);
  v_total := v_total + 1;

  INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
  SELECT 'painted_map_lines', l.id::text, v_group, to_jsonb(l), v_caller
  FROM public.painted_map_lines l WHERE l.map_id = p_map_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_copied := v_copied || jsonb_build_object('painted_map_lines', v_n);
  v_total := v_total + v_n;

  INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
  SELECT 'painted_map_places', pl.id::text, v_group, to_jsonb(pl), v_caller
  FROM public.painted_map_places pl WHERE pl.map_id = p_map_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_copied := v_copied || jsonb_build_object('painted_map_places', v_n);
  v_total := v_total + v_n;

  INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
  SELECT 'painted_map_links', k.id::text, v_group, to_jsonb(k), v_caller
  FROM public.painted_map_links k WHERE k.map_id = p_map_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_copied := v_copied || jsonb_build_object('painted_map_links', v_n);
  v_total := v_total + v_n;

  INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
  SELECT 'painted_map_link_visits', v.id::text, v_group, to_jsonb(v), v_caller
  FROM public.painted_map_link_visits v WHERE v.map_id = p_map_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_copied := v_copied || jsonb_build_object('painted_map_link_visits', v_n);
  v_total := v_total + v_n;

  DELETE FROM public.painted_maps m WHERE m.id = p_map_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The map is not there any more. Read the list again.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('ok', true, 'map_id', p_map_id, 'name', v_map.name, 'copied', v_copied, 'total', v_total, 'carriers', v_carriers);
END;
$$;

REVOKE ALL ON FUNCTION public.throw_away_test_painted_map(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.throw_away_test_painted_map(uuid) TO authenticated;

COMMENT ON FUNCTION public.throw_away_test_painted_map(uuid) IS
  'Punch list #443, row 15: a developer throws away a painted map whose name starts with ZZ and keeps a copy. Copies the map''s row and its lines, places, links and link opens into deleted_records_archive under the map''s id, then deletes the map, in one transaction, so restore_deleted_records can put it back. Refuses everything else in words. Answers { ok, map_id, name, copied, total, carriers }; carriers counts the tasks, roadmap tasks and Materials places that carried the map and lose it.';
