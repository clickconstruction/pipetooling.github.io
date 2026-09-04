SET lock_timeout = '3s';

-- Sub sheet stages (v2.2767): a Sub Labor sheet walks through
--   working → walkthrough → customer_pay   (→ paid, derived when open = $0)
-- The office steps it on Jobs → Sub Labor (either direction); the sub can move
-- working → walkthrough from the portal ("my work here is done", with a note);
-- every move writes one line to the job's Activity feed via the trigger below.
-- Supersedes the two-value portal_status override from 20260902220000 (the
-- column stays, deprecated, so the deployed sub-portal function keeps working
-- until it is redeployed).

ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'working';
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS stage_changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS stage_source text;
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS stage_note text;

DO $$
BEGIN
  ALTER TABLE public.people_labor_jobs
    ADD CONSTRAINT people_labor_jobs_stage_check
    CHECK (stage IN ('working', 'walkthrough', 'customer_pay'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.people_labor_jobs
    ADD CONSTRAINT people_labor_jobs_stage_source_check
    CHECK (stage_source IS NULL OR stage_source IN ('office', 'portal', 'auto'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.people_labor_jobs.stage IS
  'Where the sheet stands between the sub and their money: working (waiting on work) → walkthrough (waiting on our walk-through) → customer_pay (waiting on the customer). Paid is derived (open = $0), never stored.';
COMMENT ON COLUMN public.people_labor_jobs.stage_changed_at IS
  'When the stage last moved.';
COMMENT ON COLUMN public.people_labor_jobs.stage_changed_by IS
  'Office user who moved the stage; NULL when the sub moved it from the portal or automation did.';
COMMENT ON COLUMN public.people_labor_jobs.stage_source IS
  'office | portal | auto — who moved the stage last.';
COMMENT ON COLUMN public.people_labor_jobs.stage_note IS
  'The note that came with the last stage move (the sub''s "anything we should know" text from the portal). Replaced on every move; history lives in job_activity_events.';
COMMENT ON COLUMN public.people_labor_jobs.portal_status IS
  'DEPRECATED (v2.2767): superseded by stage. Not read by the client or the sub-portal function any more.';

-- Carry the old override forward once: "Work complete" meant the walk-through was next.
UPDATE public.people_labor_jobs
SET stage = 'walkthrough', stage_source = 'office'
WHERE portal_status = 'complete' AND stage = 'working' AND stage_changed_at IS NULL;

-- Office label for a stage key (kept in SQL so the Activity line reads like the chip).
CREATE OR REPLACE FUNCTION public.sub_sheet_stage_label(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_stage
    WHEN 'working' THEN 'Waiting on work'
    WHEN 'walkthrough' THEN 'Waiting on walk-through'
    WHEN 'customer_pay' THEN 'Waiting on customer'
    ELSE coalesce(p_stage, 'unset')
  END;
$$;

-- Office writer: step a sheet to any stage (forward or back). Replaces the note.
CREATE OR REPLACE FUNCTION public.set_sub_sheet_stage(
  p_labor_job_id uuid,
  p_stage text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;
  IF p_stage IS NULL OR p_stage NOT IN ('working', 'walkthrough', 'customer_pay') THEN
    RETURN jsonb_build_object('error', 'Unknown stage');
  END IF;

  UPDATE public.people_labor_jobs
  SET stage = p_stage,
      stage_changed_at = now(),
      stage_changed_by = auth.uid(),
      stage_source = 'office',
      stage_note = nullif(btrim(coalesce(p_note, '')), '')
  WHERE id = p_labor_job_id
    AND stage IS DISTINCT FROM p_stage;
  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.people_labor_jobs WHERE id = p_labor_job_id) THEN
      RETURN jsonb_build_object('error', 'Sheet not found');
    END IF;
    RETURN jsonb_build_object('ok', true, 'stage', p_stage, 'unchanged', true);
  END IF;
  RETURN jsonb_build_object('ok', true, 'stage', p_stage);
END;
$$;

COMMENT ON FUNCTION public.set_sub_sheet_stage(uuid, text, text) IS
  'Move a Sub Labor sheet to a stage (working | walkthrough | customer_pay), either direction. Office writers; stamps changed_at/by, source = office, replaces the note.';

REVOKE EXECUTE ON FUNCTION public.set_sub_sheet_stage(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_sub_sheet_stage(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_sub_sheet_stage(uuid, text, text) TO authenticated;

-- Activity writer: same shape as jobs_ledger_completeness_to_activity. The
-- sheet finds its job by number (jobs_ledger.hcp_number = job_number, the
-- Sub Labor tab's own join); a sheet with no matching job still changes
-- stage, it just does not post.
CREATE OR REPLACE FUNCTION public.people_labor_jobs_stage_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_who text;
  v_summary text;
BEGIN
  IF NEW.job_number IS NULL OR btrim(NEW.job_number) = '' THEN
    RETURN NEW;
  END IF;
  SELECT j.id INTO v_job_id
  FROM public.jobs_ledger j
  WHERE lower(btrim(j.hcp_number)) = lower(btrim(NEW.job_number))
  ORDER BY j.created_at DESC NULLS LAST
  LIMIT 1;
  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_who := coalesce(nullif(btrim(NEW.assigned_to_name), ''), 'Sub');
  v_summary := 'Sub labor · ' || v_who || ': '
    || public.sub_sheet_stage_label(OLD.stage) || ' → ' || public.sub_sheet_stage_label(NEW.stage)
    || CASE WHEN NEW.stage_source = 'portal' THEN ' (from the sub portal)' ELSE '' END
    || CASE WHEN NEW.stage_note IS NOT NULL AND NEW.stage_note <> '' THEN ' · “' || NEW.stage_note || '”' ELSE '' END;

  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    v_job_id,
    'sub_stage_change',
    coalesce(NEW.stage_changed_at, now()),
    coalesce(NEW.stage_changed_by, CASE WHEN NEW.stage_source = 'office' THEN auth.uid() ELSE NULL END),
    v_summary,
    jsonb_build_object(
      'source_id', NEW.id,
      'from', OLD.stage,
      'to', NEW.stage,
      'source', NEW.stage_source,
      'contractor', NEW.assigned_to_name,
      'note', NEW.stage_note
    ),
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_labor_jobs_stage_to_activity_upd ON public.people_labor_jobs;
CREATE TRIGGER people_labor_jobs_stage_to_activity_upd
  AFTER UPDATE ON public.people_labor_jobs
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION public.people_labor_jobs_stage_to_activity();
