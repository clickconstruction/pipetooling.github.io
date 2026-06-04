-- Add superintendent to workflow RLS policies
-- Superintendents get adoption-based access (via master_adopted_current_user in can_access_project_via_step)
-- but policies must explicitly allow role 'superintendent'

-- project_workflow_steps: add superintendent to SELECT (see all steps in accessible workflows)
DROP POLICY IF EXISTS "Users can see steps for workflows they have access to" ON public.project_workflow_steps;
CREATE POLICY "Users can see steps for workflows they have access to"
ON public.project_workflow_steps
FOR SELECT
USING (
  public.is_dev()
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_technician')
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'assistant')
    AND public.can_access_project_via_workflow(workflow_id)
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND public.can_access_project_via_workflow(workflow_id)
  )
  OR (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'subcontractor' AND name IS NOT NULL
        AND LOWER(TRIM(users.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
);

-- project_workflow_steps: add superintendent to INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Users can insert steps for workflows they have access to" ON public.project_workflow_steps;
CREATE POLICY "Users can insert steps for workflows they have access to"
ON public.project_workflow_steps FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_workflow(workflow_id)
);

DROP POLICY IF EXISTS "Users can update steps for workflows they have access to" ON public.project_workflow_steps;
CREATE POLICY "Users can update steps for workflows they have access to"
ON public.project_workflow_steps FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_workflow(workflow_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_workflow(workflow_id)
);

DROP POLICY IF EXISTS "Users can delete steps for workflows they have access to" ON public.project_workflow_steps;
CREATE POLICY "Users can delete steps for workflows they have access to"
ON public.project_workflow_steps FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_workflow(workflow_id)
);

-- workflow_step_line_items: add superintendent
DROP POLICY IF EXISTS "Owners, masters, and assistants can read line items with adoption" ON public.workflow_step_line_items;
CREATE POLICY "Owners, masters, assistants, superintendents can read line items with adoption"
ON public.workflow_step_line_items FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_step(step_id)
);

DROP POLICY IF EXISTS "Owners, masters, and assistants can insert line items with adoption" ON public.workflow_step_line_items;
CREATE POLICY "Owners, masters, assistants, superintendents can insert line items with adoption"
ON public.workflow_step_line_items FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_step(step_id)
);

DROP POLICY IF EXISTS "Owners, masters, and assistants can update line items with adoption" ON public.workflow_step_line_items;
CREATE POLICY "Owners, masters, assistants, superintendents can update line items with adoption"
ON public.workflow_step_line_items FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_step(step_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_step(step_id)
);

DROP POLICY IF EXISTS "Owners, masters, and assistants can delete line items with adoption" ON public.workflow_step_line_items;
CREATE POLICY "Owners, masters, assistants, superintendents can delete line items with adoption"
ON public.workflow_step_line_items FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'superintendent'))
  AND public.can_access_project_via_step(step_id)
);
