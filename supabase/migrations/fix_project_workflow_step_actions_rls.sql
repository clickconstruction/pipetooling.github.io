-- Fix RLS policies for project_workflow_step_actions table
-- Allows authenticated users to insert actions for steps they have access to
-- Allows users to read actions for steps they have access to
--
-- Uses helper function to optimize performance and avoid recursion

-- Drop existing policies if they exist
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_workflow_step_actions'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_workflow_step_actions', r.policyname);
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.project_workflow_step_actions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access a step (for actions)
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
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
BEGIN
  -- Get step and project info, plus user info in one query
  SELECT p.master_user_id, u.role, u.name, s.assigned_to_name 
  INTO project_master_id, user_role_val, user_name_val, step_assigned_to
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;
  
  -- If no step found, return false
  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check access: user owns project OR is dev/master OR master adopted them OR is assigned to step
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
  );
END;
$$;

-- SELECT policy: Users can read actions for steps they have access to
CREATE POLICY "Users can read actions for steps they have access to"
ON public.project_workflow_step_actions
FOR SELECT
USING (
  public.can_access_step_for_action(step_id)
);

-- INSERT policy: Authenticated users can insert actions for steps they have access to
CREATE POLICY "Authenticated users can insert actions for accessible steps"
ON public.project_workflow_step_actions
FOR INSERT
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL
  -- AND user can access the step
  AND public.can_access_step_for_action(step_id)
);

-- Add comments
COMMENT ON FUNCTION public.can_access_step_for_action(UUID) IS 'Checks if the current user can access a step for recording actions. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
COMMENT ON TABLE public.project_workflow_step_actions IS 'Action history ledger for workflow steps. Authenticated users can insert actions for steps they have access to. RLS policies use helper functions to optimize performance.';
