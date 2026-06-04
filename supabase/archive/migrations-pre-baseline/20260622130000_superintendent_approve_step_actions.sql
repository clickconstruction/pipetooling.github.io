-- Allow superintendents to record workflow step actions (Approve, Send Back) when they have workflow access.
-- Superintendents can Approve/Reject on the Workflow page; can_access_step_for_action must allow
-- them to INSERT into project_workflow_step_actions for the action ledger.

CREATE OR REPLACE FUNCTION public.can_access_step_for_action(step_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  project_master_id UUID;
  user_role_val TEXT;
  user_name_val TEXT;
  step_assigned_to TEXT;
  workflow_id_var UUID;
BEGIN
  -- Get step and project info, plus user info in one query
  SELECT p.master_user_id, u.role, u.name, s.assigned_to_name, pw.id
  INTO project_master_id, user_role_val, user_name_val, step_assigned_to, workflow_id_var
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;

  -- If no step found, return false
  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check access: user owns project OR is dev/master OR master adopted them OR is assigned to step OR superintendent with workflow access
  RETURN (
    project_master_id = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    OR public.master_adopted_current_user(project_master_id)
    OR (
      step_assigned_to IS NOT NULL
      AND user_name_val IS NOT NULL
      AND user_role_val IN ('assistant', 'subcontractor')
      AND LOWER(TRIM(user_name_val)) = LOWER(TRIM(step_assigned_to))
    )
    OR (
      user_role_val = 'superintendent'
      AND public.can_access_project_via_workflow(workflow_id_var)
    )
  );
END;
$$;
COMMENT ON FUNCTION public.can_access_step_for_action(UUID) IS 'Checks if the current user can access a step for recording actions. Includes superintendent with workflow access. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
