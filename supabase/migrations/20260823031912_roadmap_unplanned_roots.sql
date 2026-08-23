SET lock_timeout = '3s';

-- Roadmap: a task-less stage with NO prerequisites is "not planned yet", not a
-- reached milestone.
--
-- v2.1913 made task-less stages milestones that complete once every
-- predecessor completes — vacuously true for empty ROOT stages, so a stage
-- nobody had touched (no tasks, nothing leading into it) read "✓ reached" and
-- unlocked everything behind it. Owner decision (2026-08-22): such a stage is
-- neither complete nor a milestone until it gets tasks or a predecessor.
--
-- Change: the milestone fixpoint now requires at least one incoming edge.
-- Stages WITH tasks and milestones WITH predecessors behave exactly as before
-- (the lock-trap fix stays intact). Dependents of an unplanned root stay locked
-- until it is planned — consistent with the client.
--
-- Mirrors computeCompleteGroupIdsWithMilestones in
-- src/lib/checklistTechTreeGraph.ts — keep the two in sync.

CREATE OR REPLACE FUNCTION public.sync_roadmap_to_checklist(p_roadmap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_item_id uuid;
  v_instance_id uuid;
  v_created int := 0;
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_complete uuid[];
  v_new uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (public.is_dev() OR public.can_edit_checklist_tech_tree_structure_for_roadmap(p_roadmap_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized for this roadmap');
  END IF;

  -- Seed: task-bearing groups with every task done.
  SELECT COALESCE(array_agg(g.id), '{}') INTO v_complete
  FROM public.checklist_tech_tree_groups g
  WHERE g.roadmap_id = p_roadmap_id
    AND EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.group_id = g.id)
    AND NOT EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.group_id = g.id AND t.completed_at IS NULL);

  -- Fixpoint: empty (milestone) groups WITH at least one predecessor whose
  -- predecessors are all complete. Empty groups with no predecessors are
  -- "not planned yet" and never enter v_complete.
  LOOP
    SELECT COALESCE(array_agg(g.id), '{}') INTO v_new
    FROM public.checklist_tech_tree_groups g
    WHERE g.roadmap_id = p_roadmap_id
      AND NOT (g.id = ANY (v_complete))
      AND NOT EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.group_id = g.id)
      AND EXISTS (SELECT 1 FROM public.checklist_tech_tree_edges e WHERE e.to_group_id = g.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.checklist_tech_tree_edges e
        WHERE e.to_group_id = g.id
          AND NOT (e.from_group_id = ANY (v_complete))
      );
    EXIT WHEN COALESCE(array_length(v_new, 1), 0) = 0;
    v_complete := v_complete || v_new;
  END LOOP;

  -- Unlocked: no incoming edges, or every predecessor complete. Assigned,
  -- incomplete, unbridged tasks in unlocked groups materialize.
  FOR r IN
    WITH grp AS (
      SELECT g.id
      FROM public.checklist_tech_tree_groups g
      WHERE g.roadmap_id = p_roadmap_id
    ),
    unlocked AS (
      SELECT g.id
      FROM grp g
      WHERE NOT EXISTS (
        SELECT 1 FROM public.checklist_tech_tree_edges e
        WHERE e.to_group_id = g.id
          AND NOT (e.from_group_id = ANY (v_complete))
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
  'Materializes assigned, incomplete roadmap tasks in UNLOCKED groups as one-off checklist items + today instances (idempotent). Milestone-aware since v2.1913: task-less groups WITH predecessors count complete when all predecessors are; task-less groups with NO predecessors are "not planned yet" and never count complete. Dev or roadmap editor only.';
