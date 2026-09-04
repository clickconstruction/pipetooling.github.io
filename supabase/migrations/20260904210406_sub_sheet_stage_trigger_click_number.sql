SET lock_timeout = '3s';

-- Sub sheet stages follow-up (v2.2782): the stage → Activity trigger from
-- 20260904195443 found the job by hcp_number only. Click-number jobs (empty
-- hcp_number, the number lives in jobs_ledger.click_number — 92 rows on
-- 2026-09-04) therefore got no Activity line when their sheet moved. Match the
-- way the ledger itself resolves a sheet's job number: HCP first, then the
-- click number. Same trigger name; CREATE OR REPLACE swaps the body in place.

CREATE OR REPLACE FUNCTION public.people_labor_jobs_stage_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_job_id uuid;
  v_who text;
  v_summary text;
BEGIN
  v_key := lower(btrim(coalesce(NEW.job_number, '')));
  IF v_key = '' THEN
    RETURN NEW;
  END IF;

  -- HCP number first (the legacy key), then the click number — never an
  -- empty-string match on either side.
  SELECT j.id INTO v_job_id
  FROM public.jobs_ledger j
  WHERE lower(btrim(coalesce(j.hcp_number, ''))) = v_key
  ORDER BY j.created_at DESC NULLS LAST
  LIMIT 1;
  IF v_job_id IS NULL THEN
    SELECT j.id INTO v_job_id
    FROM public.jobs_ledger j
    WHERE lower(btrim(coalesce(j.click_number, ''))) = v_key
    ORDER BY j.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;
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
