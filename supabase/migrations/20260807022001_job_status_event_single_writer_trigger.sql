SET lock_timeout = '3s';

-- job_status_events single-writer trigger (v2.1435) — Phase 0 of the Weekly
-- movement report. Before this, only update_job_status and the clock-out
-- promote trigger logged status transitions; the four mark-paid RPCs, the
-- payment-reconcile/revert paths, and client-side demotes flipped
-- jobs_ledger.status with NO event row — jobs going Paid were invisible to
-- any transition history.
--
-- Design: ONE writer. An AFTER UPDATE trigger on jobs_ledger logs every
-- status change (from, to, auth.uid() — NULL for service-role writers like
-- the Stripe webhook, which reads as "Stripe" in the UI). The two functions
-- that used to INSERT events explicitly are rebuilt from their LIVE prod
-- bodies (pg_get_functiondef, v2.1400 rule; closer semicolons per the
-- v2.1428 lesson) with their INSERTs removed so nothing double-logs.
-- RULE: no function may INSERT INTO job_status_events again — the trigger
-- is the single writer.

CREATE OR REPLACE FUNCTION public.log_job_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_status_events (job_id, from_status, to_status, changed_by_user_id)
  VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_log_status_transition ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_log_status_transition
  AFTER UPDATE OF status ON public.jobs_ledger
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.log_job_status_transition();

-- ── update_job_status: live body minus its explicit event INSERT ─────────────

CREATE OR REPLACE FUNCTION public.update_job_status(p_job_id uuid, p_to_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
  v_deleted_rtb INTEGER := 0;
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
      v_can_update :=
        -- Team-member path: any team member, including helpers.
        EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = p_job_id AND user_id = auth.uid())
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
          AND (v_master_id = auth.uid()
            OR public.is_dev()
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
            OR public.assistants_share_master(auth.uid(), v_master_id)))
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
          AND EXISTS (
            SELECT 1 FROM public.jobs_ledger jl2
            JOIN public.projects p ON p.id = jl2.project_id
            WHERE jl2.id = p_job_id
              AND (EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = p.id AND superintendent_id = auth.uid())
                OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = p.master_user_id AND superintendent_id = auth.uid()))
          ));
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
      -- Revert: paid -> billed (dev/master/assistant/primary with job access)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
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
    IF v_current_status = 'ready_to_bill' THEN
      -- Revert: ready_to_bill -> working (office only; deletes RTB drafts below)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSIF v_current_status = 'waiting' THEN
      -- Manual promote: waiting -> working (office only; no side effects)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill or Waiting to move to Working');
    END IF;
  ELSIF p_to_status = 'waiting' THEN
    -- Send back: working -> waiting (office only; no side effects)
    IF v_current_status <> 'working' THEN
      RETURN jsonb_build_object('error', 'Job must be in Working to send back to Waiting');
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

  IF p_to_status = 'working' AND v_current_status = 'ready_to_bill' THEN
    DELETE FROM public.jobs_ledger_invoices
    WHERE job_id = p_job_id
      AND status = 'ready_to_bill';
    GET DIAGNOSTICS v_deleted_rtb = ROW_COUNT;
  END IF;

  UPDATE public.jobs_ledger SET status = p_to_status, updated_at = NOW() WHERE id = p_job_id;

  -- Event logging moved to the jobs_ledger_log_status_transition trigger
  -- (v2.1435 single-writer rule) — do NOT reintroduce an INSERT here.

  RETURN jsonb_build_object('ok', true, 'deleted_ready_to_bill_invoices', v_deleted_rtb);
END;
$function$;


-- ── clock-out promote: live body minus its explicit event INSERT ─────────────

CREATE OR REPLACE FUNCTION public.clock_sessions_promote_job_waiting_to_working()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_promoted integer := 0;
BEGIN
  -- Only act when this row represents real, clocked-out work on a job.
  IF NEW.clocked_out_at IS NULL
     OR NEW.job_ledger_id IS NULL
     OR NEW.rejected_at IS NOT NULL
     OR NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only proceed when clocked_out_at actually transitioned
  -- (ignores notes/job edits on an already-closed session re-touching the column).
  IF TG_OP = 'UPDATE' AND OLD.clocked_out_at IS NOT DISTINCT FROM NEW.clocked_out_at THEN
    RETURN NEW;
  END IF;

  UPDATE public.jobs_ledger jl
  SET status = 'working', updated_at = NOW()
  WHERE jl.id = NEW.job_ledger_id
    AND jl.status = 'waiting';
  GET DIAGNOSTICS v_promoted = ROW_COUNT;

  -- Event logging moved to the jobs_ledger_log_status_transition trigger
  -- (v2.1435 single-writer rule) — the clock-in runs under the tech's JWT, so
  -- auth.uid() preserves the same attribution the explicit INSERT had.

  RETURN NEW;
END;
$function$;

