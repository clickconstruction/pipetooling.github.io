-- Allow superintendents to SELECT and INSERT project_workflows for projects they can access
-- Fixes "Failed to create workflow: new row violates row-level security policy" when
-- superintendent opens a project from Projects page (ensureWorkflow inserts if no workflow exists).

-- project_workflows SELECT: add superintendent via can_access_project_row
-- (Existing policy uses can_access_project which only includes master_adopted; superintendents
-- assigned via project_superintendents need can_access_project_row.)
DROP POLICY IF EXISTS "Users can see workflows they have access to" ON public.project_workflows;
CREATE POLICY "Users can see workflows they have access to"
ON public.project_workflows
FOR SELECT
USING (
  public.can_access_project(project_id)
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND public.can_access_project_row(project_id)
  )
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

-- project_workflows INSERT: add superintendent when can_access_project_row(project_id)
DROP POLICY IF EXISTS "Users can insert workflows for projects they have access to" ON public.project_workflows;
CREATE POLICY "Users can insert workflows for projects they have access to"
ON public.project_workflows
FOR INSERT
WITH CHECK (
  (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
      AND (
        p.master_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician'))
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = p.master_user_id AND ma.assistant_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.master_shares ms WHERE ms.sharing_master_id = p.master_user_id AND ms.viewing_master_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.id = p.customer_id
          AND (
            c.master_user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician'))
            OR EXISTS (SELECT 1 FROM public.master_assistants ma2 WHERE ma2.master_id = c.master_user_id AND ma2.assistant_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.master_shares ms2 WHERE ms2.sharing_master_id = c.master_user_id AND ms2.viewing_master_id = auth.uid())
          )
        )
      )
    )
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND public.can_access_project_row(project_id)
  )
);

-- project_workflows UPDATE: add superintendent when can_access_project_row(project_id)
DROP POLICY IF EXISTS "Users can update workflows for projects they have access to" ON public.project_workflows;
CREATE POLICY "Users can update workflows for projects they have access to"
ON public.project_workflows
FOR UPDATE
USING (
  (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_workflows.project_id
      AND (
        master_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = master_user_id AND viewing_master_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.customers
          WHERE id = customer_id
          AND (
            master_user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = master_user_id AND viewing_master_id = auth.uid())
          )
        )
      )
    )
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND public.can_access_project_row(project_workflows.project_id)
  )
)
WITH CHECK (
  (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_workflows.project_id
      AND (
        master_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = master_user_id AND viewing_master_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.customers
          WHERE id = customer_id
          AND (
            master_user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = master_user_id AND viewing_master_id = auth.uid())
          )
        )
      )
    )
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND public.can_access_project_row(project_workflows.project_id)
  )
);
