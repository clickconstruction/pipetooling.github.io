-- Allow primary users to manage checklist items (add, forward, edit, delete)
-- Fixes: "new row violates row-level security policy for table checklist_items"
-- when Trace (Primary) sends out a checklist item

CREATE OR REPLACE FUNCTION public.is_dev_or_master_or_assistant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  );
$$;

COMMENT ON FUNCTION public.is_dev_or_master_or_assistant() IS 'Checks if current user can manage checklist items. Includes primary for sending/forwarding tasks.';
