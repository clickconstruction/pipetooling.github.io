-- Optimize workflow_step_line_items RLS policies to prevent timeout errors
-- The current policies use expensive EXISTS checks with joins that cause statement timeouts
--
-- Solution: Use helper functions (is_dev, master_adopted_current_user) to avoid recursion
-- and optimize the access checks

-- Drop existing policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_step_line_items'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.workflow_step_line_items', r.policyname);
  END LOOP;
END $$;

-- Ensure RLS remains enabled
ALTER TABLE public.workflow_step_line_items ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user can access a project via step -> workflow -> project
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION public.can_access_project_via_step(step_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  project_master_id UUID;
  user_role_val TEXT;
BEGIN
  -- Get project master_user_id and user role in one query
  SELECT p.master_user_id, u.role INTO project_master_id, user_role_val
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;
  
  -- If no project found, return false
  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check access: user owns project OR is dev/master OR master adopted them
  RETURN (
    project_master_id = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    OR public.master_adopted_current_user(project_master_id)
  );
END;
$$;

-- SELECT policy: devs, masters, and assistants can read line items for steps on projects they can access
CREATE POLICY "Owners, masters, and assistants can read line items with adoption"
ON public.workflow_step_line_items
FOR SELECT
USING (
  -- Check if user is dev/master/assistant
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  -- AND check if they can access the project via the step
  AND public.can_access_project_via_step(step_id)
);

-- INSERT policy: devs, masters, and assistants can insert line items for steps on projects they can access
CREATE POLICY "Owners, masters, and assistants can insert line items with adoption"
ON public.workflow_step_line_items
FOR INSERT
WITH CHECK (
  -- Check if user is dev/master/assistant
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  -- AND check if they can access the project via the step
  AND public.can_access_project_via_step(step_id)
);

-- UPDATE policy: devs, masters, and assistants can update line items for steps on projects they can access
CREATE POLICY "Owners, masters, and assistants can update line items with adoption"
ON public.workflow_step_line_items
FOR UPDATE
USING (
  -- Check if user is dev/master/assistant
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  -- AND check if they can access the project via the step
  AND public.can_access_project_via_step(step_id)
)
WITH CHECK (
  -- Check if user is dev/master/assistant
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  -- AND check if they can access the project via the step
  AND public.can_access_project_via_step(step_id)
);

-- DELETE policy: only devs and masters can delete line items
CREATE POLICY "Owners and masters can delete line items with adoption"
ON public.workflow_step_line_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  -- AND check if they can access the project via the step
  AND public.can_access_project_via_step(step_id)
);

-- Add comments
COMMENT ON FUNCTION public.can_access_project_via_step(UUID) IS 'Checks if the current user can access a project via a workflow step. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
COMMENT ON TABLE public.workflow_step_line_items IS 'Line items for workflow steps. RLS policies use helper functions to optimize performance and avoid recursion.';
