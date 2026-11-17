SET lock_timeout = '3s';

-- v2.7542 (punch list #369, step C1): what the person doing a task may do with it, without waiting on someone.
--
-- A person given a task could mark it done, tick its lines, add a note, a photo and a missing place. They could not
-- move it to another day, say it no longer applies, hand it on, or put a map on it: each of those is a write to
-- checklist_items or to the assignee tables, which only the office or the task's maker may write. So an old task sat
-- on a list until someone in the office dealt with it. This migration is the ground for those acts and has no screen:
--
--   1. Six new kinds of line in a task's thread (checklist_instance_events): moved, stuck, unstuck, dropped, handed, map.
--   2. Whoever can read a task may write a stuck or an unstuck line on it, as they may write a note.
--   3. Four functions, each one narrow write and nothing else, in the shape of add_task_place_from_the_spot
--      (20261113010000): task_move_day, task_no_longer_applies, task_hand_on, task_add_map.
--
-- Every function is for the office or a person the task is given to (can_work_checklist_instance), never a training
-- account, a digital twin or an archived account, and each refusal is said in words the screen can show.
--
-- What each one will not do, on purpose:
--   * task_move_day moves a one-time task's due day and nothing else. The day row stays where it is, so the task
--     keeps its place in the list and its age. The change lands in checklist_item_due_changes through the trigger
--     that is already there.
--   * task_no_longer_applies closes a one-time task that is not a roadmap task and not a vehicle task. Closing is a
--     completion, and a roadmap task's completion marks its roadmap task done and a vehicle task's marks the service
--     done (sync_roadmap_task_from_instance, sync_vehicle_maintenance_task_completion). Neither would be true, so
--     those two are refused and the person says why in a note instead.
--   * task_hand_on swaps one person for another on the same task, so its notes, place, lines and photos stay. A
--     one-time task moves whole. A repeating task gives away this day's row alone. A roadmap task is refused: its
--     people are the roadmap's.
--   * task_add_map puts a map on a task that has none. It cannot swap or clear a map, and the map must be one the
--     caller painted, with a line or a place on it. The guard on the column reads as the caller in a plain write, and
--     would read as the owner here, so this function asks the question itself.
--
-- Idempotent: the check is dropped by what it holds and added back, the policy is dropped and remade, every function
-- is CREATE OR REPLACE and its grants are restated. No table is created, so no fence is called.

-- 1. The thread's kinds. The six of 20261106230000 and six more.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checklist_instance_events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.checklist_instance_events DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.checklist_instance_events
  ADD CONSTRAINT checklist_instance_events_event_type_check
  CHECK (event_type IN ('completed', 'reopened', 'comment', 'accepted', 'progress', 'criterion', 'moved', 'stuck', 'unstuck', 'dropped', 'handed', 'map'));
COMMENT ON COLUMN public.checklist_instance_events.event_type IS 'What happened on the day row. completed, reopened and accepted are written by the transitions trigger. comment, progress, criterion, stuck and unstuck are written by a person who can read the row. moved, dropped, handed and map are written only by the task_* functions of 20261117120000 (punch list #369): the due day moved (body: the day), the task closed as no longer applying (body: why), the task handed on (body: who to, then why), a map put on it (body: the map''s name).';

-- 2. A stuck line and its answer are a person's own words, like a note. The rule of 20261106230000 with two kinds more.
DROP POLICY IF EXISTS "Insert own comments on visible instances" ON public.checklist_instance_events;
CREATE POLICY "Insert own comments on visible instances" ON public.checklist_instance_events
  FOR INSERT WITH CHECK (
    event_type IN ('comment', 'progress', 'criterion', 'stuck', 'unstuck')
    AND actor_user_id = (SELECT auth.uid())
    AND (event_type <> 'progress' OR percent IS NOT NULL)
    AND EXISTS (SELECT 1 FROM public.checklist_instances i WHERE i.id = instance_id)
  );

-- 3a. Who may act, asked once. Raises in words; returns nothing.
CREATE OR REPLACE FUNCTION public.task_doer_may(p_instance_id uuid, p_act text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to %.', p_act USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot %.', p_act USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot %.', p_act USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot %.', p_act USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_work_checklist_instance(p_instance_id) THEN
    RAISE EXCEPTION 'Only the office or a person the task is given to can %.', p_act USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.task_doer_may(uuid, text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.task_doer_may(uuid, text) IS 'Task Mode tools (#369): the one gate of the task_* functions. The office or an assignee of the day row, never a training account, a digital twin or an archived account. Raises in words the screen shows. Called only from inside those functions.';

-- 3b. Not today: the person moves a one-time task's due day.
CREATE OR REPLACE FUNCTION public.task_move_day(p_instance_id uuid, p_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item uuid;
  v_repeat text;
  v_start date;
  v_done timestamptz;
  v_old date;
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  PERFORM public.task_doer_may(p_instance_id, 'move this task');
  IF p_day IS NULL THEN
    RAISE EXCEPTION 'Pick a day.' USING ERRCODE = '22023';
  END IF;

  SELECT i.checklist_item_id, it.repeat_type, it.start_date, i.completed_at, it.due_date
    INTO v_item, v_repeat, v_start, v_done, v_old
  FROM public.checklist_instances i
  JOIN public.checklist_items it ON it.id = i.checklist_item_id
  WHERE i.id = p_instance_id;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'That task is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF v_done IS NOT NULL THEN
    RAISE EXCEPTION 'This task is already done.' USING ERRCODE = '23505';
  END IF;
  IF v_repeat <> 'once' THEN
    RAISE EXCEPTION 'Only a one-time task can be moved to another day.' USING ERRCODE = '22023';
  END IF;
  IF p_day < v_today OR p_day < v_start THEN
    RAISE EXCEPTION 'Pick today or a later day.' USING ERRCODE = '22023';
  END IF;
  IF p_day > v_today + 366 THEN
    RAISE EXCEPTION 'Pick a day within a year.' USING ERRCODE = '22023';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_day THEN
    RAISE EXCEPTION 'This task is already due that day.' USING ERRCODE = '23505';
  END IF;

  -- record_checklist_due_change writes the change's row, with auth.uid() as who.
  UPDATE public.checklist_items SET due_date = p_day WHERE id = v_item;
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body)
  VALUES (p_instance_id, 'moved', auth.uid(), to_char(p_day, 'YYYY-MM-DD'));
  RETURN jsonb_build_object('ok', true, 'due', to_char(p_day, 'YYYY-MM-DD'), 'from', to_char(v_old, 'YYYY-MM-DD'));
END;
$$;
REVOKE ALL ON FUNCTION public.task_move_day(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_move_day(uuid, date) TO authenticated;
COMMENT ON FUNCTION public.task_move_day(uuid, date) IS 'Task Mode tools (#369): the person doing a one-time task moves its due day to today or later, within a year. Writes checklist_items.due_date (logged by record_checklist_due_change) and a moved line in the thread. The day row does not move.';

-- 3c. No longer applies: the person closes a one-time task without doing it, and says why.
CREATE OR REPLACE FUNCTION public.task_no_longer_applies(p_instance_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item uuid;
  v_repeat text;
  v_task uuid;
  v_done timestamptz;
  v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p_reason, ''), '\s+', ' ', 'g')), 200), '');
BEGIN
  PERFORM public.task_doer_may(p_instance_id, 'close this task');
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Say why in a few words.' USING ERRCODE = '22023';
  END IF;

  SELECT i.checklist_item_id, it.repeat_type, it.roadmap_group_task_id, i.completed_at
    INTO v_item, v_repeat, v_task, v_done
  FROM public.checklist_instances i
  JOIN public.checklist_items it ON it.id = i.checklist_item_id
  WHERE i.id = p_instance_id;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'That task is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF v_done IS NOT NULL THEN
    RAISE EXCEPTION 'This task is already done.' USING ERRCODE = '23505';
  END IF;
  IF v_repeat <> 'once' THEN
    RAISE EXCEPTION 'A task that repeats is taken off by whoever gave it. Say why in a note.' USING ERRCODE = '22023';
  END IF;
  IF v_task IS NOT NULL THEN
    RAISE EXCEPTION 'This task belongs to a roadmap, and its lead takes it off there. Say why in a note.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vehicle_maintenance_tasks v WHERE v.checklist_instance_id = p_instance_id) THEN
    RAISE EXCEPTION 'This is a vehicle task, and the office closes it. Say why in a note.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.checklist_instances
  SET completed_at = now(), completed_by_user_id = auth.uid()
  WHERE id = p_instance_id AND completed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This task is already done.' USING ERRCODE = '23505';
  END IF;
  -- The transitions trigger has just written the completed line at the transaction's time. This one is stamped by the
  -- clock, so it is the later of the two and the thread reads: completed, then why it was closed.
  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body, created_at)
  VALUES (p_instance_id, 'dropped', auth.uid(), v_reason, clock_timestamp());
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.task_no_longer_applies(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_no_longer_applies(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.task_no_longer_applies(uuid, text) IS 'Task Mode tools (#369): the person doing a one-time task closes it without doing it, with a reason of 3 to 200 characters. Sets the day row complete and writes a dropped line after the completed one. Refused for a repeating task, a roadmap task and a vehicle task, whose completions mean something else. Whoever gave the task reopens it to put it back.';

-- 3d. Hand it on: one person for another on the same task.
CREATE OR REPLACE FUNCTION public.task_hand_on(p_instance_id uuid, p_to uuid, p_reason text DEFAULT NULL, p_from uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item uuid;
  v_repeat text;
  v_task uuid;
  v_done timestamptz;
  v_from uuid := COALESCE(p_from, auth.uid());
  v_to_name text;
  v_reason text := NULLIF(left(btrim(regexp_replace(COALESCE(p_reason, ''), '\s+', ' ', 'g')), 200), '');
BEGIN
  PERFORM public.task_doer_may(p_instance_id, 'hand this task on');
  IF v_from <> auth.uid() AND NOT public.is_dev_or_master_or_assistant() THEN
    RAISE EXCEPTION 'Only the office hands on a task for someone else.' USING ERRCODE = '42501';
  END IF;
  IF p_to IS NULL OR p_to = v_from THEN
    RAISE EXCEPTION 'Pick someone else to take it.' USING ERRCODE = '22023';
  END IF;
  SELECT NULLIF(btrim(u.name), '') INTO v_to_name
  FROM public.users u
  WHERE u.id = p_to AND u.archived_at IS NULL AND u.is_digital_twin = false AND u.is_sample = false AND u.is_walk_tester = false AND u.login_attached_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person cannot take a task in the app.' USING ERRCODE = '22023';
  END IF;

  SELECT i.checklist_item_id, it.repeat_type, it.roadmap_group_task_id, i.completed_at
    INTO v_item, v_repeat, v_task, v_done
  FROM public.checklist_instances i
  JOIN public.checklist_items it ON it.id = i.checklist_item_id
  WHERE i.id = p_instance_id;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'That task is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF v_done IS NOT NULL THEN
    RAISE EXCEPTION 'This task is already done.' USING ERRCODE = '23505';
  END IF;
  IF v_task IS NOT NULL THEN
    RAISE EXCEPTION 'This task belongs to a roadmap. It is handed on from the Roadmap.' USING ERRCODE = '22023';
  END IF;

  -- The day row first. Nothing to take away means the person named does not have this task.
  DELETE FROM public.checklist_instance_assignees WHERE checklist_instance_id = p_instance_id AND user_id = v_from;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person does not have this task.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id) VALUES (p_instance_id, p_to)
  ON CONFLICT DO NOTHING;
  -- A one-time task moves whole. A repeating one keeps its people and gives away this day alone.
  IF v_repeat = 'once' THEN
    DELETE FROM public.checklist_item_assignees WHERE checklist_item_id = v_item AND user_id = v_from;
    INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id, display_order)
    SELECT v_item, p_to, COALESCE(max(a.display_order) FILTER (WHERE a.display_order < 999999), 0) + 1
    FROM public.checklist_item_assignees a WHERE a.user_id = p_to
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body)
  VALUES (p_instance_id, 'handed', auth.uid(), COALESCE(v_to_name, 'Someone') || CASE WHEN v_reason IS NULL THEN '' ELSE ': ' || v_reason END);
  RETURN jsonb_build_object('ok', true, 'to_name', COALESCE(v_to_name, 'Someone'), 'whole', v_repeat = 'once');
END;
$$;
REVOKE ALL ON FUNCTION public.task_hand_on(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_hand_on(uuid, uuid, text, uuid) TO authenticated;
COMMENT ON FUNCTION public.task_hand_on(uuid, uuid, text, uuid) IS 'Task Mode tools (#369): one person for another on the same open task, so its thread, place, lines and photos stay. The caller hands on their own task; the office may name whose (p_from). The taker is an active person who can sign in. A one-time task moves whole; a repeating task gives away this day row alone; a roadmap task is refused. Writes a handed line: who to, then why.';

-- 3e. A map from the person doing the task, on a task that has none.
CREATE OR REPLACE FUNCTION public.task_add_map(p_instance_id uuid, p_map_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item uuid;
  v_task uuid;
  v_map_name text;
  v_map_by uuid;
BEGIN
  PERFORM public.task_doer_may(p_instance_id, 'put a map on this task');
  SELECT m.name, m.created_by INTO v_map_name, v_map_by FROM public.painted_maps m WHERE m.id = p_map_id;
  IF NOT FOUND OR (v_map_by IS DISTINCT FROM auth.uid() AND NOT public.is_dev_or_master_or_assistant()) THEN
    RAISE EXCEPTION 'That map is not one you painted.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.painted_map_lines l WHERE l.map_id = p_map_id)
     AND NOT EXISTS (SELECT 1 FROM public.painted_map_places p WHERE p.map_id = p_map_id) THEN
    RAISE EXCEPTION 'Draw a line or leave a place on the map first.' USING ERRCODE = '22023';
  END IF;

  SELECT i.checklist_item_id, it.roadmap_group_task_id INTO v_item, v_task
  FROM public.checklist_instances i
  JOIN public.checklist_items it ON it.id = i.checklist_item_id
  WHERE i.id = p_instance_id;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'That task is gone.' USING ERRCODE = 'P0002';
  END IF;

  -- A roadmap task carries its own map, as it carries its own place (20261115063000).
  IF v_task IS NOT NULL THEN
    UPDATE public.checklist_tech_tree_group_tasks SET painted_map_id = p_map_id WHERE id = v_task AND painted_map_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This task already has a map. Open it and add to it.' USING ERRCODE = '23505';
    END IF;
  ELSE
    UPDATE public.checklist_items SET painted_map_id = p_map_id WHERE id = v_item AND painted_map_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This task already has a map. Open it and add to it.' USING ERRCODE = '23505';
    END IF;
  END IF;

  INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body)
  VALUES (p_instance_id, 'map', auth.uid(), left(COALESCE(v_map_name, ''), 120));
  RETURN jsonb_build_object('ok', true, 'on', CASE WHEN v_task IS NOT NULL THEN 'roadmap' ELSE 'item' END);
END;
$$;
REVOKE ALL ON FUNCTION public.task_add_map(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_add_map(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.task_add_map(uuid, uuid) IS 'Task Mode tools (#369): the person doing a task puts a painted map on it, when the task has none. The map is one the caller painted (or the office names), with a line or a place on it. Lands on checklist_items, or on the roadmap task behind the row. Cannot swap or clear a map. Writes a map line with the map''s name.';
