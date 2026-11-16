SET lock_timeout = '3s';

-- Plans by date (punch list #367, PR 3, v2.7496): the columns behind the two things the Development
-- page's By date view cannot draw from what the app records today. Nothing reads them yet; the
-- screens come in the PRs after this one, so this file can be pushed at any quiet moment.
--
-- 1. A schedule on a bid. The owner's call of 2026-11-16: when a bid has a schedule, a person types
--    its start and its end; nothing is counted from the day the bid was sent. An empty start means
--    the bid has no schedule. schedule_open_ended marks a schedule that runs with no end date.
-- 2. A sheet count on a set of drawings. plan_sets.file_count counts the files in a Drive folder,
--    and one PDF can hold sixty sheets, so the sheets in hand need a number of their own.
--
-- Additive and idempotent. The boolean's default is a constant, so no row is rewritten. The checks
-- are added NOT VALID and validated right after: bids and plan_sets are small, the scan takes
-- milliseconds, and every existing row passes, since the new columns are all NULL or false.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS schedule_start date,
  ADD COLUMN IF NOT EXISTS schedule_end date,
  ADD COLUMN IF NOT EXISTS schedule_open_ended boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bids.schedule_start IS 'The day the bid''s promised schedule starts, typed by a person (punch list #367). NULL means the bid has no schedule.';
COMMENT ON COLUMN public.bids.schedule_end IS 'The day the bid''s promised schedule ends, typed by a person (punch list #367). NULL with schedule_open_ended false means no end has been typed yet.';
COMMENT ON COLUMN public.bids.schedule_open_ended IS 'True when the schedule runs with no end date (punch list #367): a start is set and the end is NULL.';

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_schedule_end_needs_start' AND conrelid = 'public.bids'::regclass) THEN
    ALTER TABLE public.bids ADD CONSTRAINT bids_schedule_end_needs_start CHECK (schedule_end IS NULL OR schedule_start IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_schedule_end_after_start' AND conrelid = 'public.bids'::regclass) THEN
    ALTER TABLE public.bids ADD CONSTRAINT bids_schedule_end_after_start CHECK (schedule_end IS NULL OR schedule_start IS NULL OR schedule_end >= schedule_start) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_schedule_open_ended_has_no_end' AND conrelid = 'public.bids'::regclass) THEN
    ALTER TABLE public.bids ADD CONSTRAINT bids_schedule_open_ended_has_no_end CHECK (NOT schedule_open_ended OR (schedule_start IS NOT NULL AND schedule_end IS NULL)) NOT VALID;
  END IF;
END
$do$;

ALTER TABLE public.bids VALIDATE CONSTRAINT bids_schedule_end_needs_start;
ALTER TABLE public.bids VALIDATE CONSTRAINT bids_schedule_end_after_start;
ALTER TABLE public.bids VALIDATE CONSTRAINT bids_schedule_open_ended_has_no_end;

ALTER TABLE public.plan_sets
  ADD COLUMN IF NOT EXISTS sheet_count integer;

COMMENT ON COLUMN public.plan_sets.sheet_count IS 'How many sheets the set has, typed by a person (punch list #367). Not file_count, which counts the files in the set''s Drive folder.';

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_sets_sheet_count_counted' AND conrelid = 'public.plan_sets'::regclass) THEN
    ALTER TABLE public.plan_sets ADD CONSTRAINT plan_sets_sheet_count_counted CHECK (sheet_count IS NULL OR (sheet_count >= 0 AND sheet_count <= 100000)) NOT VALID;
  END IF;
END
$do$;

ALTER TABLE public.plan_sets VALIDATE CONSTRAINT plan_sets_sheet_count_counted;

-- The estimator's read of a development (20261029170000) names its columns one by one, so the
-- schedule would never reach an estimator's By date view without this. The body is that file's,
-- with the three schedule columns on a bid and first_work_date on a job, a date with no money in
-- it, so an estimator's crew lane can draw a job's first work day to its last.
CREATE OR REPLACE FUNCTION public.list_development_overview(p_development_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_development_overview: sign in first' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'list_development_overview: the office team and the estimators read a development' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO v_name FROM public.developments WHERE id = p_development_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'list_development_overview: development % not found', p_development_id;
  END IF;

  RETURN jsonb_build_object(
    'development', jsonb_build_object('id', p_development_id, 'name', v_name),
    'bids', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'bid_number', b.bid_number, 'project_name', b.project_name, 'address', b.address,
        'customer_id', b.customer_id, 'estimator_id', b.estimator_id, 'account_manager_id', b.account_manager_id,
        'development_id', b.development_id, 'outcome', b.outcome, 'outcome_at', b.outcome_at,
        'bid_date_sent', b.bid_date_sent, 'bid_due_date', b.bid_due_date, 'estimated_job_start_date', b.estimated_job_start_date,
        'plans_link', b.plans_link, 'design_drawing_plan_date', b.design_drawing_plan_date,
        'schedule_start', b.schedule_start, 'schedule_end', b.schedule_end, 'schedule_open_ended', b.schedule_open_ended,
        'gc_contact_name', b.gc_contact_name, 'gc_contact_phone', b.gc_contact_phone, 'gc_contact_email', b.gc_contact_email,
        'created_at', b.created_at, 'updated_at', b.updated_at,
        'working_board_archived_at', b.working_board_archived_at, 'working_board_archived_by', b.working_board_archived_by,
        'service_type_id', b.service_type_id, 'last_contact', b.last_contact, 'notes', b.notes
      ) ORDER BY b.created_at)
      FROM public.bids b
      WHERE b.development_id = p_development_id
    ), '[]'::jsonb),
    'jobs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', j.id, 'hcp_number', j.hcp_number, 'click_number', j.click_number, 'job_name', j.job_name, 'job_address', j.job_address,
        'customer_id', j.customer_id, 'customer_name', j.customer_name, 'gc_customer_id', j.gc_customer_id,
        'development_id', j.development_id, 'bid_id', j.bid_id, 'status', j.status,
        'first_work_date', j.first_work_date, 'last_work_date', j.last_work_date, 'job_plans_link', j.job_plans_link,
        'created_at', j.created_at, 'updated_at', j.updated_at, 'service_type_id', j.service_type_id,
        'account_manager_user_id', j.account_manager_user_id
      ) ORDER BY j.created_at)
      FROM public.jobs_ledger j
      WHERE j.development_id = p_development_id
    ), '[]'::jsonb),
    'status_events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'job_id', e.job_id, 'changed_at', e.changed_at, 'from_status', e.from_status, 'to_status', e.to_status, 'changed_by_user_id', e.changed_by_user_id
      ) ORDER BY e.changed_at DESC)
      FROM (
        SELECT ev.id, ev.job_id, ev.changed_at, ev.from_status, ev.to_status, ev.changed_by_user_id
        FROM public.job_status_events ev
        JOIN public.jobs_ledger j ON j.id = ev.job_id
        WHERE j.development_id = p_development_id
        ORDER BY ev.changed_at DESC
        LIMIT 500
      ) e
    ), '[]'::jsonb),
    'team_members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('job_id', t.job_id, 'user_id', t.user_id))
      FROM public.jobs_ledger_team_members t
      JOIN public.jobs_ledger j ON j.id = t.job_id
      WHERE j.development_id = p_development_id
    ), '[]'::jsonb)
  );
END;
$fn$;
