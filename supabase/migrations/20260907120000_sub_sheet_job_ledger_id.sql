SET lock_timeout = '3s';

-- v2.3055: sub sheets link to jobs by id.
--
-- people_labor_jobs.job_number is free text (varchar(10)) and every consumer —
-- the Team board, Subs → Work, Job Summary, the paid-job email, the weekly
-- money payload, the superintendent RLS helper — matched it to
-- jobs_ledger.hcp_number by text, each with its own trim / case / click_number
-- rules. This adds the real link, back-fills it from the number, keeps it in
-- step with number-only writers through a BEFORE trigger, and moves the two
-- server-side consumers that matter most (the stage → activity feed and the
-- superintendent access helper) to id-first with the number as the fallback.
-- Additive and idempotent; job_number stays as the display text.

ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS people_labor_jobs_job_ledger_id_idx
  ON public.people_labor_jobs (job_ledger_id);
COMMENT ON COLUMN public.people_labor_jobs.job_ledger_id IS
  'The job this sheet is on (v2.3055). Set by the office when a job is picked or a sheet is linked, by create_sheet_for_work_order from the work order''s job, and by people_labor_jobs_link_job_ledger() from job_number when a writer only sets the number. job_number stays as the display text.';

-- The one resolver every number → id path uses: HCP number first, then the
-- click number, newest job wins; never an empty-string match.
CREATE OR REPLACE FUNCTION public.resolve_job_ledger_id_by_number(p_number text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT jl.id
  FROM public.jobs_ledger jl
  WHERE NULLIF(btrim(coalesce(p_number, '')), '') IS NOT NULL
    AND (
      lower(btrim(coalesce(jl.hcp_number, ''))) = lower(btrim(p_number))
      OR lower(btrim(coalesce(jl.click_number, ''))) = lower(btrim(p_number))
    )
  ORDER BY (lower(btrim(coalesce(jl.hcp_number, ''))) = lower(btrim(p_number))) DESC,
           jl.created_at DESC NULLS LAST
  LIMIT 1
$$;
COMMENT ON FUNCTION public.resolve_job_ledger_id_by_number(text) IS
  'Sheet number → jobs_ledger.id (v2.3055): trimmed, case-insensitive, HCP number before click number, newest job wins, empty never matches. row_security off so the link does not depend on the writer''s jobs_ledger visibility.';
REVOKE EXECUTE ON FUNCTION public.resolve_job_ledger_id_by_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_job_ledger_id_by_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_job_ledger_id_by_number(text) TO service_role;

-- Keep the link and the number in step for writers that only know one of them:
--   * a number-only writer changes job_number → the link follows the number;
--   * a row with no link and a number → the link is resolved (also heals sheets
--     written before their job existed, on their next write);
--   * a link with no number → the number is filled from the job (display text).
-- A writer that sets job_ledger_id itself is never second-guessed.
CREATE OR REPLACE FUNCTION public.people_labor_jobs_link_job_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.job_number IS DISTINCT FROM OLD.job_number
     AND NEW.job_ledger_id IS NOT DISTINCT FROM OLD.job_ledger_id THEN
    NEW.job_ledger_id := public.resolve_job_ledger_id_by_number(NEW.job_number);
  ELSIF NEW.job_ledger_id IS NULL AND NULLIF(btrim(coalesce(NEW.job_number, '')), '') IS NOT NULL THEN
    NEW.job_ledger_id := public.resolve_job_ledger_id_by_number(NEW.job_number);
  END IF;

  IF NEW.job_ledger_id IS NOT NULL AND NULLIF(btrim(coalesce(NEW.job_number, '')), '') IS NULL THEN
    SELECT left(coalesce(NULLIF(btrim(jl.hcp_number), ''), NULLIF(btrim(jl.click_number), '')), 10)
      INTO NEW.job_number
    FROM public.jobs_ledger jl
    WHERE jl.id = NEW.job_ledger_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS people_labor_jobs_link_job_ledger_biu ON public.people_labor_jobs;
CREATE TRIGGER people_labor_jobs_link_job_ledger_biu
  BEFORE INSERT OR UPDATE ON public.people_labor_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.people_labor_jobs_link_job_ledger();

-- Back-fill every linked-by-number sheet. The stage → activity trigger is
-- AFTER UPDATE WHEN stage changes, so this writes no feed lines; the assignee
-- sync trigger is UPDATE OF assigned_to_name, so it does not fire either.
UPDATE public.people_labor_jobs s
SET job_ledger_id = public.resolve_job_ledger_id_by_number(s.job_number)
WHERE s.job_ledger_id IS NULL
  AND NULLIF(btrim(coalesce(s.job_number, '')), '') IS NOT NULL
  AND public.resolve_job_ledger_id_by_number(s.job_number) IS NOT NULL;

-- create_sheet_for_work_order: the work order's job is already in scope —
-- write the id, not only its number (body otherwise as in 20260906010000).
CREATE OR REPLACE FUNCTION public.create_sheet_for_work_order(p_commitment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.step_commitments%ROWTYPE;
  v_job public.jobs_ledger%ROWTYPE;
  v_sheet_id uuid;
  v_is_service boolean;
  v_role text;
BEGIN
  v_is_service :=
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR coalesce(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
  IF NOT v_is_service THEN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
    IF v_role IS NULL OR v_role NOT IN ('dev','master_technician','assistant','controller','estimator','superintendent') THEN
      RETURN jsonb_build_object('error', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Work order not found');
  END IF;

  -- Superintendents: only a work order on a job that is theirs (v2.2844 rule).
  IF NOT v_is_service AND v_role = 'superintendent'
     AND NOT public.superintendent_can_access_sub_work_order(v_c.labor_job_id, v_c.job_id) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF v_c.labor_job_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'labor_job_id', v_c.labor_job_id, 'created', false);
  END IF;
  IF v_c.job_id IS NULL THEN
    RETURN jsonb_build_object('error', 'This work order has no job to create a sheet on');
  END IF;
  IF v_c.status NOT IN ('accepted', 'approved', 'settled') THEN
    RETURN jsonb_build_object('error', 'The work order is not accepted yet');
  END IF;
  IF v_c.amount IS NULL THEN
    RETURN jsonb_build_object('error', 'The work order has no amount');
  END IF;

  SELECT * INTO v_job FROM public.jobs_ledger WHERE id = v_c.job_id;

  INSERT INTO public.people_labor_jobs
    (master_user_id, assigned_to_name, address, job_number, job_ledger_id, labor_rate, job_date, distance_miles, project_id, step_id)
  VALUES (
    coalesce(v_job.master_user_id, v_c.created_by, auth.uid()),
    v_c.display_name,
    coalesce(v_job.job_address, ''),
    left(coalesce(NULLIF(btrim(v_job.hcp_number), ''), NULLIF(btrim(v_job.click_number), '')), 10),
    v_c.job_id,
    0,
    public.app_today(),
    0,
    v_job.project_id,
    v_c.step_id
  )
  RETURNING id INTO v_sheet_id;

  INSERT INTO public.people_labor_job_items
    (job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order)
  VALUES (
    v_sheet_id,
    left(coalesce(v_c.record_id, 'Work order') || ' — ' || coalesce(NULLIF(btrim(v_job.hcp_number), ''), '') || ' ' || coalesce(v_job.job_address, ''), 200),
    1, 0, true, NULL, v_c.amount, 1
  );

  INSERT INTO public.people_labor_job_assignees (labor_job_id, person_id)
  VALUES (v_sheet_id, v_c.person_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.step_commitments SET labor_job_id = v_sheet_id WHERE id = p_commitment_id;

  RETURN jsonb_build_object('ok', true, 'labor_job_id', v_sheet_id, 'created', true);
END;
$$;

COMMENT ON FUNCTION public.create_sheet_for_work_order(uuid) IS
  'Creates the Sub Labor sheet for an accepted job-anchored work order and links labor_job_id (v2.2819); the sheet carries job_ledger_id from the work order''s job (v2.3055). Callers: the service role (submit-sub-portal after a sub signs), office roles (dev/master_technician/assistant/controller/estimator), and a superintendent only for a work order on a job that is theirs — superintendent_can_access_sub_work_order, the v2.2844 rule (v2.2920).';

-- Stage → activity feed: the sheet's own link first, the number match only for
-- rows that never got one (body otherwise as in 20260905163807).
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
    v_job_id := public.resolve_job_ledger_id_by_number(NEW.job_number);
  END IF;
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

-- Superintendent access to a sheet-anchored work order: the sheet's link
-- first, then its project, then the number (body otherwise as in 20260905120000).
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
            OR (
              s.job_ledger_id IS NULL
              AND s.job_number IS NOT NULL AND btrim(s.job_number) <> ''
              AND EXISTS (
                SELECT 1 FROM public.jobs_ledger jl
                WHERE lower(btrim(jl.hcp_number)) = lower(btrim(s.job_number))
                  AND public.superintendent_report_job_anchor_allowed(jl.id)
              )
            )
          )
      )
    );
$$;

COMMENT ON FUNCTION public.superintendent_can_access_sub_work_order(uuid, uuid) IS
  'Superintendent branch of can_access_sub_work_order (v2.2844): a sheet- or job-anchored work order is theirs when its job passes superintendent_report_job_anchor_allowed (assigned project OR team member), resolving a sheet''s job via job_id, the sheet''s job_ledger_id (v2.3055), its project, or its job_number. Does not check the caller''s role — the caller does. row_security off so the check does not depend on the caller''s people_labor_jobs / jobs_ledger visibility.';
