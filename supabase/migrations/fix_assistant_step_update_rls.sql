-- Fix RLS policy for assistant step updates
-- The USING clause was too restrictive - it only allowed assistants to update steps
-- where their name matched assigned_to_name. This prevented assistants from updating
-- steps when changing assigned_to_name or updating other fields on steps not assigned to them.
-- 
-- The fix: Allow assistants who can access the workflow to update any step in that workflow,
-- not just steps assigned to them by name.

DROP POLICY IF EXISTS "Users can update steps for workflows they have access to" ON public.project_workflow_steps;

CREATE POLICY "Users can update steps for workflows they have access to"
ON public.project_workflow_steps
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  OR (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('assistant', 'subcontractor')
        AND name IS NOT NULL
        AND LOWER(TRIM(users.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'assistant'
    )
    AND public.can_access_project_via_workflow(workflow_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'assistant'
    )
    AND public.can_access_project_via_workflow(workflow_id)
  )
);
