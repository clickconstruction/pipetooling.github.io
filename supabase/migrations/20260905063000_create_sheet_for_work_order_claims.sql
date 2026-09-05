SET lock_timeout = '3s';

-- v2.2819 (Work Orders tab, PR 2): create_sheet_for_work_order's service-role
-- gate read the legacy `request.jwt.claim.role` setting, which Supabase's
-- PostgREST no longer publishes — it sets the JSON `request.jwt.claims`
-- instead. The submit-sub-portal function (service key) was refused
-- "Not authorized" after a sub signed a job-anchored order, so no sheet was
-- created. Read both settings; office callers unchanged.
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
BEGIN
  v_is_service :=
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR coalesce(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
  IF NOT v_is_service AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Work order not found');
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
    (master_user_id, assigned_to_name, address, job_number, labor_rate, job_date, distance_miles, project_id, step_id)
  VALUES (
    coalesce(v_job.master_user_id, v_c.created_by, auth.uid()),
    v_c.display_name,
    coalesce(v_job.job_address, ''),
    NULLIF(btrim(v_job.hcp_number), ''),
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

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
