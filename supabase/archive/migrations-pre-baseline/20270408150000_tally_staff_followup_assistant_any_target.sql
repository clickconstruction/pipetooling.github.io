-- Stale tally staff follow-up (Option B): assistants may list/assign for any target user (same as dev).
-- See staff_can_view_user_for_tally_followup in 20260405211552_tally_stale_staff_followup.sql.

CREATE OR REPLACE FUNCTION public.staff_can_view_user_for_tally_followup(p_viewer uuid, p_target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_viewer IS NULL OR p_target IS NULL THEN
    RETURN false;
  END IF;
  IF p_viewer = p_target THEN
    RETURN true;
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_dev() OR v_role IN ('dev', 'assistant') THEN
    RETURN true;
  END IF;

  IF v_role = 'master_technician' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.master_assistants ma
      WHERE ma.master_id = p_viewer AND ma.assistant_id = p_target
    )
    OR EXISTS (
      SELECT 1
      FROM public.jobs_ledger jl
      INNER JOIN public.jobs_ledger_team_members jtm
        ON jtm.job_id = jl.id AND jtm.user_id = p_target
      WHERE jl.master_user_id = p_viewer
    );
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.staff_can_view_user_for_tally_followup(uuid, uuid) IS
  'Whether p_viewer may list or assign tally for p_target''s linked-card Mercury rows: dev/is_dev() and assistant any target; master_technician adopted assistants or team on master jobs; otherwise false.';
