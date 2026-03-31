-- Update workflow_projections RLS policies to allow masters to access projections
-- from masters who have shared with them (via master_shares)

-- Drop existing policies if they exist
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workflow_projections'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.workflow_projections', r.policyname);
  END LOOP;
END $$;

-- Ensure RLS remains enabled
ALTER TABLE public.workflow_projections ENABLE ROW LEVEL SECURITY;

-- SELECT policy: users can see projections for workflows on projects they can access
CREATE POLICY "Users can see projections for workflows they have access to"
ON public.workflow_projections
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.project_workflows pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.id = workflow_id
      AND (
        -- User owns the project (via master_user_id)
        p.master_user_id = auth.uid()
        -- OR user is a dev/master (can see all)
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
      )
  )
);

-- INSERT policy: only devs and masters can insert projections for workflows they can access
CREATE POLICY "Devs and masters can insert projections"
ON public.workflow_projections
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1
    FROM public.project_workflows pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.id = workflow_id
      AND (
        p.master_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role IN ('dev', 'master_technician')
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants ma
          WHERE ma.master_id = p.master_user_id
            AND ma.assistant_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.master_shares ms
          WHERE ms.sharing_master_id = p.master_user_id
            AND ms.viewing_master_id = auth.uid()
        )
      )
  )
);

-- UPDATE policy: only devs and masters can update projections for workflows they can access
CREATE POLICY "Devs and masters can update projections"
ON public.workflow_projections
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1
    FROM public.project_workflows pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.id = workflow_id
      AND (
        p.master_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role IN ('dev', 'master_technician')
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants ma
          WHERE ma.master_id = p.master_user_id
            AND ma.assistant_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.master_shares ms
          WHERE ms.sharing_master_id = p.master_user_id
            AND ms.viewing_master_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
  AND EXISTS (
    SELECT 1
    FROM public.project_workflows pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.id = workflow_id
      AND (
        p.master_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role IN ('dev', 'master_technician')
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants ma
          WHERE ma.master_id = p.master_user_id
            AND ma.assistant_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.master_shares ms
          WHERE ms.sharing_master_id = p.master_user_id
            AND ms.viewing_master_id = auth.uid()
        )
      )
  )
);

-- DELETE policy: only devs and masters can delete projections
CREATE POLICY "Devs and masters can delete projections"
ON public.workflow_projections
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
);
