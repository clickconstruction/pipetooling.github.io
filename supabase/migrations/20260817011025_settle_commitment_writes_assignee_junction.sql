SET lock_timeout = '3s';

-- Person-identity Phase D (docs/PERSON_IDENTITY_PLAN.md): settle_step_commitment
-- knows the sub's people.id (step_commitments.person_id is NOT NULL) but was
-- writing only display_name onto the sheet, leaving the assignee junction to
-- resolve_pay_person_id's name lookup. Now it also inserts the junction row
-- directly, so the sheet is id-linked even when the display name doesn't
-- resolve (renamed or archived person). ON CONFLICT DO NOTHING — the
-- sync_people_labor_job_assignees trigger usually minted the row already.
--
-- Body otherwise identical to 20260801170000_settle_step_commitment_rpc.sql.

CREATE OR REPLACE FUNCTION public.settle_step_commitment("p_commitment_id" uuid, "p_dry_run" boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_c public.step_commitments%ROWTYPE;
  v_step public.project_workflow_steps%ROWTYPE;
  v_workflow public.project_workflows%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_labor_job_id uuid;
  v_created_new boolean := false;
  v_release numeric(12,2);
  v_job_number character varying(10);
  v_job_count integer;
  v_report jsonb;
  v_detail text;
BEGIN
  -- Office set only (superintendents accept, they do not release money).
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;
  IF NOT public.can_access_project_via_step(v_c.step_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF v_c.status IN ('settled','cancelled') THEN
    RAISE EXCEPTION 'Work order is already %', v_c.status;
  END IF;

  SELECT * INTO v_step FROM public.project_workflow_steps WHERE id = v_c.step_id;
  SELECT * INTO v_workflow FROM public.project_workflows WHERE id = v_step.workflow_id;
  SELECT * INTO v_project FROM public.projects WHERE id = v_workflow.project_id;

  v_release := round(v_c.amount * (1 - v_c.retainage_pct / 100.0), 2);

  -- HCP number: only when the project has exactly one linked job (unambiguous).
  SELECT count(*) INTO v_job_count FROM public.jobs_ledger jl WHERE jl.project_id = v_project.id;
  IF v_job_count = 1 THEN
    SELECT NULLIF(btrim(jl.hcp_number), '') INTO v_job_number
    FROM public.jobs_ledger jl WHERE jl.project_id = v_project.id;
  END IF;

  BEGIN
    IF v_c.labor_job_id IS NOT NULL THEN
      v_labor_job_id := v_c.labor_job_id;
    ELSE
      v_created_new := true;
      INSERT INTO public.people_labor_jobs
        (master_user_id, assigned_to_name, address, job_number, labor_rate, job_date, distance_miles, project_id, step_id)
      VALUES (
        COALESCE(v_project.master_user_id, auth.uid()),
        v_c.display_name,
        COALESCE(v_project.address, ''),
        v_job_number,
        0,
        (now() AT TIME ZONE 'America/Chicago')::date,
        0,
        v_project.id,
        v_c.step_id
      )
      RETURNING id INTO v_labor_job_id;

      INSERT INTO public.people_labor_job_items
        (job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order)
      VALUES (
        v_labor_job_id,
        left(v_step.name || ' — ' || v_project.name, 200),
        1, 0, true, NULL, v_release, 1
      );
    END IF;

    -- Phase D: id-link the sheet to the commitment's person directly. The
    -- assigned_to_name sync trigger usually minted this row from the display
    -- name; this insert guarantees it when that name doesn't resolve.
    INSERT INTO public.people_labor_job_assignees (labor_job_id, person_id)
    VALUES (v_labor_job_id, v_c.person_id)
    ON CONFLICT DO NOTHING;

    UPDATE public.step_commitments
    SET status = 'settled',
        settled_at = now(),
        approved_at = COALESCE(approved_at, now()),
        labor_job_id = v_labor_job_id
    WHERE id = p_commitment_id;

    v_report := jsonb_build_object(
      'commitment_id', v_c.id,
      'labor_job_id', v_labor_job_id,
      'display_name', v_c.display_name,
      'agreed_amount', v_c.amount,
      'retainage_pct', v_c.retainage_pct,
      'released_amount', v_release,
      'job_number', v_job_number,
      'created_new_sheet', v_created_new
    );

    IF p_dry_run THEN
      RAISE EXCEPTION USING message = '__settle_dry_run__', detail = v_report::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = '__settle_dry_run__' THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      RETURN v_detail::jsonb;
    END IF;
    RAISE;
  END;

  RETURN v_report;
END;
$$;

COMMENT ON FUNCTION public.settle_step_commitment(uuid, boolean) IS
  'Settles a step commitment: creates/reuses the anchored people_labor_jobs sub sheet with one direct-amount line = amount x (1 - retainage_pct/100), id-links the assignee junction from person_id, links labor_job_id, flips status to settled. p_dry_run rolls back and returns the same report (sentinel-exception technique).';

GRANT ALL ON FUNCTION public.settle_step_commitment(uuid, boolean) TO anon;
GRANT ALL ON FUNCTION public.settle_step_commitment(uuid, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.settle_step_commitment(uuid, boolean) TO service_role;
