SET lock_timeout = '3s';

-- HOTFIX (v2.1950): every UPDATE on checklist_tech_tree_group_tasks 500s
-- with 42P17 — the table's UPDATE policy's assignee OR-branch queries
-- checklist_tech_tree_task_assignees, whose OWN select policy joins
-- checklist_tech_tree_group_tasks back. Broke the roadmap task card's Save
-- (old fold + new inline rename) for everyone; assignee-only writes were
-- unaffected. Surfaced verifying the v2.1949 task-card redesign.
--
-- The house pattern for exactly this (see 20260802010000, the v2.1225
-- people_labor_jobs fix): a SECURITY DEFINER helper evaluates the junction
-- WITHOUT invoking RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION public.user_is_assignee_of_tech_tree_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_tech_tree_task_assignees a
    WHERE a.task_id = p_task_id
      AND a.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_is_assignee_of_tech_tree_task(uuid) IS
  'RLS helper: is the caller an assignee of this tech-tree task? SECURITY DEFINER to avoid the checklist_tech_tree_group_tasks <-> checklist_tech_tree_task_assignees policy recursion.';

GRANT ALL ON FUNCTION public.user_is_assignee_of_tech_tree_task(uuid) TO anon;
GRANT ALL ON FUNCTION public.user_is_assignee_of_tech_tree_task(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_is_assignee_of_tech_tree_task(uuid) TO service_role;

-- Same grants as before: structure editors of the roadmap, or an assignee of
-- the task who can at least see the roadmap.
DROP POLICY IF EXISTS "checklist_tech_tree_group_tasks update" ON public.checklist_tech_tree_group_tasks;
CREATE POLICY "checklist_tech_tree_group_tasks update" ON public.checklist_tech_tree_group_tasks
  FOR UPDATE TO authenticated
  USING ((EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups g
    WHERE g.id = checklist_tech_tree_group_tasks.group_id
      AND (
        public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
        OR (
          public.user_is_assignee_of_tech_tree_task(checklist_tech_tree_group_tasks.id)
          AND public.can_select_checklist_tech_tree_roadmap(g.roadmap_id)
        )
      )
  )))
  WITH CHECK ((EXISTS (
    SELECT 1 FROM public.checklist_tech_tree_groups g
    WHERE g.id = checklist_tech_tree_group_tasks.group_id
      AND (
        public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
        OR (
          public.user_is_assignee_of_tech_tree_task(checklist_tech_tree_group_tasks.id)
          AND public.can_select_checklist_tech_tree_roadmap(g.roadmap_id)
        )
      )
  )));
