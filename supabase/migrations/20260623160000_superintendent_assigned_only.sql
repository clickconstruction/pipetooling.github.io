-- Superintendents: same access as assistants, but only for projects they are assigned to.
-- Remove adoption-based access (master_superintendents) for superintendents.
-- They retain project-level assignment (project_superintendents) only.

CREATE OR REPLACE FUNCTION public.can_access_project_row(project_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  proj_master_id UUID;
  proj_customer_id UUID;
  cust_master_id UUID;
  user_role_val TEXT;
BEGIN
  SELECT p.master_user_id, p.customer_id
  INTO proj_master_id, proj_customer_id
  FROM public.projects p
  WHERE p.id = project_id_param;

  IF proj_master_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();

  -- Superintendents: ONLY project-level assignment (project_superintendents), NOT adoption
  IF user_role_val = 'superintendent' THEN
    RETURN EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = project_id_param AND superintendent_id = auth.uid());
  END IF;

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
  -- master_superintendents removed: superintendents now use project_superintendents only
  IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = proj_master_id AND viewing_master_id = auth.uid()) THEN
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
      IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = cust_master_id AND viewing_master_id = auth.uid()) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;
COMMENT ON FUNCTION public.can_access_project_row(UUID) IS 'Checks if the current user can access a project. Superintendents: assigned projects only (project_superintendents). Others: owner/dev/master/adopted/shared. SECURITY DEFINER.';
