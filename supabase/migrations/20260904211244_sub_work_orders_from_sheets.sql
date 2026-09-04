SET lock_timeout = '3s';

-- Sub work orders from sheets (v2.2785, PR 1 of 5 — owner-approved "Sub Work
-- Orders" proposal, 2026-09-04, modeled on Structura's Work Order 26013-220001).
--
-- A sub work order already exists: step_commitments carries the amount, the
-- work window, the scope frozen at send (offer_scope_snapshot) and the
-- portal's sign-to-accept. It could only hang off a project workflow step.
-- This migration lets one hang off a Sub Labor sheet (people_labor_jobs)
-- instead, so a plain service job can send a scoped, priced, signed work
-- order from Jobs → Sub Labor. It also lays the scope library the sheet's
-- checklist ticks from, opens the Contract Book to a `sub` audience (the
-- "General Conditions" every work order references by version date), and
-- records the acknowledgements a sub ticks at signing (Structura's "click to
-- initial" boxes). Idempotent; additive except the NOT NULL drop.

-- 1) step_commitments: the anchor is a step OR a sheet ------------------------

ALTER TABLE public.step_commitments ALTER COLUMN step_id DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.step_commitments
    ADD CONSTRAINT step_commitments_anchor_check
    CHECK (step_id IS NOT NULL OR labor_job_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One live work order per sheet (sheet-anchored rows only; cancelling frees the slot).
CREATE UNIQUE INDEX IF NOT EXISTS step_commitments_sheet_live_uniq
  ON public.step_commitments (labor_job_id)
  WHERE step_id IS NULL AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_step_commitments_labor_job_id ON public.step_commitments (labor_job_id);

ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS signer_acknowledgements jsonb;

COMMENT ON COLUMN public.step_commitments.step_id IS
  'Workflow step the work order hangs off. NULL for a sheet-anchored work order (labor_job_id set) — sent from Jobs → Sub Labor, v2.2785.';
COMMENT ON COLUMN public.step_commitments.labor_job_id IS
  'Sub Labor sheet. For step work orders: set by settlement. For sheet work orders: the anchor itself (step_id NULL).';
COMMENT ON COLUMN public.step_commitments.offer_scope_snapshot IS
  'Frozen at offer time. Base shape {lines: [{label, amount}], startsLabel}; sheet work orders add {anchor: ''sheet'', sheetLabel, exclusions: [text], references: [{kind, documentId, name, versionDate}], acknowledgements: [text], bond: ''none''|''furnished'', specialProvisions}. Never edited after offering; re-price = withdraw + re-offer.';
COMMENT ON COLUMN public.step_commitments.signer_acknowledgements IS
  'What the sub ticked at signing: [{text, acknowledgedAt}]. Written by submit-sub-portal alongside the signature stamp.';

-- A sheet is the anchor of its work order: deleting the sheet takes the
-- sheet-anchored order with it (step-anchored rows keep the SET NULL FK).
CREATE OR REPLACE FUNCTION public.people_labor_jobs_drop_sheet_work_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.step_commitments
  WHERE labor_job_id = OLD.id AND step_id IS NULL;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS people_labor_jobs_drop_sheet_work_orders_del ON public.people_labor_jobs;
CREATE TRIGGER people_labor_jobs_drop_sheet_work_orders_del
  BEFORE DELETE ON public.people_labor_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.people_labor_jobs_drop_sheet_work_orders();

-- 2) Access helper + policies that understand both anchors -------------------

CREATE OR REPLACE FUNCTION public.can_access_sub_work_order(p_step_id uuid, p_labor_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_step_id IS NOT NULL THEN public.can_access_project_via_step(p_step_id)
    WHEN p_labor_job_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
    )
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.can_access_sub_work_order(uuid, uuid) IS
  'Row access for step_commitments: step-anchored rows follow the project (can_access_project_via_step); sheet-anchored rows are visible to the office set + superintendents (the Sub Labor tab audience).';

REVOKE EXECUTE ON FUNCTION public.can_access_sub_work_order(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_sub_work_order(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS sc_select ON public.step_commitments;
CREATE POLICY sc_select ON public.step_commitments FOR SELECT USING (
  public.can_access_sub_work_order(step_id, labor_job_id)
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
  public.can_access_sub_work_order(step_id, labor_job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);

DROP POLICY IF EXISTS sc_update ON public.step_commitments;
CREATE POLICY sc_update ON public.step_commitments FOR UPDATE USING (
  public.can_access_sub_work_order(step_id, labor_job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
) WITH CHECK (
  public.can_access_sub_work_order(step_id, labor_job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
);

DROP POLICY IF EXISTS sc_delete ON public.step_commitments;
CREATE POLICY sc_delete ON public.step_commitments FOR DELETE USING (
  public.can_access_sub_work_order(step_id, labor_job_id)
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician')
  )
);

-- 3) RPCs learn the sheet anchor ---------------------------------------------

-- respond_to_work_order: a signed-in sub answering from the Dashboard. Sheet
-- work orders have no step dates to write and no project to name; the
-- notification target falls back to the sheet's master.
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
  v_dates_written boolean := false;
  v_dates_mismatch boolean := false;
  v_notify record;
  v_step_name text;
  v_project_id uuid;
  v_project_name text;
  v_master uuid;
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
  ELSE
    SELECT * INTO v_sheet FROM public.people_labor_jobs WHERE id = v_c.labor_job_id;
    v_step_name := 'Work order';
    v_project_id := NULL;
    v_project_name := NULLIF(
      concat_ws(' · ', NULLIF(btrim(COALESCE(v_sheet.job_number, '')), ''), NULLIF(btrim(COALESCE(v_sheet.address, '')), '')),
      ''
    );
    v_master := v_sheet.master_user_id;
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
  ELSE
    IF btrim(COALESCE(p_reason, '')) = '' THEN
      RAISE EXCEPTION 'A reason is required to decline';
    END IF;
    UPDATE public.step_commitments
    SET status = 'declined', declined_at = now(), decline_reason = btrim(p_reason)
    WHERE id = p_commitment_id;
  END IF;

  -- Notification target: the order's creator, else the project / sheet master.
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
    'labor_job_id', v_c.labor_job_id,
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

-- settle_step_commitment: a sheet work order IS its sheet — settling just
-- closes the money lifecycle (no new sheet, no new line). Step work orders
-- behave exactly as before.
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
  IF v_c.step_id IS NOT NULL AND NOT public.can_access_project_via_step(v_c.step_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF v_c.status IN ('settled','cancelled') THEN
    RAISE EXCEPTION 'Work order is already %', v_c.status;
  END IF;

  v_release := round(v_c.amount * (1 - v_c.retainage_pct / 100.0), 2);

  IF v_c.step_id IS NULL THEN
    -- Sheet-anchored: the ledger row already exists; just close the order.
    SELECT * INTO v_sheet FROM public.people_labor_jobs WHERE id = v_c.labor_job_id;
    v_labor_job_id := v_c.labor_job_id;
    v_job_number := NULLIF(btrim(COALESCE(v_sheet.job_number, '')), '');
    BEGIN
      UPDATE public.step_commitments
      SET status = 'settled',
          settled_at = now(),
          approved_at = COALESCE(approved_at, now())
      WHERE id = p_commitment_id;

      v_report := jsonb_build_object(
        'commitment_id', v_c.id,
        'labor_job_id', v_labor_job_id,
        'display_name', v_c.display_name,
        'agreed_amount', v_c.amount,
        'retainage_pct', v_c.retainage_pct,
        'released_amount', v_release,
        'job_number', v_job_number,
        'created_new_sheet', false
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

-- 4) Scope library: the checklist a sheet's work order ticks from -----------

CREATE TABLE IF NOT EXISTS public.sub_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = every trade ("All trades" list); otherwise one service type's list.
  service_type_id uuid REFERENCES public.service_types(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('scope', 'exclusion', 'acknowledgement')),
  label text NOT NULL CHECK (btrim(label) <> ''),
  -- default: pre-ticked on every new work order of that trade; false = "ask" (shown unticked).
  is_default boolean NOT NULL DEFAULT true,
  sequence_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sub_scope_items IS
  'Scope library for sub work orders (v2.2785): standing scope lines, exclusions and signing acknowledgements, per service type (NULL = all trades). Sheets tick from these; ticked wording freezes into step_commitments.offer_scope_snapshot, so edits here change future work orders only.';

CREATE INDEX IF NOT EXISTS idx_sub_scope_items_service_kind ON public.sub_scope_items (service_type_id, kind, sequence_order);

DROP TRIGGER IF EXISTS update_sub_scope_items_updated_at ON public.sub_scope_items;
CREATE TRIGGER update_sub_scope_items_updated_at
  BEFORE UPDATE ON public.sub_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sub_scope_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssi_select ON public.sub_scope_items;
CREATE POLICY ssi_select ON public.sub_scope_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
);

DROP POLICY IF EXISTS ssi_write ON public.sub_scope_items;
CREATE POLICY ssi_write ON public.sub_scope_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller')
  )
);

-- Starter library (only when the table is empty): the all-trades standing
-- lines condensed from a GC work order, three exclusions, three signing
-- acknowledgements. The office edits or archives these on
-- People → Contracts → Contract library → Scope.
INSERT INTO public.sub_scope_items (service_type_id, kind, label, is_default, sequence_order)
SELECT NULL, v.kind, v.label, v.is_default, v.seq
FROM (VALUES
  ('scope', 'All work in compliance with the plans, sheet notes, and specifications.', true, 10),
  ('scope', 'All product data, samples, and shop drawings for a complete submittal package.', true, 20),
  ('scope', 'All ladders, lifts, scaffolds, and other means of access to complete the scope of work.', true, 30),
  ('scope', 'Layout and field measurements for this scope of work; verify existing conditions before starting.', true, 40),
  ('scope', 'Daily clean-up of own work and work areas to the project dumpster.', true, 50),
  ('scope', 'Coordination with other trades to meet the project schedule.', true, 60),
  ('scope', 'All permits, fees, and inspections required for this scope of work.', true, 70),
  ('scope', 'Protection of materials and equipment stored on site.', true, 80),
  ('scope', 'Firestopping and sound caulking of horizontal and vertical penetrations made by this work.', false, 90),
  ('scope', 'As-built drawings submitted electronically within two weeks of substantial completion.', false, 100),
  ('exclusion', 'Sales tax on materials when the project carries a tax-exempt certificate.', true, 10),
  ('exclusion', 'Work not shown on the plans and specifications unless listed above.', true, 20),
  ('exclusion', 'Permit and inspection fees paid by the general contractor.', false, 30),
  ('acknowledgement', 'I will bill through the portal by the billing cutoff with the sheet''s paperwork.', true, 10),
  ('acknowledgement', 'My insurance certificate stays current for the whole job.', true, 20),
  ('acknowledgement', 'I have read the scope lines and exclusions above.', true, 30)
) AS v(kind, label, is_default, seq)
WHERE NOT EXISTS (SELECT 1 FROM public.sub_scope_items);

-- 5) Contract Book: a `sub` audience for General Conditions and exhibits ---

ALTER TABLE public.contract_template_documents
  DROP CONSTRAINT IF EXISTS contract_template_documents_audience_check;
ALTER TABLE public.contract_template_documents
  ADD CONSTRAINT contract_template_documents_audience_check
  CHECK (audience IN ('staff', 'customer', 'sub'));

COMMENT ON COLUMN public.contract_template_documents.audience IS
  'staff (packets for teammates) | customer (job contract terms) | sub (General Conditions and exhibits every sub work order references by version date, v2.2785).';

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
