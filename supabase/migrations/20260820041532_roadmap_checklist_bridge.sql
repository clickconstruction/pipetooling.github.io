SET lock_timeout = '3s';

-- Roadmap ⇄ checklist bridge (Phase R1 of the roadmap integration, v2.1875).
--
-- Roadmap group tasks (checklist_tech_tree_group_tasks) were a world apart from
-- people's real checklists: assignment was decorative, completion lived on a
-- dev-only canvas. This migration makes the roadmap FEED the checklist:
--
--   1. checklist_items.roadmap_group_task_id — a roadmap-born checklist item
--      remembers which roadmap task it materializes (ON DELETE SET NULL: if
--      the roadmap task is deleted the item survives as an ordinary task,
--      keeping its history).
--   2. sync_roadmap_to_checklist(p_roadmap_id) — SECURITY DEFINER RPC that
--      recomputes group completeness (a group is complete when it has >= 1
--      task and none incomplete — mirrors checklistTechTreeGraph.isGroupComplete)
--      and unlock state (no incoming edges, or every predecessor complete —
--      mirrors computeUnlockedGroupIds), then materializes every ASSIGNED,
--      INCOMPLETE task in an UNLOCKED group that has no live item yet:
--      one checklist_item (repeat 'once', show_until_completed so it carries
--      over) + today's instance + assignees copied from the roadmap task.
--      Idempotent; returns {"created": n}.
--   3. sync_roadmap_task_from_instance_au — AFTER UPDATE trigger on
--      checklist_instances: completing a bridged instance completes the
--      roadmap task; reopening clears it (so a lead's reopen walks the stage
--      back). Trigger is SECURITY DEFINER-equivalent (owned by postgres).

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS roadmap_group_task_id uuid
  REFERENCES public.checklist_tech_tree_group_tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.checklist_items.roadmap_group_task_id IS
  'Set when this item materializes a roadmap (tech tree) task. Items with this set are edited from the Roadmap tab; instance completion syncs back to the roadmap task.';

CREATE INDEX IF NOT EXISTS checklist_items_roadmap_task_idx
  ON public.checklist_items (roadmap_group_task_id)
  WHERE roadmap_group_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_roadmap_task_from_instance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
BEGIN
  IF (OLD.completed_at IS NULL) = (NEW.completed_at IS NULL) THEN
    RETURN NEW;
  END IF;
  SELECT i.roadmap_group_task_id INTO v_task_id
  FROM public.checklist_items i
  WHERE i.id = NEW.checklist_item_id AND i.roadmap_group_task_id IS NOT NULL;
  IF v_task_id IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    IF NEW.completed_at IS NOT NULL THEN
      UPDATE public.checklist_tech_tree_group_tasks
      SET completed_at = NEW.completed_at, completed_by_user_id = NEW.completed_by_user_id
      WHERE id = v_task_id;
    ELSE
      UPDATE public.checklist_tech_tree_group_tasks
      SET completed_at = NULL, completed_by_user_id = NULL
      WHERE id = v_task_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'roadmap task sync failed for instance %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_roadmap_task_from_instance_au ON public.checklist_instances;
CREATE TRIGGER sync_roadmap_task_from_instance_au
  AFTER UPDATE OF completed_at ON public.checklist_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_roadmap_task_from_instance();

CREATE OR REPLACE FUNCTION public.sync_roadmap_to_checklist(p_roadmap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_item_id uuid;
  v_instance_id uuid;
  v_created int := 0;
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (public.is_dev() OR public.can_edit_checklist_tech_tree_structure_for_roadmap(p_roadmap_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized for this roadmap');
  END IF;

  -- complete groups: >= 1 task, none incomplete. unlocked: no incoming edges,
  -- or every predecessor complete. assigned, incomplete, unbridged tasks in
  -- unlocked groups materialize.
  FOR r IN
    WITH grp AS (
      SELECT g.id
      FROM public.checklist_tech_tree_groups g
      WHERE g.roadmap_id = p_roadmap_id
    ),
    complete_groups AS (
      SELECT g.id
      FROM grp g
      WHERE EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.group_id = g.id)
        AND NOT EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.group_id = g.id AND t.completed_at IS NULL)
    ),
    unlocked AS (
      SELECT g.id
      FROM grp g
      WHERE NOT EXISTS (
        SELECT 1 FROM public.checklist_tech_tree_edges e
        WHERE e.to_group_id = g.id
          AND e.from_group_id NOT IN (SELECT id FROM complete_groups)
      )
    )
    SELECT t.id AS task_id, t.title
    FROM public.checklist_tech_tree_group_tasks t
    JOIN unlocked u ON u.id = t.group_id
    WHERE t.completed_at IS NULL
      AND EXISTS (SELECT 1 FROM public.checklist_tech_tree_task_assignees a WHERE a.task_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.roadmap_group_task_id = t.id)
  LOOP
    INSERT INTO public.checklist_items
      (title, created_by_user_id, start_date, repeat_type, show_until_completed, notify_creator_on_complete, roadmap_group_task_id)
    VALUES
      (r.title, auth.uid(), v_today, 'once', true, false, r.task_id)
    RETURNING id INTO v_item_id;

    INSERT INTO public.checklist_item_assignees (checklist_item_id, user_id)
    SELECT v_item_id, a.user_id
    FROM public.checklist_tech_tree_task_assignees a
    WHERE a.task_id = r.task_id
    ON CONFLICT DO NOTHING;

    INSERT INTO public.checklist_instances (checklist_item_id, scheduled_date)
    VALUES (v_item_id, v_today)
    RETURNING id INTO v_instance_id;

    INSERT INTO public.checklist_instance_assignees (checklist_instance_id, user_id)
    SELECT v_instance_id, a.user_id
    FROM public.checklist_tech_tree_task_assignees a
    WHERE a.task_id = r.task_id
    ON CONFLICT DO NOTHING;

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_roadmap_to_checklist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_roadmap_to_checklist(uuid) TO authenticated;

COMMENT ON FUNCTION public.sync_roadmap_to_checklist(uuid) IS
  'Materializes assigned, incomplete roadmap tasks in UNLOCKED groups as one-off checklist items + today instances (idempotent). Dev or roadmap editor only. Companion trigger sync_roadmap_task_from_instance_au syncs completion back.';
