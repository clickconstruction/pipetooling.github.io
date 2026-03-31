-- Optimize RLS policies impacted by master-to-master sharing
-- Addresses: 57014 canceling statement due to statement timeout
--
-- Strategy:
-- - Use SECURITY DEFINER helper functions to reduce per-row join work in policies
-- - Extend existing optimized access checks to include master_shares
-- - Recreate the heaviest policies to use helper functions

-- Helper: does the current user have a share from a given master?
CREATE OR REPLACE FUNCTION public.master_shared_current_user(sharing_master_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.master_shares ms
    WHERE ms.sharing_master_id = master_shared_current_user.sharing_master_id
      AND ms.viewing_master_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.master_shared_current_user(UUID) IS 'Checks if the given master has shared with the current user. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';

-- Helper: can current user access a project?
CREATE OR REPLACE FUNCTION public.can_access_project(project_id_param UUID)
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
  FROM public.projects p
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE p.id = project_id_param;

  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    project_master_id = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    OR public.master_adopted_current_user(project_master_id)
    OR public.master_shared_current_user(project_master_id)
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project(UUID) IS 'Checks if the current user can access a project (owner/dev/master/adopted/shared). Uses SECURITY DEFINER to optimize RLS.';

-- Helper: can current user access a workflow (via its project)?
CREATE OR REPLACE FUNCTION public.can_access_project_via_workflow(workflow_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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

  RETURN public.can_access_project(project_id_val);
END;
$$;

COMMENT ON FUNCTION public.can_access_project_via_workflow(UUID) IS 'Checks if the current user can access a project via a workflow. Uses SECURITY DEFINER to optimize RLS.';

-- Extend existing helper (used by line items) to include master_shares
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
  SELECT p.master_user_id, u.role INTO project_master_id, user_role_val
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
    OR public.master_adopted_current_user(project_master_id)
    OR public.master_shared_current_user(project_master_id)
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project_via_step(UUID) IS 'Checks if the current user can access a project via a workflow step (owner/dev/master/adopted/shared). Uses SECURITY DEFINER to optimize RLS.';

-- ---------------------------------------------------------------------------
-- Recreate heavy policies to use helper functions
-- ---------------------------------------------------------------------------

-- project_workflows: drop existing policies and recreate SELECT using can_access_project()
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_workflows'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_workflows', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.project_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see workflows they have access to"
ON public.project_workflows
FOR SELECT
USING (
  public.can_access_project(project_id)
);

-- Keep existing intended behavior: only devs/masters/assistants can create/update workflows for accessible projects
CREATE POLICY "Users can insert workflows for projects they have access to"
ON public.project_workflows
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project(project_id)
);

CREATE POLICY "Users can update workflows for projects they have access to"
ON public.project_workflows
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project(project_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project(project_id)
);

CREATE POLICY "Only devs and masters can delete workflows"
ON public.project_workflows
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  AND public.can_access_project(project_id)
);

-- project_workflow_steps: drop and recreate SELECT using can_access_project_via_workflow()
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

CREATE POLICY "Users can see steps for workflows they have access to"
ON public.project_workflow_steps
FOR SELECT
USING (
  -- Devs and masters can see all steps
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  -- Subcontractors/assistants can see steps assigned to them (by name match)
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
  -- Assistants can also see ALL steps for workflows on projects they can access (adopted/shared)
  OR (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'assistant'
    )
    AND public.can_access_project_via_workflow(workflow_id)
  )
);

CREATE POLICY "Users can insert steps for workflows they have access to"
ON public.project_workflow_steps
FOR INSERT
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
        AND role = 'assistant'
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

CREATE POLICY "Only devs and masters can delete steps"
ON public.project_workflow_steps
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
);

-- workflow_step_line_items: restore optimized pattern (role check + can_access_project_via_step)
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

ALTER TABLE public.workflow_step_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners, masters, and assistants can read line items with adoption and sharing"
ON public.workflow_step_line_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_step(step_id)
);

CREATE POLICY "Owners, masters, and assistants can insert line items with adoption and sharing"
ON public.workflow_step_line_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_step(step_id)
);

CREATE POLICY "Owners, masters, and assistants can update line items with adoption and sharing"
ON public.workflow_step_line_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_step(step_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND public.can_access_project_via_step(step_id)
);

CREATE POLICY "Owners and masters can delete line items with adoption and sharing"
ON public.workflow_step_line_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  AND public.can_access_project_via_step(step_id)
);

