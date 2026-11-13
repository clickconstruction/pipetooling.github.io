SET lock_timeout = '3s';

-- v2.7067 (punch list #328, PR 8 of 8): the person doing a task adds its place from where they stand.
--
-- The people standing on a task's spot are the people doing it, and they may not edit the task: only the office or
-- its maker writes checklist_items. So a task given with no place stayed with none, even with someone standing on it
-- and a phone in hand. This function is that one write and nothing else.
--
--   * Who: the office or a person the task is given to (can_work_checklist_instance), never a training account, a
--     digital twin or an archived account.
--   * What: a reading the phone took on that press, with its margin. A reading wider than 46 m, about 150 ft, is
--     refused: a place nobody looked at on a map must at least be one the phone was sure of.
--   * Only a missing place. A task that has a place keeps it: a wrong place is said in a note, and whoever gave the
--     task moves it. This cannot be used to move or clear a place.
--   * Where it lands: on the task as written, or on the roadmap task behind it when there is one, since that is
--     where a roadmap task's place lives (20261112230000).
--
-- Idempotent: CREATE OR REPLACE, and the grants are restated.

CREATE OR REPLACE FUNCTION public.add_task_place_from_the_spot(
  p_instance_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m integer,
  p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item uuid;
  v_task uuid;
  v_has_place boolean;
  v_name text := NULLIF(left(btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g')), 40), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to add a place.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot add a place.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add a place.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot add a place.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_work_checklist_instance(p_instance_id) THEN
    RAISE EXCEPTION 'Only the office or a person the task is given to can add its place.' USING ERRCODE = '42501';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR (p_lat = 0 AND p_lng = 0) THEN
    RAISE EXCEPTION 'That is not a place on the map.' USING ERRCODE = '22023';
  END IF;
  IF p_accuracy_m IS NULL OR p_accuracy_m < 0 OR p_accuracy_m > 46 THEN
    RAISE EXCEPTION 'Your phone is not sure enough of where you are. Try again in the open.' USING ERRCODE = '22023';
  END IF;

  SELECT i.checklist_item_id, it.roadmap_group_task_id, it.place_lat IS NOT NULL
    INTO v_item, v_task, v_has_place
  FROM public.checklist_instances i
  JOIN public.checklist_items it ON it.id = i.checklist_item_id
  WHERE i.id = p_instance_id;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'That task is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF v_has_place THEN
    RAISE EXCEPTION 'This task already has a place. If it is wrong, say so in a note.' USING ERRCODE = '23505';
  END IF;

  IF v_task IS NOT NULL THEN
    UPDATE public.checklist_tech_tree_group_tasks
    SET place_name = v_name, place_lat = p_lat, place_lng = p_lng, place_accuracy_m = p_accuracy_m, place_set_by = auth.uid(), place_set_at = now()
    WHERE id = v_task AND place_lat IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This task already has a place. If it is wrong, say so in a note.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('ok', true, 'on', 'roadmap');
  END IF;

  UPDATE public.checklist_items
  SET place_name = v_name, place_lat = p_lat, place_lng = p_lng, place_accuracy_m = p_accuracy_m, place_set_by = auth.uid(), place_set_at = now()
  WHERE id = v_item AND place_lat IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This task already has a place. If it is wrong, say so in a note.' USING ERRCODE = '23505';
  END IF;
  RETURN jsonb_build_object('ok', true, 'on', 'item');
END;
$$;

REVOKE ALL ON FUNCTION public.add_task_place_from_the_spot(uuid, double precision, double precision, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_task_place_from_the_spot(uuid, double precision, double precision, integer, text) TO authenticated;
COMMENT ON FUNCTION public.add_task_place_from_the_spot(uuid, double precision, double precision, integer, text) IS 'Task places (#328): the person doing a task adds its missing place from a reading their phone took. The office or an assignee; a reading within 46 m; never over a place that is already there. Lands on the task, or on the roadmap task behind it.';
