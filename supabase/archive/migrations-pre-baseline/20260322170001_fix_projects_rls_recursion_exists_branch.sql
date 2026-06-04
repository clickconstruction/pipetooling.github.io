-- Fix infinite recursion in projects RLS: the EXISTS branch.
--
-- The projects policy has: can_access_project_row(id,...) OR EXISTS(project_workflows...).
-- Evaluating the EXISTS reads project_workflows. project_workflows RLS calls
-- can_access_project(project_id), which does SELECT FROM projects. That triggers
-- projects RLS again → infinite recursion.
--
-- Fix: Replace the inline EXISTS with a SECURITY DEFINER function. The function
-- owner (postgres) bypasses RLS, so the internal reads of project_workflows and
-- project_workflow_steps do not trigger their RLS and thus never reach projects.

CREATE OR REPLACE FUNCTION public.user_has_assigned_step_in_project(project_id_param UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_workflows pw
    JOIN public.project_workflow_steps s ON s.workflow_id = pw.id
    JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
      AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
    WHERE pw.project_id = project_id_param
      AND s.assigned_to_name IS NOT NULL
  );
$$;
COMMENT ON FUNCTION public.user_has_assigned_step_in_project(UUID) IS 'Checks if current user has an assigned step in any workflow of this project. SECURITY DEFINER to bypass RLS and avoid projects recursion.';

-- Update projects SELECT policy: use the helper instead of inline EXISTS
DROP POLICY IF EXISTS "Users can see projects they have access to" ON public.projects;
CREATE POLICY "Users can see projects they have access to"
ON public.projects
FOR SELECT
USING (
  public.can_access_project_row(id, master_user_id, customer_id)
  OR public.user_has_assigned_step_in_project(id)
);
