-- Update projects RLS policies to allow masters to access projects
-- from masters who have shared with them (via master_shares)

-- Drop existing SELECT policy (if it exists with a specific name)
DROP POLICY IF EXISTS "Users can see projects they own or projects from masters who adopted them" ON public.projects;

-- New SELECT policy: Users can see projects they own OR projects from masters who adopted them OR masters who shared with them
CREATE POLICY "Users can see projects they own or projects from masters who adopted them or shared with them"
ON public.projects
FOR SELECT
USING (
  -- User owns the project (via master_user_id)
  master_user_id = auth.uid()
  -- OR user is a master/dev (can see all)
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  -- OR a master who owns the project has adopted this assistant
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
  -- OR a master who owns the project has shared with this master
  OR EXISTS (
    SELECT 1 FROM public.master_shares
    WHERE sharing_master_id = master_user_id
    AND viewing_master_id = auth.uid()
  )
  -- OR user can see the customer (legacy check for backwards compatibility)
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = customer_id
    AND (
      master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = master_user_id
        AND viewing_master_id = auth.uid()
      )
    )
  )
);

-- Update INSERT policy to require master_user_id for assistants
DROP POLICY IF EXISTS "Assistants and above can insert projects" ON public.projects;

CREATE POLICY "Assistants and above can insert projects"
ON public.projects
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    -- User is a master/dev (can create projects)
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('dev', 'master_technician')
    )
    -- OR user is an assistant and master_user_id matches a master who adopted them
    OR (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'assistant'
      )
      AND EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);
