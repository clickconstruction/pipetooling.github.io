SET lock_timeout = '3s';

-- Punch list #94 (owner, 2026-10-06): some bills will never be collected. A job the office has
-- given up on stays in Collections, under its own band, stamped with the reason, and leaves every
-- "what is coming in" number and the Lien desk. Same shape as the Collections flag
-- (20260704150000): three columns on the job, one RPC, one activity event each way, cleared by the
-- paid trigger. Status stays 'billed'; the Collections flag stays set (Uncollectible is a sub-state
-- of Collections). Nothing is deleted and no bill is rewritten — the books keep what was billed.

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS uncollectible_at timestamptz,
  ADD COLUMN IF NOT EXISTS uncollectible_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uncollectible_reason text;

COMMENT ON COLUMN public.jobs_ledger.uncollectible_at IS
  'When the office gave up on collecting the job (punch list #94). Uncollectible = status=''billed'' AND collections_at IS NOT NULL AND uncollectible_at IS NOT NULL. Out of every owed / collections total and off the Lien desk; cleared with by/reason when the job transitions to paid (trigger jobs_ledger_clear_collections_on_paid) or leaves Collections. Write via set_job_uncollectible().';
COMMENT ON COLUMN public.jobs_ledger.uncollectible_reason IS
  'The reason the office typed when it gave up — required, stamped on the Pipeline row for everyone to read.';

-- Any office staff (the Collections managers' pool: dev, master_technician, assistant, controller —
-- the owner's call, 2026-10-07). The job must be billed and already in Collections; a reason of at
-- least a short sentence when flagging; idempotent; one job_activity_events row each way.
CREATE OR REPLACE FUNCTION public.set_job_uncollectible(p_job_id uuid, p_flagged boolean, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_collections_at TIMESTAMPTZ;
  v_uncollectible_at TIMESTAMPTZ;
  v_open NUMERIC;
  v_reason TEXT;
  v_can_update BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.status, jl.master_user_id, jl.collections_at, jl.uncollectible_at,
         GREATEST(0, COALESCE(jl.revenue, 0) - COALESCE(jl.payments_made, 0))
    INTO v_status, v_master_id, v_collections_at, v_uncollectible_at, v_open
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF v_status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Only a Billed job can be marked Uncollectible');
  END IF;

  IF p_flagged AND v_collections_at IS NULL THEN
    RETURN jsonb_build_object('error', 'Move the job to Collections first');
  END IF;

  -- Office gating, the same pool set_job_collections_flag uses.
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), v_master_id));

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to mark Uncollectible');
  END IF;

  v_reason := NULLIF(TRIM(COALESCE(p_reason, '')), '');

  IF p_flagged AND (v_reason IS NULL OR length(v_reason) < 12) THEN
    RETURN jsonb_build_object('error', 'Write the reason — it is stamped on the row for everyone to read');
  END IF;

  -- Idempotent: no state change -> no write and no duplicate activity event.
  IF p_flagged = (v_uncollectible_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'flagged', p_flagged);
  END IF;

  IF p_flagged THEN
    UPDATE public.jobs_ledger
    SET uncollectible_at = NOW(), uncollectible_by = auth.uid(), uncollectible_reason = v_reason, updated_at = NOW()
    WHERE id = p_job_id;
  ELSE
    UPDATE public.jobs_ledger
    SET uncollectible_at = NULL, uncollectible_by = NULL, uncollectible_reason = NULL, updated_at = NOW()
    WHERE id = p_job_id;
  END IF;

  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    p_job_id,
    'uncollectible_change',
    NOW(),
    auth.uid(),
    CASE WHEN p_flagged
      THEN 'Marked Uncollectible — ' || v_reason
      ELSE 'Put back in Collections'
    END,
    jsonb_build_object('flagged', p_flagged, 'reason', v_reason, 'open_balance', v_open),
    true
  );

  RETURN jsonb_build_object('ok', true, 'flagged', p_flagged);
END;
$function$;

COMMENT ON FUNCTION public.set_job_uncollectible(uuid, boolean, text) IS
  'Marks / unmarks a Collections job as Uncollectible (punch list #94). Office roles; the job must be billed and in Collections; a reason is required when marking; idempotent; writes an uncollectible_change activity event.';

-- Leaving Collections by hand (Send back to Billed) takes the Uncollectible mark with it — a job
-- cannot be given up on outside Collections. Same body as 20260927230000, plus the clear and its
-- event; the duplicated is_office_or_estimator() clause is dropped.
CREATE OR REPLACE FUNCTION public.set_job_collections_flag(p_job_id uuid, p_flagged boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_master_id UUID;
  v_collections_at TIMESTAMPTZ;
  v_uncollectible_at TIMESTAMPTZ;
  v_uncollectible_reason TEXT;
  v_note TEXT;
  v_can_update BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.status, jl.master_user_id, jl.collections_at, jl.uncollectible_at, jl.uncollectible_reason
    INTO v_status, v_master_id, v_collections_at, v_uncollectible_at, v_uncollectible_reason
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
  v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
    AND (v_master_id = auth.uid()
      OR public.is_dev()
      OR public.is_office_or_estimator()
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
    SET collections_at = NULL, collections_by = NULL, collections_note = NULL,
        uncollectible_at = NULL, uncollectible_by = NULL, uncollectible_reason = NULL,
        updated_at = NOW()
    WHERE id = p_job_id;
    IF v_uncollectible_at IS NOT NULL THEN
      INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
      VALUES (p_job_id, 'uncollectible_change', NOW(), auth.uid(), 'Put back in Collections — sent back to Billed',
              jsonb_build_object('flagged', false, 'reason', v_uncollectible_reason, 'auto', true), true);
    END IF;
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
$function$;

-- Paid in full clears the mark too (v2.1642's rule for the Collections flag): if the money turns up,
-- the stamp goes, with its own event.
CREATE OR REPLACE FUNCTION public.clear_job_collections_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uncollectible_at IS NOT NULL THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (
      NEW.id,
      'uncollectible_change',
      NOW(),
      auth.uid(),
      'Uncollectible mark cleared — job paid',
      jsonb_build_object('flagged', false, 'reason', NEW.uncollectible_reason, 'auto', true),
      true
    );
    NEW.uncollectible_at := NULL;
    NEW.uncollectible_by := NULL;
    NEW.uncollectible_reason := NULL;
  END IF;
  IF NEW.collections_at IS NOT NULL THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (
      NEW.id,
      'collections_change',
      NOW(),
      auth.uid(),
      'Removed from Collections — job paid',
      jsonb_build_object('flagged', false, 'note', NEW.collections_note, 'auto', true),
      true
    );
    NEW.collections_at := NULL;
    NEW.collections_by := NULL;
    NEW.collections_note := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_clear_collections_on_paid ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_clear_collections_on_paid
  BEFORE UPDATE OF status ON public.jobs_ledger
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM NEW.status AND (NEW.collections_at IS NOT NULL OR NEW.uncollectible_at IS NOT NULL))
  EXECUTE FUNCTION public.clear_job_collections_on_paid();
