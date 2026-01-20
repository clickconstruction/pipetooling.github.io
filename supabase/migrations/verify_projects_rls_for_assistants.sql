-- Verify and ensure projects RLS policies allow assistants to see all projects
-- from masters who have adopted them
--
-- This migration ensures that:
-- 1. All existing policies are dropped to avoid conflicts
-- 2. The correct SELECT policy is in place with the adoption check
-- 3. Assistants can see all projects owned by masters who adopted them

-- Drop ALL existing policies on projects table to ensure clean state
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', r.policyname);
  END LOOP;
END $$;

-- Ensure RLS remains enabled
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can see projects they own OR projects from masters who adopted them
-- This is the key policy that allows assistants to see all of their master's projects
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
  -- THIS IS THE KEY CHECK: assistants can see all projects from masters who adopted them
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

-- INSERT policy: Assistants, masters, and devs can insert projects
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

-- UPDATE policy: Assistants, masters, and devs can update projects they have access to
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

-- DELETE policy: Only devs and masters can delete projects
CREATE POLICY "Only devs and masters can delete projects"
ON public.projects
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment documenting the policy
COMMENT ON TABLE public.projects IS 'Project records. Assistants can see and manage all projects from masters who have adopted them (via master_assistants table).';
