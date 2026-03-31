-- Update project_workflow_steps RLS policies to allow assistants to create/update steps
-- for workflows from projects they can access

-- Drop ALL existing policies on project_workflow_steps to avoid conflicts
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_workflow_steps') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.project_workflow_steps';
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.project_workflow_steps ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can see steps for workflows they have access to
-- Assistants/subcontractors can only see steps assigned to them
-- Devs/masters can see all steps
CREATE POLICY "Users can see steps for workflows they have access to"
ON public.project_workflow_steps
FOR SELECT
USING (
  -- Devs and masters can see all steps
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  -- OR assistants/subcontractors can see steps assigned to them
  OR (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('assistant', 'subcontractor')
      AND name IS NOT NULL
      AND LOWER(TRIM(users.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
  -- OR user can access the workflow (for devs/masters/assistants)
  OR EXISTS (
    SELECT 1 FROM public.project_workflows pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.id = project_workflow_steps.workflow_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = p.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);

-- INSERT policy: Users can create steps for workflows they have access to
CREATE POLICY "Users can insert steps for workflows they have access to"
ON public.project_workflow_steps
FOR INSERT
WITH CHECK (
  -- Devs and masters can insert steps for any workflow
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  -- OR assistants can insert steps for workflows from projects they can access
  OR (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'assistant'
    )
    AND EXISTS (
      -- Check if user can access the workflow
      SELECT 1 FROM public.project_workflows pw
      JOIN public.projects p ON p.id = pw.project_id
      WHERE pw.id = workflow_id
      AND (
        p.master_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.master_assistants ma
          WHERE ma.master_id = p.master_user_id
          AND ma.assistant_id = auth.uid()
        )
      )
    )
  )
);

-- UPDATE policy: Users can update steps for workflows they have access to
CREATE POLICY "Users can update steps for workflows they have access to"
ON public.project_workflow_steps
FOR UPDATE
USING (
  -- Devs and masters can update all steps
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  -- OR assistants can update steps assigned to them
  OR (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'assistant'
      AND name IS NOT NULL
      AND LOWER(TRIM(users.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
  -- OR user can access the workflow
  OR EXISTS (
    SELECT 1 FROM public.project_workflows pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.id = project_workflow_steps.workflow_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = p.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  -- Devs and masters can update all steps
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  -- OR assistants can update steps assigned to them
  OR (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'assistant'
      AND name IS NOT NULL
      AND LOWER(TRIM(users.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
  -- OR user can access the workflow
  OR EXISTS (
    SELECT 1 FROM public.project_workflows pw
    JOIN public.projects p ON p.id = pw.project_id
    WHERE pw.id = project_workflow_steps.workflow_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = p.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);

-- DELETE policy: Only devs and masters can delete steps
CREATE POLICY "Only devs and masters can delete steps"
ON public.project_workflow_steps
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);
