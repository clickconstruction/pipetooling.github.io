-- Job Status Pipeline: Add status to jobs_ledger, job_status_events table, and RPCs
-- Status flow: working -> ready_to_bill -> billed -> paid

-- ============================================================================
-- jobs_ledger: add status column
-- ============================================================================

ALTER TABLE public.jobs_ledger
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'working';

ALTER TABLE public.jobs_ledger
DROP CONSTRAINT IF EXISTS jobs_ledger_status_check;

ALTER TABLE public.jobs_ledger
ADD CONSTRAINT jobs_ledger_status_check
CHECK (status IN ('working', 'ready_to_bill', 'billed', 'paid'));

COMMENT ON COLUMN public.jobs_ledger.status IS 'Job billing status: working, ready_to_bill, billed, paid';

-- ============================================================================
-- job_status_events: audit trail for status changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_status_events_job_id ON public.job_status_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_events_changed_at ON public.job_status_events(changed_at);

ALTER TABLE public.job_status_events ENABLE ROW LEVEL SECURITY;

-- Same visibility as jobs_ledger for dev/master/assistant; subs see only events for jobs they're assigned to
CREATE POLICY "job_status_events_select"
ON public.job_status_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = job_status_events.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);

-- Insert: user must have permission to update the job (validated by update_job_status RPC)
CREATE POLICY "job_status_events_insert"
ON public.job_status_events
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = job_status_events.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);

COMMENT ON TABLE public.job_status_events IS 'Audit trail for job status changes (working, ready_to_bill, billed, paid)';

-- ============================================================================
-- RPC: list_assigned_jobs_for_dashboard
-- Returns jobs where user is team member and status = 'working'
-- Used for Assigned Jobs section on Dashboard (all users)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_assigned_jobs_for_dashboard()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  revenue NUMERIC,
  master_user_id UUID,
  created_at TIMESTAMPTZ
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
    jl.revenue,
    jl.master_user_id,
    jl.created_at
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'working'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_assigned_jobs_for_dashboard() IS 'Jobs assigned to current user with status working. For Dashboard Assigned Jobs.';

-- ============================================================================
-- RPC: update_job_status
-- Validates transition, updates jobs_ledger, inserts job_status_events
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Get current job state
  SELECT jl.status, jl.master_user_id INTO v_current_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Validate transition
  IF p_to_status = 'ready_to_bill' THEN
    IF v_current_status <> 'working' THEN
      RETURN jsonb_build_object('error', 'Job must be in Working to mark Ready for Billing');
    END IF;
    -- Allowed: user is team member OR dev/master/assistant with visibility
    v_can_update := EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = p_job_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSIF p_to_status = 'billed' THEN
    IF v_current_status <> 'ready_to_bill' THEN
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill to mark as Billed');
    END IF;
    -- Allowed: dev/master/assistant with visibility only
    v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSIF p_to_status = 'paid' THEN
    IF v_current_status <> 'billed' THEN
      RETURN jsonb_build_object('error', 'Job must be in Billed to mark as Paid');
    END IF;
    -- Same as billed
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

  -- Update job
  UPDATE public.jobs_ledger SET status = p_to_status, updated_at = NOW() WHERE id = p_job_id;

  -- Insert event (bypass RLS insert policy via SECURITY DEFINER)
  INSERT INTO public.job_status_events (job_id, from_status, to_status, changed_by_user_id)
  VALUES (p_job_id, v_current_status, p_to_status, auth.uid());

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.update_job_status(UUID, TEXT) IS 'Updates job status with validation and audit trail. working->ready_to_bill: team member or office; ready_to_bill->billed, billed->paid: office only.';
