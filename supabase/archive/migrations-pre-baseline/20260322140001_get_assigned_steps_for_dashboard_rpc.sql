-- RPC to fetch workflow steps assigned to the current user by name (case-insensitive, trimmed).
-- Fixes Dashboard "Projects: Assigned Stages" when assigned_to_name has whitespace/case mismatch
-- (e.g. "Abraham " vs "Abraham" or "abraham" vs "Abraham").
-- Uses SECURITY INVOKER so RLS applies; caller only gets steps they can access.

CREATE OR REPLACE FUNCTION public.get_assigned_steps_for_dashboard(p_user_name text)
RETURNS SETOF public.project_workflow_steps
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.project_workflow_steps
  WHERE assigned_to_name IS NOT NULL
    AND LOWER(TRIM(assigned_to_name)) = LOWER(TRIM(p_user_name))
  ORDER BY created_at DESC
  LIMIT 100;
$$;
COMMENT ON FUNCTION public.get_assigned_steps_for_dashboard(text) IS 'Returns steps assigned to the user by name (case-insensitive, trimmed). Used by Dashboard Projects: Assigned Stages.';
