-- Per–service-type display prefixes for jobs (HCP) and bids (bid #); backfill P/E/HVAC; extend search RPCs and dashboard job list.

ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS ledger_job_prefix TEXT,
  ADD COLUMN IF NOT EXISTS ledger_bid_prefix TEXT;

COMMENT ON COLUMN public.service_types.ledger_job_prefix IS 'Display prefix before HCP # (e.g. JP). Null/blank = use J in UI.';
COMMENT ON COLUMN public.service_types.ledger_bid_prefix IS 'Display prefix before bid # (e.g. BP). Null/blank = use B in UI.';

UPDATE public.service_types SET ledger_job_prefix = 'JP', ledger_bid_prefix = 'BP' WHERE name = 'Plumbing';
UPDATE public.service_types SET ledger_job_prefix = 'JE', ledger_bid_prefix = 'BE' WHERE name = 'Electrical';
UPDATE public.service_types SET ledger_job_prefix = 'JH', ledger_bid_prefix = 'BH' WHERE name = 'HVAC';

-- search_jobs_ledger: add service_type_id; J + configured ledger_job_prefix stripping for HCP match
DROP FUNCTION IF EXISTS public.search_jobs_ledger(text);

CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  service_type_id UUID,
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
    jl.service_type_id,
    COALESCE(jl.hcp_number, '')::TEXT,
    COALESCE(jl.job_name, '')::TEXT,
    COALESCE(jl.job_address, '')::TEXT
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
    OR EXISTS (
      SELECT 1
      FROM public.service_types st
      WHERE st.ledger_job_prefix IS NOT NULL
        AND btrim(st.ledger_job_prefix) <> ''
        AND coalesce(search_text, '') <> ''
        AND length(search_text) > length(btrim(st.ledger_job_prefix))
        AND lower(search_text) LIKE lower(btrim(st.ledger_job_prefix)) || '%'
        AND jl.hcp_number ILIKE '%' || substring(search_text from length(btrim(st.ledger_job_prefix)) + 1) || '%'
    )
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_ledger(TEXT) IS 'Search jobs_ledger by HCP, job name, or address. J prefix and ledger_job_prefix (Settings) normalized for HCP match.';

-- search_bids_for_clock: add service_type_id; B + configured ledger_bid_prefix stripping
DROP FUNCTION IF EXISTS public.search_bids_for_clock(TEXT, UUID, UUID[]);

CREATE OR REPLACE FUNCTION public.search_bids_for_clock(
  p_search_text TEXT DEFAULT '',
  p_service_type_id UUID DEFAULT NULL,
  p_service_type_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  service_type_id UUID,
  bid_number TEXT,
  project_name TEXT,
  address TEXT,
  customer_name TEXT,
  service_type_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.service_type_id,
    COALESCE(b.bid_number, '')::TEXT,
    COALESCE(b.project_name, '')::TEXT,
    COALESCE(b.address, '')::TEXT,
    COALESCE(c.name, bgb.name, '')::TEXT,
    COALESCE(st.name, '')::TEXT
  FROM public.bids b
  LEFT JOIN public.customers c ON c.id = b.customer_id
  LEFT JOIN public.bids_gc_builders bgb ON bgb.id = b.gc_builder_id
  LEFT JOIN public.service_types st ON st.id = b.service_type_id
  WHERE (
    (p_service_type_ids IS NOT NULL AND coalesce(array_length(p_service_type_ids, 1), 0) > 0 AND b.service_type_id = ANY(p_service_type_ids))
    OR ((p_service_type_ids IS NULL OR coalesce(array_length(p_service_type_ids, 1), 0) = 0) AND (p_service_type_id IS NULL OR b.service_type_id = p_service_type_id))
  )
  AND (
    p_search_text IS NULL OR p_search_text = ''
    OR b.bid_number ILIKE '%' || p_search_text || '%'
    OR (
      length(p_search_text) >= 2
      AND lower(left(p_search_text, 1)) = 'b'
      AND b.bid_number ILIKE '%' || substring(p_search_text from 2) || '%'
    )
    OR b.project_name ILIKE '%' || p_search_text || '%'
    OR b.address ILIKE '%' || p_search_text || '%'
    OR c.name ILIKE '%' || p_search_text || '%'
    OR bgb.name ILIKE '%' || p_search_text || '%'
    OR EXISTS (
      SELECT 1
      FROM public.service_types stp
      WHERE stp.ledger_bid_prefix IS NOT NULL
        AND btrim(stp.ledger_bid_prefix) <> ''
        AND coalesce(p_search_text, '') <> ''
        AND length(p_search_text) > length(btrim(stp.ledger_bid_prefix))
        AND lower(p_search_text) LIKE lower(btrim(stp.ledger_bid_prefix)) || '%'
        AND b.bid_number ILIKE '%' || substring(p_search_text from length(btrim(stp.ledger_bid_prefix)) + 1) || '%'
    )
  )
  ORDER BY b.project_name
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_bids_for_clock(TEXT, UUID, UUID[]) IS 'Search bids for Clock In/Dispatch. B + ledger_bid_prefix stripping; returns service_type_id and service_type_name. SECURITY DEFINER.';

-- Dashboard assigned jobs: include service_type_id for Clock In / prefix resolution
DROP FUNCTION IF EXISTS public.list_assigned_jobs_for_dashboard();

CREATE FUNCTION public.list_assigned_jobs_for_dashboard()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  google_drive_link TEXT,
  job_plans_link TEXT,
  job_pictures_link TEXT,
  revenue NUMERIC,
  master_user_id UUID,
  created_at TIMESTAMPTZ,
  last_report_at TIMESTAMPTZ,
  my_last_report_at TIMESTAMPTZ,
  last_thread_note_at TIMESTAMPTZ,
  last_clock_activity_at TIMESTAMPTZ,
  last_schedule_activity_at TIMESTAMPTZ,
  last_job_activity_at TIMESTAMPTZ,
  project_id UUID,
  in_progress_stage_name TEXT,
  in_progress_step_id UUID,
  status TEXT,
  service_type_id UUID
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
    jl.project_id,
    (SELECT s.name
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = jl.project_id
     LIMIT 1) AS in_progress_stage_name,
    (SELECT s.id
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = jl.project_id
     LIMIT 1) AS in_progress_step_id,
    jl.status::text,
    jl.service_type_id
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'working'
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;

COMMENT ON FUNCTION public.list_assigned_jobs_for_dashboard() IS
  'Team working jobs for dashboard. Includes service_type_id for ledger display prefixes.';

GRANT EXECUTE ON FUNCTION public.list_assigned_jobs_for_dashboard() TO authenticated;
