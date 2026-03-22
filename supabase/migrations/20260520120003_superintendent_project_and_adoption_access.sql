-- Superintendent adoption: add superintendent to can_access_project_row and master_adopted_current_user
-- This enables superintendents to access projects and workflows via adoption

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
COMMENT ON FUNCTION public.can_access_project_row(UUID) IS 'Checks if the current user can access a project. Used by projects RLS. Includes superintendent adoption. SECURITY DEFINER.';

CREATE OR REPLACE FUNCTION public.master_adopted_current_user(master_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_adopted_current_user.master_user_id
    AND assistant_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_primaries
    WHERE master_id = master_adopted_current_user.master_user_id
    AND primary_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_superintendents
    WHERE master_id = master_adopted_current_user.master_user_id
    AND superintendent_id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.master_adopted_current_user(UUID) IS 'Checks if the given master has adopted the current user (as assistant, primary, or superintendent). Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
