-- Extend can_access_project_via_workflow to allow superintendents with project-level access
-- (project_superintendents or master_superintendents via can_access_project_row).
-- Superintendents assigned to projects can then see all workflow stages for those projects.

CREATE OR REPLACE FUNCTION public.can_access_project_via_workflow(workflow_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  project_id_val UUID;
BEGIN
  SELECT pw.project_id
  INTO project_id_val
  FROM public.project_workflows pw
  WHERE pw.id = workflow_id_param;

  IF project_id_val IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    public.can_access_project(project_id_val)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
      AND public.can_access_project_row(project_id_val)
    )
  );
END;
$$;
COMMENT ON FUNCTION public.can_access_project_via_workflow(UUID) IS 'Checks if the current user can access a project via a workflow. Includes superintendent with project-level access (can_access_project_row). Uses SECURITY DEFINER.';

-- Also extend can_access_project_via_step for workflow_step_line_items and other step-based checks
CREATE OR REPLACE FUNCTION public.can_access_project_via_step(step_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  project_id_val UUID;
  project_master_id_val UUID;
  user_role_val TEXT;
BEGIN
  SELECT p.id, p.master_user_id, u.role
  INTO project_id_val, project_master_id_val, user_role_val
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;
  
  IF project_master_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN (
    project_master_id_val = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    OR public.master_adopted_current_user(project_master_id_val)
    OR public.master_shared_current_user(project_master_id_val)
    OR (
      user_role_val = 'superintendent'
      AND project_id_val IS NOT NULL
      AND public.can_access_project_row(project_id_val)
    )
  );
END;
$$;
COMMENT ON FUNCTION public.can_access_project_via_step(UUID) IS 'Checks if the current user can access a project via a workflow step. Includes superintendent with project-level access (can_access_project_row). Uses SECURITY DEFINER.';
