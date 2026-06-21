-- Bake-in effective job number (HCP else Click) into remaining RPCs.
-- Rule: COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
-- (HCP wins, else click, else '').
-- For search functions: add OR <table>.click_number ILIKE ... sibling predicates.
-- Everything else preserved verbatim from live definitions.

-- =====================================================================
-- 1. list_ready_to_bill_assigned_jobs_for_dashboard()
--    display + ORDER BY
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text, google_drive_link text, job_plans_link text, job_pictures_link text, revenue numeric, master_user_id uuid, created_at timestamp with time zone, last_report_at timestamp with time zone, my_last_report_at timestamp with time zone, last_thread_note_at timestamp with time zone, last_clock_activity_at timestamp with time zone, last_schedule_activity_at timestamp with time zone, last_job_activity_at timestamp with time zone, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name,
    jl.job_address,
    jl.google_drive_link,
    jl.job_plans_link,
    jl.job_pictures_link,
    jl.revenue,
    jl.master_user_id,
    jl.created_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id) AS last_report_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    (SELECT max(n.created_at) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = jl.id) AS last_thread_note_at,
    (SELECT max(coalesce(cs.clocked_out_at, cs.clocked_in_at))
     FROM public.clock_sessions cs
     WHERE cs.job_ledger_id = jl.id
       AND cs.approved_at IS NOT NULL
       AND cs.rejected_at IS NULL
       AND cs.revoked_at IS NULL) AS last_clock_activity_at,
    (SELECT max(greatest(jb.created_at, jb.updated_at))
     FROM public.job_schedule_blocks jb
     WHERE jb.job_id = jl.id) AS last_schedule_activity_at,
    (SELECT max(x.v) FROM (
      SELECT (SELECT max(n2.created_at) FROM public.jobs_ledger_thread_notes n2 WHERE n2.job_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(r2.created_at) FROM public.reports r2 WHERE r2.job_ledger_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(coalesce(cs2.clocked_out_at, cs2.clocked_in_at))
              FROM public.clock_sessions cs2
              WHERE cs2.job_ledger_id = jl.id
                AND cs2.approved_at IS NOT NULL
                AND cs2.rejected_at IS NULL
                AND cs2.revoked_at IS NULL) AS v
      UNION ALL
      SELECT (SELECT max(greatest(jb2.created_at, jb2.updated_at))
              FROM public.job_schedule_blocks jb2
              WHERE jb2.job_id = jl.id) AS v
    ) x) AS last_job_activity_at,
    jl.status::text
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'ready_to_bill'
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

-- =====================================================================
-- 2. list_superintendent_jobs_for_dashboard()
--    display + ORDER BY
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_superintendent_jobs_for_dashboard()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text, google_drive_link text, job_plans_link text, job_pictures_link text, revenue numeric, created_at timestamp with time zone, my_last_report_at timestamp with time zone, project_id uuid, in_progress_stage_name text, in_progress_step_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name,
    jl.job_address,
    jl.google_drive_link,
    jl.job_plans_link,
    jl.job_pictures_link,
    jl.revenue,
    jl.created_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    jl.project_id,
    (SELECT s.name
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = p.id
     LIMIT 1) AS in_progress_stage_name,
    (SELECT s.id
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = p.id
     LIMIT 1) AS in_progress_step_id
  FROM public.jobs_ledger jl
  JOIN public.projects p ON p.id = jl.project_id
  WHERE jl.project_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND (
      EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = p.id AND superintendent_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = p.master_user_id AND superintendent_id = auth.uid())
    )
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

-- =====================================================================
-- 3. list_jobs_for_tally()
--    display + ORDER BY
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_jobs_for_tally()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name,
    jl.job_address
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor')
  )
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

-- =====================================================================
-- 4. list_tally_parts_with_po()
--    display only
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_tally_parts_with_po()
 RETURNS TABLE(id uuid, job_id uuid, fixture_name text, part_id uuid, quantity numeric, created_by_user_id uuid, created_at timestamp with time zone, price_at_time numeric, fixture_cost numeric, purchase_order_id uuid, purchase_order_name text, purchase_order_status text, hcp_number text, job_name text, job_address text, part_name text, part_manufacturer text, created_by_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
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
$function$;

-- =====================================================================
-- 5. list_job_schedule_blocks_for_schedule_email(uuid, date)
--    display only (jl.hcp_number AS job_hcp_number)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_job_schedule_blocks_for_schedule_email(p_recipient uuid, p_work_date date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    jsb.note,
    trim(COALESCE(u.name, '')) AS assignee_name,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') AS job_hcp_number,
    jl.job_name AS job_name,
    jl.job_address AS job_address
  FROM public.job_schedule_blocks jsb
  INNER JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date = p_work_date
    AND (
      jsb.assignee_user_id = p_recipient
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'dev')
      OR jl.master_user_id = p_recipient
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_superintendents ms
        WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_recipient
      )
      OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_recipient))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = p_recipient AND assistant_id = jl.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = jl.master_user_id AND assistant_id = p_recipient
      )
      OR public.assistants_share_master(p_recipient, jl.master_user_id)
      OR EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = jl.id AND jtm.user_id = p_recipient
      )
    )
  ORDER BY jsb.time_start ASC, jsb.assignee_user_id ASC;
$function$;

-- =====================================================================
-- 6. list_schedule_blocks_for_share(uuid, date, date)
--    display only (jl.hcp_number AS job_hcp_number)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_schedule_blocks_for_share(p_viewer uuid, p_start date, p_end date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    jsb.note,
    trim(COALESCE(u.name, '')) AS assignee_name,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') AS job_hcp_number,
    jl.job_name AS job_name,
    jl.job_address AS job_address
  FROM public.job_schedule_blocks jsb
  INNER JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date BETWEEN p_start AND p_end
    AND (
      jsb.assignee_user_id = p_viewer
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'dev')
      OR jl.master_user_id = p_viewer
      OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_superintendents ms
        WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_viewer
      )
      OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_viewer))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = p_viewer AND assistant_id = jl.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = jl.master_user_id AND assistant_id = p_viewer
      )
      OR public.assistants_share_master(p_viewer, jl.master_user_id)
      OR EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = jl.id AND jtm.user_id = p_viewer
      )
    )
  ORDER BY assignee_name ASC, jsb.work_date ASC, jsb.time_start ASC;
$function$;

-- =====================================================================
-- 7. list_ar_allocations_for_mercury_transaction(uuid)
--    display only (alias j -> j.hcp_number); plpgsql body preserved exact
-- =====================================================================
CREATE OR REPLACE FUNCTION public.list_ar_allocations_for_mercury_transaction(p_mercury_transaction_id uuid)
 RETURNS TABLE(payment_id uuid, job_id uuid, amount numeric, paid_on date, invoice_id uuid, note text, hcp_number text, job_name text, invoice_sequence_order integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: mercury transaction required';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS payment_id,
    p.job_id,
    p.amount::numeric,
    p.paid_on,
    p.invoice_id,
    nullif(trim(coalesce(p.note, '')), '') AS note,
    COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), ''),
    j.job_name,
    inv.sequence_order AS invoice_sequence_order
  FROM public.jobs_ledger_payments p
  INNER JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices inv ON inv.id = p.invoice_id
  WHERE p.mercury_transaction_id = p_mercury_transaction_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  ORDER BY p.paid_on DESC NULLS LAST, p.id;
END;
$function$;

-- =====================================================================
-- 8. search_jobs_for_tally_mercury_assign(text)
--    display + ORDER BY + search both
-- =====================================================================
CREATE OR REPLACE FUNCTION public.search_jobs_for_tally_mercury_assign(search_text text DEFAULT ''::text)
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')::text,
    COALESCE(jl.job_name, '')::text,
    COALESCE(jl.job_address, '')::text
  FROM public.jobs_ledger jl
  WHERE (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR jl.click_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.click_number ILIKE '%' || substring(search_text from 2) || '%'
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
  ORDER BY (CASE WHEN COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') = '' OR COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') IS NULL THEN 1 ELSE 0 END), COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC
  LIMIT 50;
$function$;

-- =====================================================================
-- 9. search_jobs_for_tally_mercury_assign_as_user(uuid, text)
--    display + ORDER BY + search both
-- =====================================================================
CREATE OR REPLACE FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(p_for_user_id uuid, search_text text DEFAULT ''::text)
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')::text,
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
    OR jl.click_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.click_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
  )
  ORDER BY (CASE WHEN COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') = '' OR COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') IS NULL THEN 1 ELSE 0 END), COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC
  LIMIT 50;
$function$;

-- =====================================================================
-- 10. search_jobs_for_reports(text)
--     UNION of job_ledger/project/bid branches.
--     ONLY job_ledger branch touched: display bake-in + click in search.
--     project/bid branches untouched. Outer ORDER BY on sub.hcp_number
--     already orders on the (now coalesced) derived column -> unchanged.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.search_jobs_for_reports(search_text text DEFAULT ''::text)
 RETURNS TABLE(id uuid, source text, display_name text, hcp_number text, address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sub.id, sub.source, sub.display_name, sub.hcp_number, sub.address
  FROM (
    (SELECT jl.id, 'job_ledger'::TEXT AS source, jl.job_name AS display_name, COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')::TEXT AS hcp_number, COALESCE(jl.job_address, '')::TEXT AS address
     FROM public.jobs_ledger jl
     WHERE (search_text IS NULL OR search_text = '' OR jl.hcp_number ILIKE '%' || search_text || '%' OR jl.click_number ILIKE '%' || search_text || '%' OR jl.job_name ILIKE '%' || search_text || '%' OR jl.job_address ILIKE '%' || search_text || '%')
     LIMIT 25)
    UNION ALL
    (SELECT p.id, 'project'::TEXT, p.name, COALESCE(p.housecallpro_number, '')::TEXT, COALESCE(p.address, '')::TEXT
     FROM public.projects p
     WHERE (search_text IS NULL OR search_text = '' OR COALESCE(p.housecallpro_number, '') ILIKE '%' || search_text || '%' OR p.name ILIKE '%' || search_text || '%' OR COALESCE(p.address, '') ILIKE '%' || search_text || '%')
     LIMIT 25)
    UNION ALL
    (SELECT b.id, 'bid'::TEXT AS source,
     COALESCE(b.project_name, b.gc_contact_name, 'Bid')::TEXT AS display_name,
     COALESCE(b.bid_number, '')::TEXT AS hcp_number,
     COALESCE(b.address, '')::TEXT AS address
     FROM public.bids b
     WHERE (search_text IS NULL OR search_text = '' OR
       COALESCE(b.bid_number, '') ILIKE '%' || search_text || '%' OR
       COALESCE(b.project_name, '') ILIKE '%' || search_text || '%' OR
       COALESCE(b.address, '') ILIKE '%' || search_text || '%' OR
       COALESCE(b.gc_contact_name, '') ILIKE '%' || search_text || '%')
     LIMIT 25)
  ) sub
  ORDER BY (CASE WHEN sub.hcp_number = '' THEN 1 ELSE 0 END), sub.hcp_number DESC
$function$;
