SET lock_timeout = '3s';

-- RUN_SUBS_PLAN Phase 4, PR 4.3: respond_to_work_order returns the answer
-- CONTEXT the sub's client needs to fire the office notification — creator
-- contact (falling back to the project master) plus step/project names.
-- Sub-role RLS can't read those rows directly, and this function is already
-- SECURITY DEFINER behind a hard own-person gate, so returning them here is
-- the clean path (no second RPC, one round trip). Same signature —
-- CREATE OR REPLACE; old clients simply ignore the extra fields.

CREATE OR REPLACE FUNCTION public.respond_to_work_order("p_commitment_id" uuid, "p_accept" boolean, "p_reason" text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_c public.step_commitments%ROWTYPE;
  v_step public.project_workflow_steps%ROWTYPE;
  v_workflow public.project_workflows%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_dates_written boolean := false;
  v_dates_mismatch boolean := false;
  v_notify record;
BEGIN
  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = v_c.person_id AND p.account_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_c.status <> 'offered' THEN
    RAISE EXCEPTION 'This work order is no longer open (status: %)', v_c.status;
  END IF;

  SELECT * INTO v_step FROM public.project_workflow_steps WHERE id = v_c.step_id;
  SELECT * INTO v_workflow FROM public.project_workflows WHERE id = v_step.workflow_id;
  SELECT * INTO v_project FROM public.projects WHERE id = v_workflow.project_id;

  IF p_accept THEN
    UPDATE public.step_commitments
    SET status = 'accepted', accepted_at = now()
    WHERE id = p_commitment_id;

    IF v_c.proposed_start IS NOT NULL OR v_c.proposed_end IS NOT NULL THEN
      IF v_step.scheduled_start_date IS NULL AND v_step.scheduled_end_date IS NULL THEN
        UPDATE public.project_workflow_steps
        SET scheduled_start_date = v_c.proposed_start,
            scheduled_end_date = v_c.proposed_end
        WHERE id = v_c.step_id;
        v_dates_written := true;
      ELSIF v_step.scheduled_start_date IS DISTINCT FROM v_c.proposed_start
         OR v_step.scheduled_end_date IS DISTINCT FROM v_c.proposed_end THEN
        v_dates_mismatch := true;
      END IF;
    END IF;
  ELSE
    IF btrim(COALESCE(p_reason, '')) = '' THEN
      RAISE EXCEPTION 'A reason is required to decline';
    END IF;
    UPDATE public.step_commitments
    SET status = 'declined', declined_at = now(), decline_reason = btrim(p_reason)
    WHERE id = p_commitment_id;
  END IF;

  -- Notification target: the order's creator, else the project master.
  SELECT u.id, u.email, COALESCE(NULLIF(btrim(u.name), ''), u.email) AS display
  INTO v_notify
  FROM public.users u
  WHERE u.id = COALESCE(v_c.created_by, v_project.master_user_id);

  RETURN jsonb_build_object(
    'commitment_id', p_commitment_id,
    'accepted', p_accept,
    'dates_written', v_dates_written,
    'dates_mismatch', v_dates_mismatch,
    'step_id', v_c.step_id,
    'step_name', v_step.name,
    'project_id', v_project.id,
    'project_name', v_project.name,
    'amount', v_c.amount,
    'proposed_start', v_c.proposed_start,
    'proposed_end', v_c.proposed_end,
    'notify_user_id', v_notify.id,
    'notify_email', v_notify.email,
    'notify_name', v_notify.display
  );
END;
$$;
