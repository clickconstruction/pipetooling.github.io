-- Extend get_assigned_steps_with_projects_for_dashboard to include project superintendent names.
-- Superintendents from project_superintendents (project-specific) + master_superintendents (adopted by master).
-- Used by Dashboard Assigned Stage cards to show superintendent next to assignee.

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
      p.plans_link AS project_plans_link,
      (SELECT string_agg(COALESCE(u.name, u.email, 'Unknown'), ', ' ORDER BY COALESCE(u.name, u.email, 'Unknown'))
       FROM (
         SELECT superintendent_id FROM project_superintendents WHERE project_id = p.id
         UNION
         SELECT superintendent_id FROM master_superintendents WHERE master_id = p.master_user_id
       ) ids
       JOIN users u ON u.id = ids.superintendent_id
      ) AS project_superintendent_names
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
COMMENT ON FUNCTION public.get_assigned_steps_with_projects_for_dashboard(text) IS 'Returns steps with project metadata and superintendent names for Dashboard. SECURITY DEFINER to bypass workflow/project RLS. Only returns steps assigned to current user.';
