-- Fix infinite recursion in projects RLS policy.
--
-- Root cause: The projects policy uses can_access_project_row(id). That function
-- does SELECT FROM projects to get master_user_id and customer_id. Reading
-- projects triggers projects RLS again, causing infinite recursion.
--
-- Fix: Add an overload can_access_project_row(project_id, master_user_id, customer_id)
-- that uses the passed values instead of reading projects. The projects policy
-- calls this overload with the row's own columns, so no projects read occurs.
--
-- Also: project_superintendents RLS uses can_access_project_row(project_id). The
-- overload's check of project_superintendents would trigger that RLS, which would
-- call can_access_project_row again. So we use a SECURITY DEFINER helper for
-- the superintendent-assignment check.

CREATE OR REPLACE FUNCTION public.user_assigned_to_project_as_superintendent(project_id_param UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_superintendents
    WHERE project_id = project_id_param
    AND superintendent_id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.user_assigned_to_project_as_superintendent(UUID) IS 'Checks if current user is assigned as superintendent to this project. SECURITY DEFINER to bypass RLS and avoid recursion.';

-- Overload: accepts row values to avoid reading projects (breaks recursion)
CREATE OR REPLACE FUNCTION public.can_access_project_row(
  project_id_param UUID,
  proj_master_id UUID,
  proj_customer_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  cust_master_id UUID;
  user_role_val TEXT;
BEGIN
  IF proj_master_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();

  -- Direct access: owner, dev, master, adopted, shared
  IF proj_master_id = auth.uid() THEN
    RETURN true;
  END IF;
  IF user_role_val IN ('dev', 'master_technician') THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = proj_master_id AND assistant_id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = proj_master_id AND primary_id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = proj_master_id AND superintendent_id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = proj_master_id AND viewing_master_id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- Project-level assignment: use SECURITY DEFINER helper to avoid project_superintendents
  -- RLS (which calls can_access_project_row) from triggering projects RLS recursion
  IF public.user_assigned_to_project_as_superintendent(project_id_param) THEN
    RETURN true;
  END IF;

  -- Access via customer: if project has customer_id, check customer access
  IF proj_customer_id IS NOT NULL THEN
    SELECT master_user_id INTO cust_master_id FROM public.customers WHERE id = proj_customer_id;
    IF cust_master_id IS NOT NULL THEN
      IF cust_master_id = auth.uid() THEN
        RETURN true;
      END IF;
      IF user_role_val IN ('dev', 'master_technician') THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = cust_master_id AND assistant_id = auth.uid()) THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = cust_master_id AND primary_id = auth.uid()) THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = cust_master_id AND superintendent_id = auth.uid()) THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = cust_master_id AND viewing_master_id = auth.uid()) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;
COMMENT ON FUNCTION public.can_access_project_row(UUID, UUID, UUID) IS 'Checks project access using passed master_user_id and customer_id. Used by projects RLS to avoid recursion (no projects table read).';

-- Update projects SELECT policy to use the overload with row values
DROP POLICY IF EXISTS "Users can see projects they have access to" ON public.projects;
CREATE POLICY "Users can see projects they have access to"
ON public.projects
FOR SELECT
USING (
  public.can_access_project_row(id, master_user_id, customer_id)
  OR (
    EXISTS (
      SELECT 1 FROM public.project_workflows pw
      JOIN public.project_workflow_steps s ON s.workflow_id = pw.id
      JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
        AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
      WHERE pw.project_id = projects.id
        AND s.assigned_to_name IS NOT NULL
    )
  )
);
