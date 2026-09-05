SET lock_timeout = '3s';

-- Work Orders tab, PR 1 (v2.2814 — owner-approved 2026-09-04, mock-up artifact
-- 65bcf6a3): the work order becomes the document that connects a job to sub
-- labor, assembled on Jobs → Work Orders and from the job window.
--
-- Three things change on step_commitments:
--   1. A third anchor: job_id. A draft written at intake ("that one goes to
--      Behar") exists before any sheet or step. Signing (or Mark accepted)
--      creates the Sub Labor sheet from the agreed amount — see
--      create_sheet_for_work_order — and links labor_job_id.
--   2. Unpriced drafts: amount may be NULL while status = 'draft', so an
--      assistant can capture the sub and the scope and leave the price to the
--      master (the Needs You item counts these).
--   3. record_id: WO-<job number>-NN, minted at send by
--      next_work_order_record_id, printed on the document.
-- Sheet-anchored rows are back-filled with their job so the board groups
-- by job. Idempotent; additive apart from the NOT NULL drop on amount.

-- 1) The job anchor -----------------------------------------------------------

ALTER TABLE public.step_commitments
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE;
ALTER TABLE public.step_commitments
  ADD COLUMN IF NOT EXISTS record_id text;

ALTER TABLE public.step_commitments ALTER COLUMN amount DROP NOT NULL;

ALTER TABLE public.step_commitments DROP CONSTRAINT IF EXISTS step_commitments_anchor_check;
ALTER TABLE public.step_commitments
  ADD CONSTRAINT step_commitments_anchor_check
  CHECK (step_id IS NOT NULL OR labor_job_id IS NOT NULL OR job_id IS NOT NULL);

DO $$
BEGIN
  ALTER TABLE public.step_commitments
    ADD CONSTRAINT step_commitments_amount_when_sent_check
    CHECK (amount IS NOT NULL OR status = 'draft');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_step_commitments_job_id ON public.step_commitments (job_id);
CREATE UNIQUE INDEX IF NOT EXISTS step_commitments_record_id_uniq
  ON public.step_commitments (record_id) WHERE record_id IS NOT NULL;
-- One live job-anchored order per (job, sub); a sheet or step anchor has its own rule.
CREATE UNIQUE INDEX IF NOT EXISTS step_commitments_job_person_live_uniq
  ON public.step_commitments (job_id, person_id)
  WHERE step_id IS NULL AND labor_job_id IS NULL AND status <> 'cancelled';

COMMENT ON COLUMN public.step_commitments.job_id IS
  'The job (jobs_ledger) this work order is for. Set directly for orders drafted from the job window / Work Orders tab; back-filled from the sheet''s job number for sheet-anchored orders. NULL only for legacy step orders whose project has no single job.';
COMMENT ON COLUMN public.step_commitments.record_id IS
  'WO-<job number>-NN, minted at send (next_work_order_record_id); printed on the document and the portal.';
COMMENT ON COLUMN public.step_commitments.amount IS
  'Agreed amount. NULL only while status = draft (an unpriced draft waiting on the master); fixed at send.';

-- Back-fill: sheet-anchored orders learn their job from the sheet's number.
UPDATE public.step_commitments c
SET job_id = j.id
FROM public.people_labor_jobs s
JOIN LATERAL (
  SELECT jl.id FROM public.jobs_ledger jl
  WHERE lower(btrim(jl.hcp_number)) = lower(btrim(s.job_number))
  ORDER BY jl.created_at DESC NULLS LAST
  LIMIT 1
) j ON true
WHERE c.labor_job_id = s.id
  AND c.job_id IS NULL
  AND s.job_number IS NOT NULL AND btrim(s.job_number) <> '';

-- 2) Access helper with the third anchor ------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_sub_work_order(p_step_id uuid, p_labor_job_id uuid, p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_step_id IS NOT NULL THEN public.can_access_project_via_step(p_step_id)
    WHEN p_labor_job_id IS NOT NULL OR p_job_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
    )
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.can_access_sub_work_order(uuid, uuid, uuid) IS
  'Row access for step_commitments: step rows follow the project; sheet- and job-anchored rows are visible to the office set + superintendents.';

REVOKE EXECUTE ON FUNCTION public.can_access_sub_work_order(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_sub_work_order(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS sc_select ON public.step_commitments;
CREATE POLICY sc_select ON public.step_commitments FOR SELECT USING (
  public.can_access_sub_work_order(step_id, labor_job_id, job_id)
  OR EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = step_commitments.person_id AND p.account_user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND btrim(u.name) = btrim(step_commitments.display_name)
  )
);

DROP POLICY IF EXISTS sc_insert ON public.step_commitments;
CREATE POLICY sc_insert ON public.step_commitments FOR INSERT WITH CHECK (
  public.can_access_sub_work_order(step_id, labor_job_id, job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);

DROP POLICY IF EXISTS sc_update ON public.step_commitments;
CREATE POLICY sc_update ON public.step_commitments FOR UPDATE USING (
  public.can_access_sub_work_order(step_id, labor_job_id, job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
) WITH CHECK (
  public.can_access_sub_work_order(step_id, labor_job_id, job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
);

DROP POLICY IF EXISTS sc_delete ON public.step_commitments;
CREATE POLICY sc_delete ON public.step_commitments FOR DELETE USING (
  public.can_access_sub_work_order(step_id, labor_job_id, job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician')
  )
);

DROP FUNCTION IF EXISTS public.can_access_sub_work_order(uuid, uuid);

-- 3) Record IDs --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_work_order_record_id(p_job_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_n integer;
BEGIN
  SELECT NULLIF(btrim(hcp_number), '') INTO v_number FROM public.jobs_ledger WHERE id = p_job_id;
  IF v_number IS NULL THEN
    v_number := left(replace(p_job_id::text, '-', ''), 6);
  END IF;
  SELECT count(*) INTO v_n FROM public.step_commitments WHERE record_id LIKE 'WO-' || v_number || '-%';
  RETURN 'WO-' || v_number || '-' || lpad((v_n + 1)::text, 2, '0');
END;
$$;

COMMENT ON FUNCTION public.next_work_order_record_id(uuid) IS
  'WO-<job number>-NN for the next work order on a job (NN counts existing record ids for that job). Minted at send.';

REVOKE EXECUTE ON FUNCTION public.next_work_order_record_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_work_order_record_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_work_order_record_id(uuid) TO service_role;

-- 4) Signing creates the sheet -------------------------------------------------

-- A job-anchored work order without a sheet gets one the moment it is
-- accepted: master from the job, the sub as the single assignee, one fixed
-- line for the agreed amount, tied back to the order. Idempotent: a second
-- call returns the existing sheet. Callable by the office set and by the
-- service role (submit-sub-portal after the sub signs).
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
  v_is_service := coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
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

COMMENT ON FUNCTION public.create_sheet_for_work_order(uuid) IS
  'Signing creates the sheet: for an accepted job-anchored work order with no sheet, creates the people_labor_jobs row (one fixed line = amount, the sub as assignee) and links labor_job_id. Idempotent. Office set + service role.';

REVOKE EXECUTE ON FUNCTION public.create_sheet_for_work_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sheet_for_work_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sheet_for_work_order(uuid) TO service_role;

-- 5) respond_to_work_order: job-anchored orders name the job and create the sheet on accept

CREATE OR REPLACE FUNCTION public.respond_to_work_order("p_commitment_id" uuid, "p_accept" boolean, "p_reason" text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_c public.step_commitments%ROWTYPE;
  v_step public.project_workflow_steps%ROWTYPE;
  v_workflow public.project_workflows%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_sheet public.people_labor_jobs%ROWTYPE;
  v_job public.jobs_ledger%ROWTYPE;
  v_dates_written boolean := false;
  v_dates_mismatch boolean := false;
  v_notify record;
  v_step_name text;
  v_project_id uuid;
  v_project_name text;
  v_master uuid;
  v_created jsonb;
BEGIN
  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = v_c.person_id AND p.account_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_c.status <> 'offered' THEN
    RAISE EXCEPTION 'This work order is no longer open (status: %)', v_c.status;
  END IF;

  IF v_c.step_id IS NOT NULL THEN
    SELECT * INTO v_step FROM public.project_workflow_steps WHERE id = v_c.step_id;
    SELECT * INTO v_workflow FROM public.project_workflows WHERE id = v_step.workflow_id;
    SELECT * INTO v_project FROM public.projects WHERE id = v_workflow.project_id;
    v_step_name := v_step.name;
    v_project_id := v_project.id;
    v_project_name := v_project.name;
    v_master := v_project.master_user_id;
  ELSIF v_c.labor_job_id IS NOT NULL THEN
    SELECT * INTO v_sheet FROM public.people_labor_jobs WHERE id = v_c.labor_job_id;
    v_step_name := 'Work order';
    v_project_id := NULL;
    v_project_name := NULLIF(
      concat_ws(' · ', NULLIF(btrim(COALESCE(v_sheet.job_number, '')), ''), NULLIF(btrim(COALESCE(v_sheet.address, '')), '')),
      ''
    );
    v_master := v_sheet.master_user_id;
  ELSE
    SELECT * INTO v_job FROM public.jobs_ledger WHERE id = v_c.job_id;
    v_step_name := 'Work order';
    v_project_id := NULL;
    v_project_name := NULLIF(
      concat_ws(' · ', NULLIF(btrim(COALESCE(v_job.hcp_number, '')), ''), NULLIF(btrim(COALESCE(v_job.job_address, '')), '')),
      ''
    );
    v_master := v_job.master_user_id;
  END IF;

  IF p_accept THEN
    UPDATE public.step_commitments
    SET status = 'accepted', accepted_at = now()
    WHERE id = p_commitment_id;

    IF v_c.step_id IS NOT NULL AND (v_c.proposed_start IS NOT NULL OR v_c.proposed_end IS NOT NULL) THEN
      IF v_step.scheduled_start_date IS NULL AND v_step.scheduled_end_date IS NULL THEN
        UPDATE public.project_workflow_steps
        SET scheduled_start_date = v_c.proposed_start,
            scheduled_end_date = v_c.proposed_end
        WHERE id = v_c.step_id;
        v_dates_written := true;
      ELSIF v_step.scheduled_start_date IS DISTINCT FROM v_c.proposed_start
         OR v_step.scheduled_end_date IS DISTINCT FROM v_c.proposed_end THEN
        v_dates_mismatch := true;
      END IF;
    END IF;

    -- Signing creates the sheet for job-anchored orders.
    IF v_c.step_id IS NULL AND v_c.labor_job_id IS NULL AND v_c.job_id IS NOT NULL THEN
      v_created := public.create_sheet_for_work_order(p_commitment_id);
    END IF;
  ELSE
    IF btrim(COALESCE(p_reason, '')) = '' THEN
      RAISE EXCEPTION 'A reason is required to decline';
    END IF;
    UPDATE public.step_commitments
    SET status = 'declined', declined_at = now(), decline_reason = btrim(p_reason)
    WHERE id = p_commitment_id;
  END IF;

  SELECT u.id, u.email, COALESCE(NULLIF(btrim(u.name), ''), u.email) AS display
  INTO v_notify
  FROM public.users u
  WHERE u.id = COALESCE(v_c.created_by, v_master);

  RETURN jsonb_build_object(
    'commitment_id', p_commitment_id,
    'accepted', p_accept,
    'dates_written', v_dates_written,
    'dates_mismatch', v_dates_mismatch,
    'step_id', v_c.step_id,
    'labor_job_id', COALESCE((v_created ->> 'labor_job_id')::uuid, v_c.labor_job_id),
    'job_id', v_c.job_id,
    'step_name', v_step_name,
    'project_id', v_project_id,
    'project_name', v_project_name,
    'amount', v_c.amount,
    'proposed_start', v_c.proposed_start,
    'proposed_end', v_c.proposed_end,
    'notify_user_id', v_notify.id,
    'notify_email', v_notify.email,
    'notify_name', v_notify.display
  );
END;
$$;

-- 6) settle_step_commitment: a job-anchored order with no sheet creates one, then closes

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
  v_sheet public.people_labor_jobs%ROWTYPE;
  v_labor_job_id uuid;
  v_created_new boolean := false;
  v_release numeric(12,2);
  v_job_number character varying(10);
  v_job_count integer;
  v_report jsonb;
  v_detail text;
  v_created jsonb;
BEGIN
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
  IF v_c.step_id IS NOT NULL AND NOT public.can_access_project_via_step(v_c.step_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF v_c.status IN ('settled','cancelled') THEN
    RAISE EXCEPTION 'Work order is already %', v_c.status;
  END IF;
  IF v_c.amount IS NULL THEN
    RAISE EXCEPTION 'The work order has no amount';
  END IF;

  v_release := round(v_c.amount * (1 - v_c.retainage_pct / 100.0), 2);

  IF v_c.step_id IS NULL THEN
    BEGIN
      IF v_c.labor_job_id IS NULL AND v_c.job_id IS NOT NULL THEN
        -- Approve first so the sheet creator accepts the status, then create.
        UPDATE public.step_commitments SET status = 'approved', approved_at = COALESCE(approved_at, now()) WHERE id = p_commitment_id;
        v_created := public.create_sheet_for_work_order(p_commitment_id);
        IF v_created ? 'error' THEN
          RAISE EXCEPTION '%', v_created ->> 'error';
        END IF;
        v_labor_job_id := (v_created ->> 'labor_job_id')::uuid;
        v_created_new := (v_created ->> 'created')::boolean;
      ELSE
        v_labor_job_id := v_c.labor_job_id;
      END IF;
      SELECT * INTO v_sheet FROM public.people_labor_jobs WHERE id = v_labor_job_id;
      v_job_number := NULLIF(btrim(COALESCE(v_sheet.job_number, '')), '');

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
  END IF;

  SELECT * INTO v_step FROM public.project_workflow_steps WHERE id = v_c.step_id;
  SELECT * INTO v_workflow FROM public.project_workflows WHERE id = v_step.workflow_id;
  SELECT * INTO v_project FROM public.projects WHERE id = v_workflow.project_id;

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
        public.app_today(),
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

-- House rules.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
