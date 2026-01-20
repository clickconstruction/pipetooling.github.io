-- Update project_workflows RLS policies to allow masters to access workflows
-- from masters who have shared with them (via master_shares)

-- Drop existing SELECT policy (if it exists with a specific name)
DROP POLICY IF EXISTS "Users can see workflows they have access to" ON public.project_workflows;

-- New SELECT policy: Users can see workflows for projects they own OR projects from masters who adopted them OR masters who shared with them
CREATE POLICY "Users can see workflows they have access to"
ON public.project_workflows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_workflows.project_id
    AND (
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
    )
  )
);

-- INSERT policy: Users can create workflows for projects they can access
DROP POLICY IF EXISTS "Users can insert workflows for projects they have access to" ON public.project_workflows;

CREATE POLICY "Users can insert workflows for projects they have access to"
ON public.project_workflows
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    -- Check if user can SELECT the project (uses projects SELECT policy logic)
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
    AND (
      -- User owns the project (via master_user_id)
      p.master_user_id = auth.uid()
      -- OR user is a master/dev (can see all)
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('dev', 'master_technician')
      )
      -- OR a master who owns the project has adopted this assistant
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = p.master_user_id
        AND ma.assistant_id = auth.uid()
      )
      -- OR a master who owns the project has shared with this master
      OR EXISTS (
        SELECT 1 FROM public.master_shares ms
        WHERE ms.sharing_master_id = p.master_user_id
        AND ms.viewing_master_id = auth.uid()
      )
      -- OR user can see the customer (legacy check for backwards compatibility)
      OR EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = p.customer_id
        AND (
          c.master_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.users u2
            WHERE u2.id = auth.uid() 
            AND u2.role IN ('dev', 'master_technician')
          )
          OR EXISTS (
            SELECT 1 FROM public.master_assistants ma2
            WHERE ma2.master_id = c.master_user_id
            AND ma2.assistant_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.master_shares ms2
            WHERE ms2.sharing_master_id = c.master_user_id
            AND ms2.viewing_master_id = auth.uid()
          )
        )
      )
    )
  )
);

-- UPDATE policy: Users can update workflows for projects they have access to
DROP POLICY IF EXISTS "Users can update workflows for projects they have access to" ON public.project_workflows;

CREATE POLICY "Users can update workflows for projects they have access to"
ON public.project_workflows
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_workflows.project_id
    AND (
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
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_workflows.project_id
    AND (
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
    )
  )
);
