-- Update workflow_step_line_items RLS policies to allow masters to access line items
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
      AND tablename = 'workflow_step_line_items'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.workflow_step_line_items', r.policyname);
  END LOOP;
END $$;

-- Ensure RLS remains enabled
ALTER TABLE public.workflow_step_line_items ENABLE ROW LEVEL SECURITY;

-- Helper access pattern:
-- step -> workflow -> project, then apply same access logic we use elsewhere.

-- SELECT policy: devs, masters, and assistants can read line items for steps on projects they can access
CREATE POLICY "Owners, masters, and assistants can read line items with adoption and sharing"
ON public.workflow_step_line_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.project_workflow_steps s
    JOIN public.project_workflows pw ON pw.id = s.workflow_id
    JOIN public.projects p ON p.id = pw.project_id
    WHERE s.id = step_id
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

-- INSERT policy: devs, masters, and assistants can insert line items for steps on projects they can access
CREATE POLICY "Owners, masters, and assistants can insert line items with adoption and sharing"
ON public.workflow_step_line_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1
    FROM public.project_workflow_steps s
    JOIN public.project_workflows pw ON pw.id = s.workflow_id
    JOIN public.projects p ON p.id = pw.project_id
    WHERE s.id = step_id
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

-- UPDATE policy: devs, masters, and assistants can update line items for steps on projects they can access
CREATE POLICY "Owners, masters, and assistants can update line items with adoption and sharing"
ON public.workflow_step_line_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1
    FROM public.project_workflow_steps s
    JOIN public.project_workflows pw ON pw.id = s.workflow_id
    JOIN public.projects p ON p.id = pw.project_id
    WHERE s.id = step_id
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
      AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1
    FROM public.project_workflow_steps s
    JOIN public.project_workflows pw ON pw.id = s.workflow_id
    JOIN public.projects p ON p.id = pw.project_id
    WHERE s.id = step_id
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

-- DELETE policy: only devs and masters can delete line items
CREATE POLICY "Owners and masters can delete line items with adoption and sharing"
ON public.workflow_step_line_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  )
);
