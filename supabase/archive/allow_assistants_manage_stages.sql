-- Allow assistants to fully manage workflow stages (steps) for workflows they can access
-- and manage workflow dependencies needed for insert/delete operations.
--
-- This enables assistants to:
-- - insert/update/delete/reorder steps in accessible workflows
-- - insert/delete workflow_step_dependencies rows tied to accessible steps
--
-- Access model:
-- - dev/master_technician: full access
-- - assistant: full access for projects they can access (ownership/adoption/sharing)
-- - subcontractor: read-only limited to assigned steps (by name match)

-- ---------------------------------------------------------------------------
-- Helper functions (self-contained for this migration)
-- ---------------------------------------------------------------------------

-- Helper: can current user access a workflow (via its project)?
-- Uses SECURITY DEFINER to avoid RLS recursion and speed up policy checks.
CREATE OR REPLACE FUNCTION public.can_access_project_via_workflow(workflow_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  project_master_id UUID;
  user_role_val TEXT;
BEGIN
  SELECT p.master_user_id, u.role
  INTO project_master_id, user_role_val
  FROM public.project_workflows pw
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE pw.id = workflow_id_param;

  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    project_master_id = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    OR EXISTS (
      SELECT 1 FROM public.master_assistants ma
      WHERE ma.master_id = project_master_id
        AND ma.assistant_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.master_shares ms
      WHERE ms.sharing_master_id = project_master_id
        AND ms.viewing_master_id = auth.uid()
    )
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project_via_workflow(UUID) IS 'Checks if the current user can access a project via a workflow (owner/dev/master/adopted/shared). Uses SECURITY DEFINER to optimize RLS.';

-- Helper: can current user access a workflow step (via its workflow/project)?
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
  SELECT p.master_user_id, u.role
  INTO project_master_id, user_role_val
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;

  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    project_master_id = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    OR EXISTS (
      SELECT 1 FROM public.master_assistants ma
      WHERE ma.master_id = project_master_id
        AND ma.assistant_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.master_shares ms
      WHERE ms.sharing_master_id = project_master_id
        AND ms.viewing_master_id = auth.uid()
    )
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project_via_step(UUID) IS 'Checks if the current user can access a project via a workflow step (owner/dev/master/adopted/shared). Uses SECURITY DEFINER to optimize RLS.';

-- ---------------------------------------------------------------------------
-- project_workflow_steps
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_workflow_steps'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_workflow_steps', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.project_workflow_steps ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "Users can see steps for workflows they have access to"
ON public.project_workflow_steps
FOR SELECT
USING (
  -- Devs and masters can see all steps
  public.is_dev()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'master_technician'
  )
  -- Assistants can see all steps for workflows they can access
  OR (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'assistant'
    )
    AND public.can_access_project_via_workflow(workflow_id)
  )
  -- Subcontractors can only see steps assigned to them (by name match)
  OR (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'subcontractor'
        AND name IS NOT NULL
        AND LOWER(TRIM(users.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
);

-- INSERT
CREATE POLICY "Users can insert steps for workflows they have access to"
ON public.project_workflow_steps
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_workflow(workflow_id)
);

-- UPDATE
CREATE POLICY "Users can update steps for workflows they have access to"
ON public.project_workflow_steps
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_workflow(workflow_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_workflow(workflow_id)
);

-- DELETE
CREATE POLICY "Users can delete steps for workflows they have access to"
ON public.project_workflow_steps
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_workflow(workflow_id)
);

-- ---------------------------------------------------------------------------
-- workflow_step_dependencies
-- ---------------------------------------------------------------------------
-- Note: Workflow.tsx inserts/deletes dependencies when saving/deleting steps.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_step_dependencies'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.workflow_step_dependencies', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.workflow_step_dependencies ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "Users can see workflow dependencies for steps they can access"
ON public.workflow_step_dependencies
FOR SELECT
USING (
  public.can_access_project_via_step(step_id)
  AND public.can_access_project_via_step(depends_on_step_id)
);

-- INSERT
CREATE POLICY "Users can insert workflow dependencies for steps they can access"
ON public.workflow_step_dependencies
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_step(step_id)
  AND public.can_access_project_via_step(depends_on_step_id)
);

-- UPDATE
CREATE POLICY "Users can update workflow dependencies for steps they can access"
ON public.workflow_step_dependencies
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_step(step_id)
  AND public.can_access_project_via_step(depends_on_step_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_step(step_id)
  AND public.can_access_project_via_step(depends_on_step_id)
);

-- DELETE
CREATE POLICY "Users can delete workflow dependencies for steps they can access"
ON public.workflow_step_dependencies
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    public.can_access_project_via_step(step_id)
    OR public.can_access_project_via_step(depends_on_step_id)
  )
);

