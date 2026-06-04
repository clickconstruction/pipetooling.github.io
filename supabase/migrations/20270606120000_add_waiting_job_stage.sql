-- Add a "Waiting" job stage as the new FIRST stage in the jobs pipeline.
-- Pipeline becomes: waiting -> working -> ready_to_bill -> billed -> paid
--
-- Behavior:
--   * New jobs default to 'waiting' (was 'working').
--   * A job auto-promotes 'waiting' -> 'working' the moment a clock session on it
--     is clocked out (first real work logged) -- via trigger below.
--   * Office (dev/master_technician/assistant) can manually move 'waiting' <-> 'working'
--     via update_job_status.
--   * Waiting jobs still appear in list_assigned_jobs_for_dashboard (so a tech can
--     find and clock into a brand-new job).
-- Existing 'working' jobs are left unchanged (no backfill).

-- ============================================================================
-- 1. Allow the new value (CHECK before default).
-- ============================================================================
ALTER TABLE public.jobs_ledger DROP CONSTRAINT IF EXISTS jobs_ledger_status_check;
ALTER TABLE public.jobs_ledger ADD CONSTRAINT jobs_ledger_status_check
  CHECK (status IN ('waiting', 'working', 'ready_to_bill', 'billed', 'paid'));
COMMENT ON COLUMN public.jobs_ledger.status IS 'Job billing status: waiting, working, ready_to_bill, billed, paid';

-- ============================================================================
-- 2. New jobs default to Waiting (propagates through create_job_from_estimate,
--    which omits status on insert).
-- ============================================================================
ALTER TABLE public.jobs_ledger ALTER COLUMN status SET DEFAULT 'waiting';

-- ============================================================================
-- 3. Auto-promote: waiting -> working when a clock session is clocked out.
--    Idempotent via the status='waiting' guard; audits with the session's
--    user_id; ignores rejected/revoked; fires on INSERT (leader-split inserts
--    of already-completed sessions) and on UPDATE OF clocked_out_at.
--    SECURITY DEFINER so a field worker (no office job access) can promote and
--    write the audit row, mirroring update_job_status.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.clock_sessions_promote_job_waiting_to_working()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_promoted = 1 THEN
    INSERT INTO public.job_status_events (job_id, from_status, to_status, changed_by_user_id)
    VALUES (NEW.job_ledger_id, 'waiting', 'working', NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.clock_sessions_promote_job_waiting_to_working() IS
  'After a clock session is clocked out (non-rejected/revoked, linked to a job), auto-promote that job from waiting to working and log a job_status_events row. Idempotent via status=waiting guard.';
REVOKE ALL ON FUNCTION public.clock_sessions_promote_job_waiting_to_working() FROM PUBLIC;

DROP TRIGGER IF EXISTS clock_sessions_promote_job_waiting_to_working_ins ON public.clock_sessions;
CREATE TRIGGER clock_sessions_promote_job_waiting_to_working_ins
  AFTER INSERT ON public.clock_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.clock_sessions_promote_job_waiting_to_working();

DROP TRIGGER IF EXISTS clock_sessions_promote_job_waiting_to_working_upd ON public.clock_sessions;
CREATE TRIGGER clock_sessions_promote_job_waiting_to_working_upd
  AFTER UPDATE OF clocked_out_at ON public.clock_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.clock_sessions_promote_job_waiting_to_working();

-- ============================================================================
-- 4. update_job_status: add manual office moves waiting <-> working.
--    Based on 20270506120000_update_job_status_disallow_helpers_send_to_billing.sql.
--    Changes vs that version:
--      * p_to_status='working' now accepts TWO sources: ready_to_bill (existing
--        revert, deletes RTB drafts) and waiting (new manual promote, no side effects).
--      * New p_to_status='waiting' branch: working -> waiting (office send-back).
--    The RTB-delete block still keys on v_current_status='ready_to_bill', so the
--    waiting->working path never deletes invoices.
-- ============================================================================
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
        (
          EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = p_job_id AND user_id = auth.uid())
          AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'helpers')
        )
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

  INSERT INTO public.job_status_events (job_id, from_status, to_status, changed_by_user_id)
  VALUES (p_job_id, v_current_status, p_to_status, auth.uid());

  RETURN jsonb_build_object('ok', true, 'deleted_ready_to_bill_invoices', v_deleted_rtb);
END;
$$;
COMMENT ON FUNCTION public.update_job_status(UUID, TEXT) IS 'Updates job status. Forward: waiting->working (office; also auto via clock-out trigger), working->ready_to_bill (team/office/superintendent; helpers cannot use team path), ready_to_bill->billed, billed->paid (office). Revert: working->waiting, ready_to_bill->working (deletes RTB draft invoices), billed->ready_to_bill, paid->billed (dev/master/assistant/primary with job access).';

-- ============================================================================
-- 5. Surface Waiting jobs in the dashboard / clock-in assigned-jobs list.
--    Based on 20270518120000_list_assigned_jobs_service_type_name.sql; only the
--    final WHERE filter changes (status='working' -> status IN ('waiting','working')).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_assigned_jobs_for_dashboard()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  google_drive_link TEXT,
  job_plans_link TEXT,
  job_pictures_link TEXT,
  revenue NUMERIC,
  master_user_id UUID,
  created_at TIMESTAMPTZ,
  last_report_at TIMESTAMPTZ,
  my_last_report_at TIMESTAMPTZ,
  last_thread_note_at TIMESTAMPTZ,
  last_clock_activity_at TIMESTAMPTZ,
  last_schedule_activity_at TIMESTAMPTZ,
  last_job_activity_at TIMESTAMPTZ,
  project_id UUID,
  in_progress_stage_name TEXT,
  in_progress_step_id UUID,
  status TEXT,
  service_type_id UUID,
  service_type_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    jl.hcp_number,
    jl.job_name,
    jl.job_address,
    jl.google_drive_link,
    jl.job_plans_link,
    jl.job_pictures_link,
    jl.revenue,
    jl.master_user_id,
    jl.created_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id) AS last_report_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    (SELECT max(n.created_at) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = jl.id) AS last_thread_note_at,
    (SELECT max(coalesce(cs.clocked_out_at, cs.clocked_in_at))
     FROM public.clock_sessions cs
     WHERE cs.job_ledger_id = jl.id
       AND cs.approved_at IS NOT NULL
       AND cs.rejected_at IS NULL
       AND cs.revoked_at IS NULL) AS last_clock_activity_at,
    (SELECT max(greatest(jb.created_at, jb.updated_at))
     FROM public.job_schedule_blocks jb
     WHERE jb.job_id = jl.id) AS last_schedule_activity_at,
    (SELECT max(x.v) FROM (
      SELECT (SELECT max(n2.created_at) FROM public.jobs_ledger_thread_notes n2 WHERE n2.job_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(r2.created_at) FROM public.reports r2 WHERE r2.job_ledger_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(coalesce(cs2.clocked_out_at, cs2.clocked_in_at))
              FROM public.clock_sessions cs2
              WHERE cs2.job_ledger_id = jl.id
                AND cs2.approved_at IS NOT NULL
                AND cs2.rejected_at IS NULL
                AND cs2.revoked_at IS NULL) AS v
      UNION ALL
      SELECT (SELECT max(greatest(jb2.created_at, jb2.updated_at))
              FROM public.job_schedule_blocks jb2
              WHERE jb2.job_id = jl.id) AS v
    ) x) AS last_job_activity_at,
    jl.project_id,
    (SELECT s.name
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = jl.project_id
     LIMIT 1) AS in_progress_stage_name,
    (SELECT s.id
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = jl.project_id
     LIMIT 1) AS in_progress_step_id,
    jl.status::text,
    jl.service_type_id,
    (SELECT stn.name FROM public.service_types stn WHERE stn.id = jl.service_type_id LIMIT 1) AS service_type_name
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status IN ('waiting', 'working')
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_assigned_jobs_for_dashboard() IS
  'Team waiting+working jobs for dashboard. last_report_at = any author; my_last_report_at = current user. job_pictures_link, service_type_id, service_type_name. Returns status so callers can distinguish waiting vs working.';

GRANT EXECUTE ON FUNCTION public.list_assigned_jobs_for_dashboard() TO authenticated;
