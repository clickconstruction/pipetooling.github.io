-- Collections: "difficult to collect" sub-state for Billed jobs.
--
-- A billed job can be parked in a separate "Collections" section (Jobs → Stages and the
-- Dashboard AR drilldown) without leaving status='billed'. Collections is a flag, NOT a sixth
-- status value, so mark_job_paid, AR fetches, reports, and every status='billed' consumer keep
-- working unchanged. Readers must always filter status-first:
--   in collections  = status = 'billed' AND collections_at IS NOT NULL
-- The flag is intentionally sticky across status transitions (no clearing trigger): a stale flag
-- on a paid/ready_to_bill job is invisible everywhere, and if the job returns to billed the
-- collections context resurrects.
--
-- Writes go through set_job_collections_flag() below — the ONE place role gating lives, so a
-- future "collections team" role pool is a single CREATE OR REPLACE here.

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS collections_at timestamptz,
  ADD COLUMN IF NOT EXISTS collections_by uuid,
  ADD COLUMN IF NOT EXISTS collections_note text;

COMMENT ON COLUMN public.jobs_ledger.collections_at IS
  'When the job was flagged difficult-to-collect. In Collections = status=''billed'' AND collections_at IS NOT NULL (readers filter status-first; the flag is sticky across status transitions). Write via set_job_collections_flag().';
COMMENT ON COLUMN public.jobs_ledger.collections_by IS
  'User who flagged the job into Collections (auth.uid() at flag time).';
COMMENT ON COLUMN public.jobs_ledger.collections_note IS
  'Optional reason captured when moving to Collections (e.g. "customer disputing invoice").';

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
  WHERE jl.id = p_job_id;

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

GRANT EXECUTE ON FUNCTION public.set_job_collections_flag(uuid, boolean, text) TO authenticated;

COMMENT ON FUNCTION public.set_job_collections_flag(uuid, boolean, text) IS
  'Flags/unflags a Billed job as in Collections (difficult to collect). Office roles (dev/master_technician/assistant) with master access only; job must be status=''billed''. Stamps collections_at/by/note, logs a collections_change job_activity_events row. Idempotent on repeated calls with the same flag state.';
