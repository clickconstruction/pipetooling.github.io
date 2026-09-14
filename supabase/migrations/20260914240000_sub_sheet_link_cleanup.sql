SET lock_timeout = '3s';

-- Sub sheets read their job by id only (closes to-dos/sub-sheet-job-link-followups.md).
--
-- v2.3055 added people_labor_jobs.job_ledger_id and back-filled it; v2.3059–v2.3071
-- moved every reader to the link and kept a "number fallback" for one release.
-- Measured 2026-09-14: 0 of 77 sheets have job_ledger_id IS NULL. This drops the
-- fallbacks, retires the two number-lookup RPCs the client no longer calls, and
-- widens job_number from varchar(10) to text — it is display text now, and the
-- cap silently truncated longer numbers. resolve_job_ledger_id_by_number stays,
-- used only by the BEFORE trigger people_labor_jobs_link_job_ledger() that fills
-- the link when a writer only sets the number. Idempotent.

-- 1) Stage → activity feed: the sheet's link only (body otherwise as in 20260907120000).
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
  v_job_id := NEW.job_ledger_id;
  IF v_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_who := coalesce(nullif(btrim(NEW.assigned_to_name), ''), 'Sub');
  v_summary := v_who || ': '
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

-- 2) Superintendent access to a sheet-anchored work order: the sheet's link,
-- then its project. No number match (body otherwise as in 20260907120000).
CREATE OR REPLACE FUNCTION public.superintendent_can_access_sub_work_order(p_labor_job_id uuid, p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    (p_job_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(p_job_id))
    OR (
      p_labor_job_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.people_labor_jobs s
        WHERE s.id = p_labor_job_id
          AND (
            (s.job_ledger_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(s.job_ledger_id))
            OR (s.project_id IS NOT NULL AND public.can_access_project_row(s.project_id))
          )
      )
    );
$$;

COMMENT ON FUNCTION public.superintendent_can_access_sub_work_order(uuid, uuid) IS
  'Superintendent branch of can_access_sub_work_order (v2.2844): a sheet- or job-anchored work order is theirs when its job passes superintendent_report_job_anchor_allowed (assigned project OR team member), resolving a sheet''s job via job_id, the sheet''s job_ledger_id (v2.3055) or its project — never its job_number (the number fallback was retired once every sheet carried a link). Does not check the caller''s role — the caller does. row_security off so the check does not depend on the caller''s people_labor_jobs / jobs_ledger visibility.';

-- 3) The two number-lookup RPCs: People → Review was the last caller and now
-- reads job_ledger_id through get_jobs_ledger_by_ids[_paid_only].
DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_hcp_numbers(text[]);
DROP FUNCTION IF EXISTS public.get_jobs_ledger_by_hcp_numbers_paid_only(text[]);

-- 4) job_number is display text — no 10-character cap.
ALTER TABLE public.people_labor_jobs
  ALTER COLUMN job_number TYPE text;
COMMENT ON COLUMN public.people_labor_jobs.job_number IS
  'Optional job number, display text only. Shown in the Labor form and the Ledger; the sheet''s job is job_ledger_id (v2.3055), which people_labor_jobs_link_job_ledger() fills from this number when a writer sets only the number.';
