-- RPCs to update step notes and private_notes, bypassing RLS to avoid statement timeout
-- (RLS policies on project_workflow_steps can be slow under load)

CREATE OR REPLACE FUNCTION public.update_step_notes(p_step_id uuid, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  SET notes = p_notes
  WHERE id = p_step_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.update_step_private_notes(p_step_id uuid, p_private_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  SET private_notes = p_private_notes
  WHERE id = p_step_id;
END;
$$;
COMMENT ON FUNCTION public.update_step_notes(uuid, text) IS 'Updates notes on a workflow step. Bypasses RLS to avoid timeout.';
COMMENT ON FUNCTION public.update_step_private_notes(uuid, text) IS 'Updates private_notes on a workflow step. Bypasses RLS to avoid timeout.';
