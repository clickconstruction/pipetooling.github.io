-- RPC to fetch assigned steps WITH project metadata in one call.
-- Bypasses project_workflows/projects RLS by doing the join in SECURITY DEFINER.
-- Safe: only returns steps where assigned_to_name matches current user's name.
-- Fixes Dashboard "Projects: Assigned Stages" when subcontractors can see steps
-- but are blocked from project_workflows/projects by RLS.

CREATE OR REPLACE FUNCTION public.get_assigned_steps_with_projects_for_dashboard(p_user_name text)
RETURNS SETOF json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Only allow if caller's users.name matches p_user_name (case-insensitive, trimmed)
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.name IS NOT NULL
      AND LOWER(TRIM(u.name)) = LOWER(TRIM(p_user_name))
  ) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT
      s.*,
      p.id AS project_id,
      p.name AS project_name,
      p.address AS project_address,
      p.plans_link AS project_plans_link
    FROM public.project_workflow_steps s
    JOIN public.project_workflows pw ON pw.id = s.workflow_id
    JOIN public.projects p ON p.id = pw.project_id
    WHERE s.assigned_to_name IS NOT NULL
      AND LOWER(TRIM(s.assigned_to_name)) = LOWER(TRIM(p_user_name))
    ORDER BY s.created_at DESC
    LIMIT 100
  LOOP
    RETURN NEXT row_to_json(r);
  END LOOP;
END;
$$;
COMMENT ON FUNCTION public.get_assigned_steps_with_projects_for_dashboard(text) IS 'Returns steps with project metadata for Dashboard. SECURITY DEFINER to bypass workflow/project RLS. Only returns steps assigned to current user.';
