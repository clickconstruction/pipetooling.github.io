-- Create project_superintendents junction table
-- Allows devs, masters, and assistants to assign superintendents to specific projects
-- Superintendents gain access via adoption (master_superintendents) OR project assignment (this table)

CREATE TABLE public.project_superintendents (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  superintendent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, superintendent_id)
);
CREATE INDEX idx_project_superintendents_project_id ON public.project_superintendents(project_id);
CREATE INDEX idx_project_superintendents_superintendent_id ON public.project_superintendents(superintendent_id);
ALTER TABLE public.project_superintendents ENABLE ROW LEVEL SECURITY;

-- Devs, masters, assistants can read rows for projects they can access
CREATE POLICY "Devs masters assistants can read project superintendents"
ON public.project_superintendents
FOR SELECT
USING (
  public.can_access_project_row(project_id)
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- Superintendents can read rows where they are assigned
CREATE POLICY "Superintendents can read their own project assignments"
ON public.project_superintendents
FOR SELECT
USING (
  superintendent_id = auth.uid()
);

-- Devs, masters, assistants can insert for projects they can access
CREATE POLICY "Devs masters assistants can insert project superintendents"
ON public.project_superintendents
FOR INSERT
WITH CHECK (
  public.can_access_project_row(project_id)
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- Devs, masters, assistants can delete for projects they can access
CREATE POLICY "Devs masters assistants can delete project superintendents"
ON public.project_superintendents
FOR DELETE
USING (
  public.can_access_project_row(project_id)
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

COMMENT ON TABLE public.project_superintendents IS 'Junction table: superintendents assigned to specific projects. Devs/masters/assistants assign; superintendents gain access via can_access_project_row.';

-- Update can_access_project_row to include project-level assignment
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

  -- Project-level assignment (devs/masters/assistants assign superintendents to specific projects)
  IF EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = project_id_param AND superintendent_id = auth.uid()) THEN
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
COMMENT ON FUNCTION public.can_access_project_row(UUID) IS 'Checks if the current user can access a project. Used by projects RLS. Includes superintendent adoption and project-level assignment. SECURITY DEFINER.';
