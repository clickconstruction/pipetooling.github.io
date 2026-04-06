-- Stale tally staff follow-up (Option A): assistants see adopting masters, same-master assistants
-- (assistants_share_master), and users on jobs for any adopted master — not company-wide like dev.
-- Replaces Option B in 20270408150000_tally_staff_followup_assistant_any_target.sql.

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

  IF public.is_dev() OR v_role = 'dev' THEN
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

  IF v_role = 'assistant' THEN
    RETURN public.assistants_share_master(p_viewer, p_target)
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = p_target AND ma.assistant_id = p_viewer
      )
      OR EXISTS (
        SELECT 1
        FROM public.jobs_ledger jl
        INNER JOIN public.jobs_ledger_team_members jtm
          ON jtm.job_id = jl.id AND jtm.user_id = p_target
        WHERE jl.master_user_id IN (
          SELECT ma2.master_id
          FROM public.master_assistants ma2
          WHERE ma2.assistant_id = p_viewer
        )
      );
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.staff_can_view_user_for_tally_followup(uuid, uuid) IS
  'Whether p_viewer may list or assign tally for p_target''s linked-card Mercury rows: dev/is_dev() any target; master_technician adopted assistants or team on viewer''s jobs; assistant adopting masters + assistants_share_master + team on jobs for any adopted master; otherwise false.';
