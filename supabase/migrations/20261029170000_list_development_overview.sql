SET lock_timeout = '3s';

-- The estimator's read of a development (punch list #208 PR 6, v2.6053). The Development page reads
-- jobs_ledger, its stage moves and its crews directly, and an estimator has no SELECT on any of them
-- (the office set does: dev, the leaders, the assistants, the controller, a primary on their own
-- jobs), so an estimator who opened /developments/<id> saw the site without its jobs. This definer
-- read hands the GC office team (gc_office_team(): dev, master_technician, assistant, controller,
-- estimator) the development's pieces with no money column at all: the bids and the jobs they became
-- (number, name, status, stage, plans state, the people on them), the jobs' stage moves and crews.
-- Never a bid's value, a job's revenue or payments, a bill, a payment or a collections note. The
-- requests, the bids' entries and notes, the customers, the people and the history entries have
-- reads of their own that the estimator already passes, so the page keeps reading those directly.
-- The office keeps its direct reads; only a reader with no jobs_ledger policy comes through here.

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
        'last_work_date', j.last_work_date, 'job_plans_link', j.job_plans_link,
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

REVOKE ALL ON FUNCTION public.list_development_overview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_development_overview(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_development_overview(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_development_overview(uuid) IS 'The Development page''s read for a reader with no jobs_ledger policy, the estimator (v2.6053): the development''s bids and jobs with number, name, status, stage, plans state and people, the jobs'' stage moves and crews, as one jsonb {development, bids, jobs, status_events, team_members}. No money column at all. SECURITY DEFINER for gc_office_team() (dev, master_technician, assistant, controller, estimator); anyone else is refused.';
