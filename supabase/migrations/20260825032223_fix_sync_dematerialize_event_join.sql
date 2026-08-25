SET lock_timeout = '3s';

-- Fix 20260825024351: the de-materialize sweep joined
-- checklist_instance_events on a column that does not exist
-- (checklist_instance_id → the real name is instance_id). plpgsql bodies are
-- not validated at CREATE, so every sync errored at runtime from the moment
-- the previous migration was applied until this one. Body otherwise identical.

-- Rebuilt sync: adds (a) the sequential materialization gate and (b) a
-- de-materialization sweep pulling not-yet-due tasks back off lists.
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
  v_removed int := 0;
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

  -- De-materialize: in sequential groups, a not-yet-due task (an earlier
  -- sibling is still incomplete) comes back OFF lists — unless any of its
  -- instances is completed/reviewed or carries a comment (never destroy a
  -- thread; those grandfathered items stay until their turn anyway).
  WITH waiting AS (
    SELECT t.id AS task_id
    FROM public.checklist_tech_tree_group_tasks t
    JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
    WHERE g.roadmap_id = p_roadmap_id
      AND g.sequential
      AND t.completed_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.checklist_tech_tree_group_tasks p
        WHERE p.group_id = t.group_id
          AND p.completed_at IS NULL
          AND (p.sort_index < t.sort_index OR (p.sort_index = t.sort_index AND p.id < t.id))
      )
  ),
  doomed AS (
    SELECT i.id
    FROM public.checklist_items i
    JOIN waiting w ON w.task_id = i.roadmap_group_task_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.checklist_instances ci
        WHERE ci.checklist_item_id = i.id
          AND (ci.completed_at IS NOT NULL OR ci.reviewed_at IS NOT NULL)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.checklist_instances ci2
        JOIN public.checklist_instance_events ev ON ev.instance_id = ci2.id
        WHERE ci2.checklist_item_id = i.id
          AND ev.event_type = 'comment'
      )
  ),
  deleted AS (
    DELETE FROM public.checklist_items i
    USING doomed d
    WHERE i.id = d.id
    RETURNING i.id
  )
  SELECT count(*) INTO v_removed FROM deleted;

  -- Materialize: assigned, incomplete, unbridged tasks in unlocked groups —
  -- and, in sequential groups, only while no earlier sibling is open.
  FOR r IN
    WITH grp AS (
      SELECT g.id, g.sequential
      FROM public.checklist_tech_tree_groups g
      WHERE g.roadmap_id = p_roadmap_id
    ),
    unlocked AS (
      SELECT g.id, g.sequential
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
      AND (
        NOT u.sequential
        OR NOT EXISTS (
          SELECT 1 FROM public.checklist_tech_tree_group_tasks p
          WHERE p.group_id = t.group_id
            AND p.completed_at IS NULL
            AND (p.sort_index < t.sort_index OR (p.sort_index = t.sort_index AND p.id < t.id))
        )
      )
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

  RETURN jsonb_build_object('ok', true, 'created', v_created, 'removed', v_removed);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_roadmap_to_checklist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_roadmap_to_checklist(uuid) TO authenticated;

COMMENT ON FUNCTION public.sync_roadmap_to_checklist(uuid) IS
  'Materializes assigned, incomplete roadmap tasks in UNLOCKED groups as one-off checklist items + today instances (idempotent). Sequential groups (default) surface one task at a time in sort_index order and pull not-yet-due tasks back off lists (threads/completions are never deleted). Milestone-aware since v2.1913. Dev or roadmap editor only.';

