-- RPC to update step assigned_to_name, bypassing RLS to avoid statement timeout
-- (RLS policies on project_workflow_steps can be slow under load)

CREATE OR REPLACE FUNCTION public.update_step_assigned_to(p_step_id uuid, p_assigned_to_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Access check: dev, master, owner, adopted, shared, OR assistant (assigned or can_access)
  IF NOT (
    public.can_access_project_via_step(p_step_id)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'assistant')
      AND (
        EXISTS (
          SELECT 1 FROM public.project_workflow_steps s
          JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
            AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
          WHERE s.id = p_step_id
        )
        OR public.can_access_project_via_workflow(
          (SELECT workflow_id FROM public.project_workflow_steps WHERE id = p_step_id)
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.project_workflow_steps
  SET assigned_to_name = p_assigned_to_name
  WHERE id = p_step_id;
END;
$$;

COMMENT ON FUNCTION public.update_step_assigned_to(uuid, text) IS 'Updates assigned_to_name on a workflow step. Bypasses RLS to avoid timeout.';
