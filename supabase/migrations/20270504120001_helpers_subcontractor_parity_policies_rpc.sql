-- Helpers parity: extend subcontractors policies and SECURITY DEFINER RPCs so role helpers matches subcontractor everywhere material.

-- -----------------------------------------------------------------------------
-- Stable helper for auth-session role checks (optional use in UI layers; inlined below for policies)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_uid_is_helpers_or_subcontractor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('helpers', 'subcontractor')
  );
$$;

COMMENT ON FUNCTION public.auth_uid_is_helpers_or_subcontractor() IS
  'True when the current authenticated user role is helpers or subcontractor.';
REVOKE ALL ON FUNCTION public.auth_uid_is_helpers_or_subcontractor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_is_helpers_or_subcontractor() TO authenticated;

-- -----------------------------------------------------------------------------
-- jobs_ledger: subcontractor read path via SECURITY DEFINER (20260421202258)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subcontractor_can_read_jobs_ledger_row(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = p_job_id AND jtm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.job_schedule_blocks jsb
        WHERE jsb.job_id = p_job_id AND jsb.assignee_user_id = auth.uid()
      )
    );
$$;

COMMENT ON FUNCTION public.subcontractor_can_read_jobs_ledger_row(uuid) IS
  'True when caller is helpers/subcontractor and on job team or is Dispatch assignee for p_job_id. SECURITY DEFINER avoids jobs_ledger RLS recursion.';


-- -----------------------------------------------------------------------------
-- users SELECT (latest 20260520120009)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select users" ON public.users;

CREATE POLICY "Users can select users"
ON public.users FOR SELECT
USING (
  (archived_at IS NULL OR public.is_dev())
  AND (
    id = auth.uid()
    OR public.is_dev()
    OR (role = 'master_technician' AND public.is_master_or_dev())
    OR (role = 'assistant')
    OR (role IN ('master_technician', 'dev') AND public.is_estimator())
    OR (role = 'estimator')
    OR (role = 'primary')
    OR (role IN ('helpers', 'subcontractor'))
    OR (role = 'superintendent')
    OR public.master_adopted_current_user(id)
    OR public.can_see_sharing_master(id)
  )
);


-- -----------------------------------------------------------------------------
-- reports: subcontractor insert/select/update policies (from 20260220250000_create_reports)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subcontractors can insert reports" ON public.reports;
CREATE POLICY "Subcontractors can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  public.auth_uid_is_helpers_or_subcontractor()
  AND created_by_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Subcontractors can select own reports within visibility" ON public.reports;
CREATE POLICY "Subcontractors can select own reports within visibility"
ON public.reports
FOR SELECT
USING (
  public.auth_uid_is_helpers_or_subcontractor()
  AND created_by_user_id = auth.uid()
  AND created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
);

DROP POLICY IF EXISTS "Subcontractors can update own reports within edit window" ON public.reports;
CREATE POLICY "Subcontractors can update own reports within edit window"
ON public.reports
FOR UPDATE
USING (
  public.auth_uid_is_helpers_or_subcontractor()
  AND created_by_user_id = auth.uid()
  AND created_at >= (NOW() - (public.report_edit_window_days() || ' days')::interval)
)
WITH CHECK (
  created_by_user_id = auth.uid()
);


-- -----------------------------------------------------------------------------
-- jobs_tally_parts + list_jobs_for_tally (20260222000000)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subcontractors can read jobs tally parts for their jobs" ON public.jobs_tally_parts;
CREATE POLICY "Subcontractors can read jobs tally parts for their jobs"
ON public.jobs_tally_parts FOR SELECT USING (
  public.auth_uid_is_helpers_or_subcontractor()
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = jobs_tally_parts.job_id AND jtm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Subcontractors can insert jobs tally parts for their jobs" ON public.jobs_tally_parts;
CREATE POLICY "Subcontractors can insert jobs tally parts for their jobs"
ON public.jobs_tally_parts FOR INSERT WITH CHECK (
  public.auth_uid_is_helpers_or_subcontractor()
  AND created_by_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = jobs_tally_parts.job_id AND jtm.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.list_jobs_for_tally()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    jl.hcp_number,
    jl.job_name,
    jl.job_address
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor')
  )
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;


-- -----------------------------------------------------------------------------
-- jobs_ledger_thread_notes (20260408224611)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "jobs_ledger_thread_notes_select" ON public.jobs_ledger_thread_notes;
CREATE POLICY "jobs_ledger_thread_notes_select"
  ON public.jobs_ledger_thread_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = jobs_ledger_thread_notes.job_id
        AND (
          j.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
        )
    )
    OR (
      public.auth_uid_is_helpers_or_subcontractor()
      AND (
        EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jobs_ledger_thread_notes.job_id
            AND jtm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.job_schedule_blocks jsb
          WHERE jsb.job_id = jobs_ledger_thread_notes.job_id
            AND jsb.assignee_user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "jobs_ledger_thread_notes_insert" ON public.jobs_ledger_thread_notes;
CREATE POLICY "jobs_ledger_thread_notes_insert"
  ON public.jobs_ledger_thread_notes FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger j
        WHERE j.id = jobs_ledger_thread_notes.job_id
          AND (
            j.master_user_id = auth.uid()
            OR public.is_dev()
            OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
            OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
            OR public.assistants_share_master(auth.uid(), j.master_user_id)
            OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
          )
      )
      OR (
        public.auth_uid_is_helpers_or_subcontractor()
        AND (
          EXISTS (
            SELECT 1 FROM public.jobs_ledger_team_members jtm
            WHERE jtm.job_id = jobs_ledger_thread_notes.job_id
              AND jtm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.job_schedule_blocks jsb
            WHERE jsb.job_id = jobs_ledger_thread_notes.job_id
              AND jsb.assignee_user_id = auth.uid()
          )
        )
      )
    )
  );


-- -----------------------------------------------------------------------------
-- workflow: step visibility + subcontractor-assigned UPDATE (60520120004 + 60427234940)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can see steps for workflows they have access to" ON public.project_workflow_steps;
CREATE POLICY "Users can see steps for workflows they have access to"
ON public.project_workflow_steps
FOR SELECT
USING (
  public.is_dev()
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_technician')
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'assistant')
    AND public.can_access_project_via_workflow(workflow_id)
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND public.can_access_project_via_workflow(workflow_id)
  )
  OR (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor') AND name IS NOT NULL
        AND LOWER(TRIM(users.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
);

DROP POLICY IF EXISTS "Subcontractors can update their assigned project_workflow_steps" ON public.project_workflow_steps;
CREATE POLICY "Subcontractors can update their assigned project_workflow_steps"
  ON public.project_workflow_steps
  FOR UPDATE
  USING (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('helpers', 'subcontractor')
        AND u.name IS NOT NULL
        AND LOWER(TRIM(u.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  )
  WITH CHECK (
    assigned_to_name IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('helpers', 'subcontractor')
        AND u.name IS NOT NULL
        AND LOWER(TRIM(u.name)) = LOWER(TRIM(project_workflow_steps.assigned_to_name))
    )
  );


-- -----------------------------------------------------------------------------
-- list_reports_* and search_jobs_for_reports (202704221*)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_reports_for_job_ledger(p_job_id uuid)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  template_name TEXT,
  created_by_user_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  field_values JSONB,
  job_ledger_id UUID,
  project_id UUID,
  job_display_name TEXT,
  job_hcp_number TEXT,
  reported_at_lat NUMERIC,
  reported_at_lng NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.template_id,
    rt.name AS template_name,
    r.created_by_user_id,
    u.name AS created_by_name,
    r.created_at,
    r.updated_at,
    r.field_values,
    r.job_ledger_id,
    r.project_id,
    COALESCE(jl.job_name, p.name) AS job_display_name,
    COALESCE(jl.hcp_number, p.housecallpro_number, '')::TEXT AS job_hcp_number,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lng ELSE NULL END AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  WHERE r.job_ledger_id = p_job_id
  AND (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'primary')
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND (
        (r.project_id IS NOT NULL AND public.can_access_project_row(r.project_id))
        OR
        (r.job_ledger_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.jobs_ledger jl2
          WHERE jl2.id = r.job_ledger_id AND jl2.project_id IS NOT NULL AND public.can_access_project_row(jl2.project_id)
        ))
      )
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role IN ('helpers', 'subcontractor'))
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.list_reports_for_bid(p_bid_id uuid)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  template_name TEXT,
  created_by_user_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  field_values JSONB,
  bid_id UUID,
  job_display_name TEXT,
  job_hcp_number TEXT,
  reported_at_lat NUMERIC,
  reported_at_lng NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.template_id,
    rt.name AS template_name,
    r.created_by_user_id,
    u.name AS created_by_name,
    r.created_at,
    r.updated_at,
    r.field_values,
    r.bid_id,
    COALESCE(b.project_name, b.gc_contact_name, 'Bid')::TEXT AS job_display_name,
    COALESCE(b.bid_number, '')::TEXT AS job_hcp_number,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lng ELSE NULL END AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  JOIN public.bids b ON r.bid_id = b.id
  WHERE r.bid_id = p_bid_id
  AND (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'primary')
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND public.superintendent_can_access_bid(b)
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role IN ('helpers', 'subcontractor'))
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
    OR
    (public.is_estimator() AND public.can_access_bid_for_pricing(p_bid_id))
  )
  ORDER BY r.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.list_reports_with_job_info()
RETURNS TABLE (
  id UUID,
  template_id UUID,
  template_name TEXT,
  created_by_user_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  field_values JSONB,
  job_ledger_id UUID,
  project_id UUID,
  bid_id UUID,
  job_display_name TEXT,
  job_hcp_number TEXT,
  reported_at_lat NUMERIC,
  reported_at_lng NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.template_id,
    rt.name AS template_name,
    r.created_by_user_id,
    u.name AS created_by_name,
    r.created_at,
    r.updated_at,
    r.field_values,
    r.job_ledger_id,
    r.project_id,
    r.bid_id,
    COALESCE(jl.job_name, p.name, b.project_name, b.gc_contact_name, 'Bid') AS job_display_name,
    COALESCE(jl.hcp_number, p.housecallpro_number, b.bid_number, '')::TEXT AS job_hcp_number,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lng ELSE NULL END AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  LEFT JOIN public.bids b ON r.bid_id = b.id
  WHERE (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'primary')
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND (
        (r.project_id IS NOT NULL AND public.can_access_project_row(r.project_id))
        OR
        (r.job_ledger_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.jobs_ledger jl2
          WHERE jl2.id = r.job_ledger_id AND jl2.project_id IS NOT NULL AND public.can_access_project_row(jl2.project_id)
        ))
        OR
        (r.bid_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.bids b2
          WHERE b2.id = r.bid_id
            AND public.superintendent_can_access_bid(b2)
        ))
      )
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role IN ('helpers', 'subcontractor'))
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at DESC;
$$;


-- -----------------------------------------------------------------------------
-- Invoice allocation + amounts visibility (supply house)
-- get_invoice_allocation_lines_for_jobs(uuid[]): canonical DROP+CREATE in migration
-- 20270505120000_fix_get_invoice_allocation_lines_for_jobs.sql (10 columns + helpers visibility).
-- Omitted here: an 8-column CREATE OR REPLACE conflicts with the wider RETURNS TABLE already in the catalog.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invoice_amounts_for_jobs(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid,
  invoice_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
      )
      OR (
        public.auth_uid_is_helpers_or_subcontractor()
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    COALESCE(SUM(i.amount * a.pct / 100), 0)::numeric AS invoice_amount
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  GROUP BY a.job_id;
$$;


-- -----------------------------------------------------------------------------
-- Job Parts RPC list_tally_parts_with_po — latest shape (20260231000011 including primary branch)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_tally_parts_with_po()
RETURNS TABLE (
  id UUID,
  job_id UUID,
  fixture_name TEXT,
  part_id UUID,
  quantity NUMERIC,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ,
  price_at_time NUMERIC,
  fixture_cost NUMERIC,
  purchase_order_id UUID,
  purchase_order_name TEXT,
  purchase_order_status TEXT,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  part_name TEXT,
  part_manufacturer TEXT,
  created_by_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jtp.id,
    jtp.job_id,
    jtp.fixture_name,
    jtp.part_id,
    jtp.quantity,
    jtp.created_by_user_id,
    jtp.created_at,
    poi.price_at_time,
    jtp.fixture_cost,
    jtp.purchase_order_id,
    po.name AS purchase_order_name,
    po.status::TEXT AS purchase_order_status,
    jl.hcp_number,
    jl.job_name,
    jl.job_address,
    mp.name AS part_name,
    mp.manufacturer AS part_manufacturer,
    u.name AS created_by_name
  FROM public.jobs_tally_parts jtp
  INNER JOIN public.jobs_ledger jl ON jl.id = jtp.job_id
  LEFT JOIN public.material_parts mp ON mp.id = jtp.part_id
  LEFT JOIN public.users u ON u.id = jtp.created_by_user_id
  LEFT JOIN public.purchase_orders po ON po.id = jtp.purchase_order_id
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = jtp.purchase_order_id
    AND poi.part_id = jtp.part_id
  WHERE EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
    AND (
      jl.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), jl.master_user_id)
    )
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
  )
  OR (
    public.auth_uid_is_helpers_or_subcontractor()
    AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jtp.job_id AND jtm.user_id = auth.uid())
  )
  ORDER BY jtp.created_at DESC;
$$;


-- -----------------------------------------------------------------------------
-- Collect payment certification RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_collect_payment_certify_payload(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_fixtures jsonb;
  v_invoice jsonb;
  v_flow jsonb;
  v_collect_invoice jsonb;
  v_billing_customer jsonb;
  v_job_service_type_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('subcontractor', 'helpers') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    INNER JOIN public.jobs_ledger jl ON jl.id = jtm.job_id
    WHERE jtm.user_id = v_uid
      AND jl.id = p_job_id
      AND jl.status = 'ready_to_bill'
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT b.service_type_id INTO v_job_service_type_id
  FROM public.jobs_ledger jl
  LEFT JOIN public.bids b ON b.id = jl.bid_id
  WHERE jl.id = p_job_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sf.id,
        'name', sf.name,
        'count', sf.count,
        'line_unit_price', sf.line_unit_price,
        'line_description', sf.line_description,
        'sequence_order', sf.sequence_order
      )
      ORDER BY sf.sequence_order
    ),
    '[]'::jsonb
  )
  INTO v_fixtures
  FROM public.jobs_ledger_fixtures sf
  WHERE sf.job_id = p_job_id;

  SELECT jsonb_build_object(
    'id', i.id,
    'amount', i.amount,
    'status', i.status,
    'sequence_order', i.sequence_order,
    'estimated_bill_date', i.estimated_bill_date
  )
  INTO v_invoice
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
  ORDER BY i.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT to_jsonb(f.*)
  INTO v_flow
  FROM public.job_collect_payment_flows f
  WHERE f.job_id = p_job_id;

  SELECT jsonb_build_object(
    'id', i.id,
    'amount', i.amount,
    'status', i.status,
    'hosted_invoice_url', i.hosted_invoice_url,
    'stripe_invoice_id', i.stripe_invoice_id,
    'sent_to_customer_at', i.sent_to_customer_at
  )
  INTO v_collect_invoice
  FROM public.jobs_ledger_invoices i
  INNER JOIN public.job_collect_payment_flows f2
    ON f2.jobs_ledger_invoice_id = i.id
   AND f2.job_id = p_job_id
  LIMIT 1;

  SELECT jsonb_build_object(
    'email', NULLIF(trim(COALESCE(jl.customer_email, '')), ''),
    'name', NULLIF(trim(COALESCE(jl.customer_name, '')), '')
  )
  INTO v_billing_customer
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  RETURN jsonb_build_object(
    'fixtures', COALESCE(v_fixtures, '[]'::jsonb),
    'invoice', v_invoice,
    'flow', v_flow,
    'collect_invoice', v_collect_invoice,
    'billing_customer', COALESCE(
      v_billing_customer,
      jsonb_build_object('email', NULL, 'name', NULL)
    ),
    'job_service_type_id', v_job_service_type_id
  );
END;
$$;

COMMENT ON FUNCTION public.get_collect_payment_certify_payload(uuid) IS
  'Helpers/subcontractor: billable fixtures + RTB invoice + flow + collect_invoice + billing_customer + job_service_type_id.';
REVOKE ALL ON FUNCTION public.get_collect_payment_certify_payload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_collect_payment_certify_payload(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_collect_payment_fixture_from_job_book(
  p_job_id uuid,
  p_job_book_entry_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_entry record;
  v_job_st uuid;
  v_next_seq int;
  v_rev numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('subcontractor', 'helpers') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    INNER JOIN public.jobs_ledger jl ON jl.id = jtm.job_id
    WHERE jtm.user_id = v_uid
      AND jl.id = p_job_id
      AND jl.status = 'ready_to_bill'
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT b.service_type_id INTO v_job_st
  FROM public.jobs_ledger jl
  LEFT JOIN public.bids b ON b.id = jl.bid_id
  WHERE jl.id = p_job_id;

  SELECT jbe.id, jbe.work_label, jbe.unit_cost, jbe.service_type_id
  INTO v_entry
  FROM public.job_book_entries jbe
  WHERE jbe.id = p_job_book_entry_id;

  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('error', 'job_book_entry_not_found');
  END IF;

  IF v_entry.service_type_id IS NOT NULL
     AND (v_job_st IS DISTINCT FROM v_entry.service_type_id) THEN
    RETURN jsonb_build_object('error', 'job_book_entry_service_type_mismatch');
  END IF;

  SELECT COALESCE(MAX(f.sequence_order), -1) + 1 INTO v_next_seq
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_id;

  INSERT INTO public.jobs_ledger_fixtures (
    job_id,
    name,
    count,
    line_unit_price,
    line_description,
    sequence_order
  ) VALUES (
    p_job_id,
    trim(v_entry.work_label),
    1,
    ROUND(v_entry.unit_cost::numeric, 2),
    NULL,
    v_next_seq
  );

  SELECT ROUND(COALESCE(SUM(
    CASE
      WHEN trim(COALESCE(f.name, '')) = '' THEN 0::numeric
      ELSE
        (CASE WHEN f.count > 0 THEN f.count::numeric ELSE 1::numeric END)
        * COALESCE(f.line_unit_price, 0::numeric)
    END
  ), 0::numeric), 2)
  INTO v_rev
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_id;

  UPDATE public.jobs_ledger jl
  SET revenue = v_rev
  WHERE jl.id = p_job_id;

  RETURN jsonb_build_object('ok', true, 'revenue', v_rev);
END;
$$;

COMMENT ON FUNCTION public.add_collect_payment_fixture_from_job_book(uuid, uuid) IS
  'Helpers/subcontractor on RTB team job: fixture from Job Book + revenue sync.';
REVOKE ALL ON FUNCTION public.add_collect_payment_fixture_from_job_book(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_collect_payment_fixture_from_job_book(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_collect_payment_certification(
  p_job_id uuid,
  p_mode text,
  p_correction_notes text DEFAULT NULL,
  p_per_line_notes jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_notes text;
  v_rtb_invoice_id uuid;
  v_row public.job_collect_payment_flows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('subcontractor', 'helpers') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('clean', 'correction_requested') THEN
    RETURN jsonb_build_object('error', 'Invalid certify mode');
  END IF;

  v_notes := NULLIF(trim(COALESCE(p_correction_notes, '')), '');
  IF p_mode = 'correction_requested' AND (v_notes IS NULL OR length(v_notes) < 3) THEN
    RETURN jsonb_build_object('error', 'Describe the correction needed (at least 3 characters).');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_team_members jtm
    INNER JOIN public.jobs_ledger jl ON jl.id = jtm.job_id
    WHERE jtm.user_id = v_uid
      AND jl.id = p_job_id
      AND jl.status = 'ready_to_bill'
  ) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT i.id INTO v_rtb_invoice_id
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'ready_to_bill'
  ORDER BY i.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT * INTO v_row FROM public.job_collect_payment_flows WHERE job_id = p_job_id FOR UPDATE;

  IF FOUND THEN
    IF v_row.status = 'approved_for_terminal' THEN
      RETURN jsonb_build_object('error', 'Payment is approved for terminal. Complete collection or ask office to reset.');
    END IF;
    IF v_row.status NOT IN (
      'draft',
      'pending_dispatch',
      'terminal_completed',
      'failed',
      'cancelled'
    ) THEN
      RETURN jsonb_build_object('error', 'Invalid flow state for submit');
    END IF;

    UPDATE public.job_collect_payment_flows
    SET
      initiated_by_user_id = v_uid,
      jobs_ledger_invoice_id = v_rtb_invoice_id,
      status = 'pending_dispatch',
      certify_mode = p_mode,
      correction_notes = CASE WHEN p_mode = 'correction_requested' THEN v_notes ELSE NULL END,
      per_line_notes = p_per_line_notes,
      certified_at = now(),
      dispatch_reviewed_at = NULL,
      dispatch_reviewed_by = NULL,
      dispatch_notes = NULL,
      stripe_payment_intent_id = NULL,
      stripe_invoice_id = NULL,
      last_error = NULL
    WHERE job_id = p_job_id;

    RETURN jsonb_build_object('ok', true, 'status', 'pending_dispatch');
  END IF;

  INSERT INTO public.job_collect_payment_flows (
    job_id,
    initiated_by_user_id,
    jobs_ledger_invoice_id,
    status,
    certify_mode,
    correction_notes,
    per_line_notes,
    certified_at
  )
  VALUES (
    p_job_id,
    v_uid,
    v_rtb_invoice_id,
    'pending_dispatch',
    p_mode,
    CASE WHEN p_mode = 'correction_requested' THEN v_notes ELSE NULL END,
    p_per_line_notes,
    now()
  );

  RETURN jsonb_build_object('ok', true, 'status', 'pending_dispatch');
END;
$$;

COMMENT ON FUNCTION public.submit_collect_payment_certification(uuid, text, text, jsonb) IS
  'Helpers/subcontractor: certify or request correction; sets flow to pending_dispatch.';
REVOKE ALL ON FUNCTION public.submit_collect_payment_certification(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_collect_payment_certification(uuid, text, text, jsonb) TO authenticated;


-- -----------------------------------------------------------------------------
-- Tally Mercury: visibility + searches (60406170442, 20260402171411 self-service, staff search 70408152000)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jobs_ledger_row_visible_for_tally_assign(
  p_job_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_job_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.role::text INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('subcontractor', 'helpers') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = p_job_id AND jtm.user_id = p_user_id
    );
  END IF;

  IF v_role NOT IN ('dev', 'master_technician', 'assistant', 'primary') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_id
      AND (
        jl.master_user_id = p_user_id
        OR v_role = 'dev'
        OR v_role = 'primary'
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_user_id AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_user_id
        )
        OR public.assistants_share_master(p_user_id, jl.master_user_id)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.clock_sessions cs
    WHERE cs.job_ledger_id = p_job_id
      AND public.is_team_lead_for_member(p_user_id, cs.user_id)
  );
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_row_visible_for_tally_assign(uuid, uuid) IS
  'Whether p_user_id may read this jobs_ledger row for tally Mercury assign search (helpers/subcontractors: team-only; row_security off).';

REVOKE ALL ON FUNCTION public.jobs_ledger_row_visible_for_tally_assign(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jobs_ledger_row_visible_for_tally_assign(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(
  p_for_user_id uuid,
  search_text text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    jl.id,
    COALESCE(jl.hcp_number, '')::text,
    COALESCE(jl.job_name, '')::text,
    COALESCE(jl.job_address, '')::text
  FROM public.jobs_ledger jl
  WHERE public.staff_can_view_user_for_tally_followup(auth.uid(), p_for_user_id)
  AND (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_for_user_id AND u.role IN ('helpers', 'subcontractor')
      )
      AND public.jobs_ledger_row_visible_for_tally_assign(jl.id, p_for_user_id)
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_for_user_id AND u.role IN ('helpers', 'subcontractor')
      )
      AND public.jobs_ledger_row_visible_for_tally_assign(jl.id, auth.uid())
    )
  )
  AND (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.search_jobs_for_tally_mercury_assign(search_text text DEFAULT '')
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    COALESCE(jl.hcp_number, '')::text,
    COALESCE(jl.job_name, '')::text,
    COALESCE(jl.job_address, '')::text
  FROM public.jobs_ledger jl
  WHERE (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
  )
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('helpers', 'subcontractor')
    )
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid()
    )
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.replace_mercury_job_splits_for_my_linked_card(
  p_mercury_transaction_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_amount numeric(18, 4);
  v_raw jsonb;
  v_card uuid;
  v_sum numeric(18, 4);
  v_len int;
  elem jsonb;
  v_note text;
  v_role text;
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: not authenticated';
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: user not found';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: p_rows must be a JSON array';
  END IF;

  SELECT t.amount, t.raw INTO v_tx_amount, v_raw
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: transaction not found';
  END IF;

  v_card := public.mercury_debit_card_id_from_raw(v_raw);
  IF v_card IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: transaction has no debit card on file';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_debit_card_user_links l
    WHERE l.user_id = auth.uid() AND l.mercury_debit_card_id = v_card
  ) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: not authorized for this transaction';
  END IF;

  v_len := jsonb_array_length(p_rows);

  SELECT COALESCE(SUM((e->>'amount')::numeric(18, 4)), 0) INTO v_sum
  FROM jsonb_array_elements(p_rows) AS e;

  IF v_len > 0 AND v_sum IS DISTINCT FROM v_tx_amount THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: allocation sum must equal transaction amount';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_job := (elem->>'job_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = v_job) THEN
      RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: invalid job';
    END IF;
    IF v_role IN ('helpers', 'subcontractor') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = v_job AND jtm.user_id = auth.uid()
      ) THEN
        RAISE EXCEPTION 'replace_mercury_job_splits_for_my_linked_card: job not on your team';
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.mercury_transaction_job_allocations
  WHERE mercury_transaction_id = p_mercury_transaction_id;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_note := NULLIF(trim(both FROM elem->>'note'), '');
    INSERT INTO public.mercury_transaction_job_allocations (
      mercury_transaction_id,
      job_id,
      amount,
      note,
      created_by
    )
    VALUES (
      p_mercury_transaction_id,
      (elem->>'job_id')::uuid,
      (elem->>'amount')::numeric(18, 4),
      v_note,
      auth.uid()
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_mercury_job_splits_for_my_linked_card(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_job_splits_for_my_linked_card(uuid, jsonb) TO authenticated;

