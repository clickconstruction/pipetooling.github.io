-- Job activity ledger (Phase 2): record combine/separate when a job is split.
-- Reproduces split_job_ledger_fixtures_to_new_job verbatim, adding two
-- `job_separated` job_activity_events inserts just before the success return.
-- (The team-member copy below already fires the crew_added trigger on the new job.)

CREATE OR REPLACE FUNCTION public.split_job_ledger_fixtures_to_new_job(p_source_job_id uuid, p_fixture_ids uuid[], p_new_hcp text, p_new_job_name text, p_new_job_address text, p_clock_session_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_src public.jobs_ledger%ROWTYPE;
  v_new_job_id uuid;
  v_split_revenue numeric(14, 2);
  v_total_fixtures int;
  v_move_n int;
  v_new_hcp text;
  v_new_name text;
  v_new_addr text;
  v_blocked_reason text;
  v_bad_fixture int;
  v_bad_session int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  v_new_hcp := trim(COALESCE(p_new_hcp, ''));
  v_new_name := trim(COALESCE(p_new_job_name, ''));
  v_new_addr := trim(COALESCE(p_new_job_address, ''));

  IF p_source_job_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Source job is required');
  END IF;

  IF p_fixture_ids IS NULL OR cardinality(p_fixture_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Select at least one Specific Work line to move');
  END IF;

  IF v_new_hcp = '' OR v_new_name = '' OR v_new_addr = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'New HCP, job name, and address are required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_source_job_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Job not found');
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_source_job_id
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authorized', 'error', 'Not authorized to split this job');
  END IF;

  SELECT CASE
    WHEN jl.status IS DISTINCT FROM 'working' THEN 'Only Working jobs can be split with this tool.'
    WHEN COALESCE(jl.payments_made, 0) <> 0 THEN 'Clear or resolve recorded payments on this job before splitting.'
    WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = p_source_job_id) THEN
      'Remove or resolve invoices on this job before splitting.'
    WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = p_source_job_id) THEN
      'Remove or resolve payments on this job before splitting.'
    WHEN EXISTS (SELECT 1 FROM public.job_collect_payment_flows c WHERE c.job_id = p_source_job_id) THEN
      'Finish or cancel the in-app collect payment flow for this job before splitting.'
    ELSE NULL
  END INTO v_blocked_reason
  FROM public.jobs_ledger jl
  WHERE jl.id = p_source_job_id;

  IF v_blocked_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_blocked', 'error', v_blocked_reason);
  END IF;

  SELECT COUNT(*) INTO v_total_fixtures
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_source_job_id;

  SELECT COUNT(DISTINCT x.id)::int INTO v_move_n
  FROM unnest(p_fixture_ids) AS x(id);

  IF v_total_fixtures = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Source job has no Specific Work lines to split.');
  END IF;

  IF v_move_n >= v_total_fixtures THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_args',
      'error',
      'Leave at least one Specific Work line on the original job, or use Combine / Migrate instead of split.'
    );
  END IF;

  SELECT COUNT(*) INTO v_bad_fixture
  FROM unnest(p_fixture_ids) AS x(id)
  LEFT JOIN public.jobs_ledger_fixtures f ON f.id = x.id AND f.job_id = p_source_job_id
  WHERE f.id IS NULL;

  IF v_bad_fixture > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_fixtures', 'error', 'One or more lines are missing or do not belong to this job.');
  END IF;

  IF p_clock_session_ids IS NOT NULL AND cardinality(p_clock_session_ids) > 0 THEN
    SELECT COUNT(*) INTO v_bad_session
    FROM unnest(p_clock_session_ids) AS x(id)
    LEFT JOIN public.clock_sessions cs ON cs.id = x.id AND cs.job_ledger_id = p_source_job_id
    WHERE cs.id IS NULL;

    IF v_bad_session > 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'invalid_sessions',
        'error',
        'One or more clock sessions are missing or not linked to this job.'
      );
    END IF;
  END IF;

  SELECT COALESCE(
    ROUND(
      SUM(
        CASE
          WHEN trim(COALESCE(f.name, '')) = '' THEN 0::numeric
          ELSE
            (
              CASE
                WHEN f.count IS NOT NULL AND f.count > 0 THEN f.count::numeric
                ELSE 1::numeric
              END
            ) * COALESCE(f.line_unit_price, 0::numeric)
        END
      )::numeric,
      2
    ),
    0::numeric
  ) INTO v_split_revenue
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_source_job_id AND f.id = ANY (p_fixture_ids);

  BEGIN
    SELECT * INTO v_src FROM public.jobs_ledger jl WHERE jl.id = p_source_job_id FOR UPDATE;

    INSERT INTO public.jobs_ledger (
      master_user_id,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      project_id,
      service_type_id,
      bid_id,
      hcp_number,
      job_name,
      job_address,
      google_drive_link,
      job_plans_link,
      job_pictures_link,
      status,
      revenue,
      payments_made,
      pct_complete,
      last_bill_date,
      last_work_date
    )
    VALUES (
      v_src.master_user_id,
      v_src.customer_id,
      v_src.customer_name,
      v_src.customer_email,
      v_src.customer_phone,
      v_src.project_id,
      v_src.service_type_id,
      v_src.bid_id,
      v_new_hcp,
      v_new_name,
      v_new_addr,
      v_src.google_drive_link,
      v_src.job_plans_link,
      v_src.job_pictures_link,
      'working',
      v_split_revenue,
      0,
      NULL,
      NULL,
      NULL
    )
    RETURNING id INTO v_new_job_id;

    UPDATE public.jobs_ledger_fixtures f
    SET job_id = v_new_job_id
    WHERE f.id = ANY (p_fixture_ids);

    IF p_clock_session_ids IS NOT NULL AND cardinality(p_clock_session_ids) > 0 THEN
      UPDATE public.clock_sessions cs
      SET job_ledger_id = v_new_job_id
      WHERE cs.id = ANY (p_clock_session_ids);
    END IF;

    UPDATE public.jobs_ledger jl
    SET revenue = GREATEST(0::numeric, COALESCE(jl.revenue, 0) - v_split_revenue)
    WHERE jl.id = p_source_job_id;

    INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
    SELECT v_new_job_id, jtm.user_id
    FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = p_source_job_id
    ON CONFLICT (job_id, user_id) DO NOTHING;

    -- Ledger: record the split on both the source job and the new job.
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES
      (p_source_job_id, 'job_separated', now(), auth.uid(),
       'Split ' || v_move_n || ' line(s) to new job ' || v_new_hcp,
       jsonb_build_object('new_job_id', v_new_job_id, 'moved_lines', v_move_n,
                          'source_id', p_source_job_id::text || ':sep:' || v_new_job_id::text), false),
      (v_new_job_id, 'job_separated', now(), auth.uid(),
       'Created by splitting ' || v_move_n || ' line(s) from ' || COALESCE(NULLIF(trim(v_src.hcp_number), ''), v_src.job_name, 'job'),
       jsonb_build_object('source_job_id', p_source_job_id,
                          'source_id', v_new_job_id::text || ':sepnew:' || p_source_job_id::text), false);

    RETURN jsonb_build_object('ok', true, 'new_job_id', v_new_job_id, 'split_revenue', v_split_revenue);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'split_failed', 'error', SQLERRM);
  END;
END;
$function$;
