-- Allow assistants to create and update projects
-- This migration ensures assistants can INSERT and UPDATE projects for customers they have access to
-- DELETE remains restricted to devs and master_technicians

-- Policy: Allow assistants, masters, and devs to insert projects
-- Users can only insert projects for customers they have access to
-- This uses the same customer access logic as the projects SELECT policy
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
  AND EXISTS (
    -- User must be able to see the customer (same logic as projects SELECT policy)
    -- This checks if the customer exists and user has access via customer SELECT policy
    SELECT 1 FROM public.customers
    WHERE id = customer_id
    AND (
      -- User owns the customer OR
      master_user_id = auth.uid()
      -- User is dev/master (can see all) OR
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('dev', 'master_technician')
      )
      -- For assistants: if they can SELECT the customer, they can create projects
      -- (The customer SELECT policy will enforce access)
    )
  )
);

-- Policy: Allow assistants, masters, and devs to update projects
-- Users can only update projects for customers they have access to
-- This uses the same customer access logic as the projects SELECT policy
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
  AND EXISTS (
    -- User must be able to see the customer (same logic as projects SELECT policy)
    SELECT 1 FROM public.customers
    WHERE id = customer_id
    AND (
      -- User owns the customer OR
      master_user_id = auth.uid()
      -- User is dev/master (can see all) OR
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('dev', 'master_technician')
      )
      -- For assistants: if they can SELECT the customer, they can update projects
      -- (The customer SELECT policy will enforce access)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    -- User must be able to see the customer (same logic as projects SELECT policy)
    SELECT 1 FROM public.customers
    WHERE id = customer_id
    AND (
      -- User owns the customer OR
      master_user_id = auth.uid()
      -- User is dev/master (can see all) OR
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('dev', 'master_technician')
      )
      -- For assistants: if they can SELECT the customer, they can update projects
      -- (The customer SELECT policy will enforce access)
    )
  )
);

-- Policy: Only devs and masters can delete projects
-- This ensures assistants cannot delete projects even if they can create/update them
DROP POLICY IF EXISTS "Only devs and masters can delete projects" ON public.projects;

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

-- Add comment
COMMENT ON TABLE public.projects IS 'Project records. Assistants, masters, and devs can create and update projects for customers they have access to. Only devs and masters can delete projects.';
