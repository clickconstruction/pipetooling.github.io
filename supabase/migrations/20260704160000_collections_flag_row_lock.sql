-- Concurrency hardening for set_job_collections_flag (found during edge-case testing):
-- the initial status/flag read had no row lock, so two simultaneous calls could both pass
-- the idempotency check and insert duplicate collections_change activity events. Adding
-- FOR UPDATE serializes callers on the job row; the second caller then re-reads the flag
-- state post-commit and hits the idempotent early-return. Verbatim CREATE OR REPLACE of
-- 20260704150000's function with only that change.

CREATE OR REPLACE FUNCTION public.set_job_collections_flag(
  p_job_id uuid,
  p_flagged boolean,
  p_note text DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_collections_at TIMESTAMPTZ;
  v_note TEXT;
  v_can_update BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.status, jl.master_user_id, jl.collections_at
    INTO v_status, v_master_id, v_collections_at
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF v_status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Job must be in Billed Awaiting Payment to change Collections');
  END IF;

  -- Office gating, same shape as update_job_status transitions (dev/master_technician/assistant
  -- with master access). Widening Collections to another role pool happens here and only here.
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = v_master_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = v_master_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), v_master_id));

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to change Collections');
  END IF;

  -- Idempotent: no state change -> no write and no duplicate activity event.
  IF p_flagged = (v_collections_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'flagged', p_flagged);
  END IF;

  v_note := NULLIF(TRIM(COALESCE(p_note, '')), '');

  IF p_flagged THEN
    UPDATE public.jobs_ledger
    SET collections_at = NOW(), collections_by = auth.uid(), collections_note = v_note, updated_at = NOW()
    WHERE id = p_job_id;
  ELSE
    UPDATE public.jobs_ledger
    SET collections_at = NULL, collections_by = NULL, collections_note = NULL, updated_at = NOW()
    WHERE id = p_job_id;
  END IF;

  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    p_job_id,
    'collections_change',
    NOW(),
    auth.uid(),
    CASE WHEN p_flagged
      THEN 'Moved to Collections' || COALESCE(' — ' || v_note, '')
      ELSE 'Returned to Billed Awaiting Payment'
    END,
    jsonb_build_object('flagged', p_flagged, 'note', v_note),
    true
  );

  RETURN jsonb_build_object('ok', true, 'flagged', p_flagged);
END;
$$;

COMMENT ON FUNCTION public.set_job_collections_flag(uuid, boolean, text) IS
  'Flags/unflags a Billed job as in Collections (difficult to collect). Office roles (dev/master_technician/assistant) with master access only; job must be status=''billed''. Row-locked read (FOR UPDATE) serializes concurrent callers. Stamps collections_at/by/note, logs a collections_change job_activity_events row. Idempotent on repeated calls with the same flag state.';
