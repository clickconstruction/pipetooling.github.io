-- Subcontractors can UPDATE workflow steps assigned to them (Mark Complete / Set Start) when their
-- users.name matches assigned_to_name. SELECT already allowed this; UPDATE was previously staff-only
-- (see migration 20260520120004_workflow_rls_superintendent.sql), so Mark Complete silently updated 0 rows.

CREATE POLICY "Subcontractors can update their assigned project_workflow_steps"
  ON public.project_workflow_steps
  FOR UPDATE
  USING (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'subcontractor'
        AND u.name IS NOT NULL
        AND LOWER(TRIM(u.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
  WITH CHECK (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'subcontractor'
        AND u.name IS NOT NULL
        AND LOWER(TRIM(u.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  );

COMMENT ON POLICY "Subcontractors can update their assigned project_workflow_steps" ON public.project_workflow_steps IS
  'Matches subcontractor SELECT on assigned_to_name so Dashboard Assigned Stages can mark complete / set started.';
