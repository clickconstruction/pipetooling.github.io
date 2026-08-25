SET lock_timeout = '3s';

-- Task assignees can read their roadmap's structure (v2.2261 stage-context
-- chip): field roles assigned a roadmap task previously failed every
-- checklist_tech_tree_* SELECT policy, so their task cards fell back to a
-- bare "⛰ goal" with no stage or roadmap name. Assignment now grants read —
-- the same assignment-grants-access shape as project_superintendents.
-- This capability fn backs the SELECT policies on roadmaps, members, groups,
-- group_tasks, and edges, so one replace broadens them consistently.
CREATE OR REPLACE FUNCTION "public"."can_select_checklist_tech_tree_roadmap"("p_roadmap_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_checklist_tech_tree_staff_or_primary()
  OR EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_roadmap_members m
    WHERE m.roadmap_id = p_roadmap_id
      AND m.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.checklist_tech_tree_task_assignees a
    JOIN public.checklist_tech_tree_group_tasks t ON t.id = a.task_id
    JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
    WHERE g.roadmap_id = p_roadmap_id
      AND a.user_id = auth.uid()
  );
$$;
