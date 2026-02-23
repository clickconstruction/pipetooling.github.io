-- Allow reverting paid -> billed for "Send back" from Paid section

CREATE OR REPLACE FUNCTION public.update_job_status(p_job_id UUID, p_to_status TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.status, jl.master_user_id INTO v_current_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF p_to_status = 'ready_to_bill' THEN
    IF v_current_status = 'working' THEN
      v_can_update := EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = p_job_id AND user_id = auth.uid())
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
          AND (v_master_id = auth.uid()
            OR public.is_dev()
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
            OR public.assistants_share_master(auth.uid(), v_master_id)));
    ELSIF v_current_status = 'billed' THEN
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Working or Billed to mark Ready for Billing');
    END IF;
  ELSIF p_to_status = 'billed' THEN
    IF v_current_status = 'ready_to_bill' THEN
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSIF v_current_status = 'paid' THEN
      -- Revert: paid -> billed (office only)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill or Paid to mark as Billed');
    END IF;
  ELSIF p_to_status = 'paid' THEN
    IF v_current_status <> 'billed' THEN
      RETURN jsonb_build_object('error', 'Job must be in Billed to mark as Paid');
    END IF;
    v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSIF p_to_status = 'working' THEN
    IF v_current_status <> 'ready_to_bill' THEN
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill to send back to Working');
    END IF;
    v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSE
    RETURN jsonb_build_object('error', 'Invalid status');
  END IF;

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to update job status');
  END IF;

  UPDATE public.jobs_ledger SET status = p_to_status, updated_at = NOW() WHERE id = p_job_id;

  INSERT INTO public.job_status_events (job_id, from_status, to_status, changed_by_user_id)
  VALUES (p_job_id, v_current_status, p_to_status, auth.uid());

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.update_job_status(UUID, TEXT) IS 'Updates job status. Forward: working->ready_to_bill (team/office), ready_to_bill->billed, billed->paid (office). Revert: ready_to_bill->working, billed->ready_to_bill, paid->billed (office only).';
