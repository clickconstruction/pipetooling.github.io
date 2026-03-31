-- Update projects RLS policies to allow assistants to access projects
-- from masters who have adopted them

-- Drop existing SELECT policy (if it exists with a specific name)
DROP POLICY IF EXISTS "Users can see projects for customers they have access to" ON public.projects;

-- New SELECT policy: Users can see projects they own OR projects from masters who adopted them
CREATE POLICY "Users can see projects they own or projects from masters who adopted them"
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
    -- For masters/devs: master_user_id can be their own ID or customer's master
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('dev', 'master_technician')
    )
    OR (
      -- For assistants: master_user_id must be a master who adopted them
      master_user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
  AND EXISTS (
    -- Customer must exist and user must have access
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
    )
  )
);

-- Update UPDATE policy
DROP POLICY IF EXISTS "Assistants and above can update projects" ON public.projects;

CREATE POLICY "Assistants and above can update projects"
ON public.projects
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    -- User owns the project
    master_user_id = auth.uid()
    -- OR user is a master/dev
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
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    -- For masters/devs: can set master_user_id to their own or customer's master
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('dev', 'master_technician')
    )
    OR (
      -- For assistants: master_user_id must be a master who adopted them
      master_user_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
  AND EXISTS (
    -- Customer must exist and user must have access
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
    )
  )
);

-- DELETE policy remains unchanged (only devs/masters can delete)
