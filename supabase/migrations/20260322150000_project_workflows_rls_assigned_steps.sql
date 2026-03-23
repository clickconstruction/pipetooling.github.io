-- Allow users to see project_workflows and projects when they have a step assigned to them.
-- Fixes Dashboard "Projects: Assigned Stages" for subcontractors/assistants who can see
-- their assigned steps (via RPC) but were blocked from fetching workflow/project metadata
-- because RLS only allowed can_access_project (owner/adopted/shared).

-- project_workflows: allow SELECT when user has assigned step in this workflow
DROP POLICY IF EXISTS "Users can see workflows they have access to" ON public.project_workflows;
CREATE POLICY "Users can see workflows they have access to"
ON public.project_workflows
FOR SELECT
USING (
  public.can_access_project(project_id)
  OR (
    EXISTS (
      SELECT 1 FROM public.project_workflow_steps s
      JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
        AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
      WHERE s.workflow_id = project_workflows.id
        AND s.assigned_to_name IS NOT NULL
    )
  )
);

-- projects: allow SELECT when user has assigned step in a workflow of this project
DROP POLICY IF EXISTS "Users can see projects they have access to" ON public.projects;
CREATE POLICY "Users can see projects they have access to"
ON public.projects
FOR SELECT
USING (
  public.can_access_project_row(id)
  OR (
    EXISTS (
      SELECT 1 FROM public.project_workflows pw
      JOIN public.project_workflow_steps s ON s.workflow_id = pw.id
      JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
        AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
      WHERE pw.project_id = projects.id
        AND s.assigned_to_name IS NOT NULL
    )
  )
);
