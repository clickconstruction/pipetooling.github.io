-- Reports: optional bid anchor (mutually exclusive with job_ledger and project);
-- search, insert_report, display RPCs, list reports; superintendent policy includes bid.

-- ============================================================================
-- 1) Schema: reports.bid_id + exactly-one anchor CHECK
-- ============================================================================
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_job_or_project;

ALTER TABLE public.reports ADD CONSTRAINT reports_one_anchor CHECK (
  (job_ledger_id IS NOT NULL AND project_id IS NULL AND bid_id IS NULL)
  OR (job_ledger_id IS NULL AND project_id IS NOT NULL AND bid_id IS NULL)
  OR (job_ledger_id IS NULL AND project_id IS NULL AND bid_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_reports_bid_id ON public.reports (bid_id) WHERE bid_id IS NOT NULL;

-- ============================================================================
-- 2) Superintendent: reports policy includes bid-anchored rows
-- ============================================================================
DROP POLICY IF EXISTS "Superintendent can do all on reports (assigned projects)" ON public.reports;
CREATE POLICY "Superintendent can do all on reports (assigned projects)"
ON public.reports
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_ledger_id AND jl.project_id IS NOT NULL AND public.can_access_project_row(jl.project_id)
    ))
    OR
    (bid_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bids b
      WHERE b.id = bid_id
        AND public.superintendent_can_access_bid(b)
    ))
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_ledger_id AND jl.project_id IS NOT NULL AND public.can_access_project_row(jl.project_id)
    ))
    OR
    (bid_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bids b
      WHERE b.id = bid_id
        AND public.superintendent_can_access_bid(b)
    ))
  )
);

-- ============================================================================
-- 3) insert_report: 7th arg p_bid_id; exactly one anchor
-- ============================================================================
DROP FUNCTION IF EXISTS public.insert_report(uuid, jsonb, uuid, uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION public.insert_report(
  p_template_id uuid,
  p_field_values jsonb,
  p_job_ledger_id uuid,
  p_project_id uuid,
  p_reported_at_lat NUMERIC DEFAULT NULL,
  p_reported_at_lng NUMERIC DEFAULT NULL,
  p_bid_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  n int;
BEGIN
  IF NOT public.is_estimator() THEN
    RAISE EXCEPTION 'Only estimators can use insert_report';
  END IF;
  n := 0;
  IF p_job_ledger_id IS NOT NULL THEN n := n + 1; END IF;
  IF p_project_id IS NOT NULL THEN n := n + 1; END IF;
  IF p_bid_id IS NOT NULL THEN n := n + 1; END IF;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Exactly one of job_ledger_id, project_id, or bid_id must be set';
  END IF;

  INSERT INTO public.reports (
    template_id, created_by_user_id, field_values,
    job_ledger_id, project_id, bid_id,
    reported_at_lat, reported_at_lng
  )
  VALUES (
    p_template_id,
    auth.uid(),
    COALESCE(p_field_values, '{}'::jsonb),
    p_job_ledger_id,
    p_project_id,
    p_bid_id,
    p_reported_at_lat,
    p_reported_at_lng
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_report(uuid, jsonb, uuid, uuid, numeric, numeric, uuid) IS
  'Inserts a report. SECURITY DEFINER. Only estimators. Exactly one of job, project, or bid.';

GRANT EXECUTE ON FUNCTION public.insert_report(uuid, jsonb, uuid, uuid, numeric, numeric, uuid) TO authenticated;

-- ============================================================================
-- 4) search_jobs_for_reports: add bids leg (source = bid)
-- ============================================================================
DROP FUNCTION IF EXISTS public.search_jobs_for_reports(text);

CREATE OR REPLACE FUNCTION public.search_jobs_for_reports(search_text TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  source TEXT,
  display_name TEXT,
  hcp_number TEXT,
  address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sub.id, sub.source, sub.display_name, sub.hcp_number, sub.address
  FROM (
    (SELECT jl.id, 'job_ledger'::TEXT AS source, jl.job_name AS display_name, COALESCE(jl.hcp_number, '')::TEXT AS hcp_number, COALESCE(jl.job_address, '')::TEXT AS address
     FROM public.jobs_ledger jl
     WHERE (search_text IS NULL OR search_text = '' OR jl.hcp_number ILIKE '%' || search_text || '%' OR jl.job_name ILIKE '%' || search_text || '%' OR jl.job_address ILIKE '%' || search_text || '%')
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
$$;

COMMENT ON FUNCTION public.search_jobs_for_reports(text) IS
  'New Report search: jobs_ledger, projects, and bids; RLS not applied (SECURITY DEFINER) — use only for typeahead.';

-- ============================================================================
-- 5) get_job_display_for_report: bid source
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_job_display_for_report(p_source TEXT, p_id UUID)
RETURNS TABLE (id UUID, source TEXT, display_name TEXT, hcp_number TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  (SELECT jl.id, 'job_ledger'::TEXT, jl.job_name, jl.hcp_number
   FROM public.jobs_ledger jl
   WHERE p_source = 'job_ledger' AND jl.id = p_id
   LIMIT 1)
  UNION ALL
  (SELECT p.id, 'project'::TEXT, p.name, COALESCE(p.housecallpro_number, '')::TEXT
   FROM public.projects p
   WHERE p_source = 'project' AND p.id = p_id
   LIMIT 1)
  UNION ALL
  (SELECT b.id, 'bid'::TEXT,
   COALESCE(b.project_name, b.gc_contact_name, 'Bid')::TEXT,
   COALESCE(b.bid_number, '')::TEXT
   FROM public.bids b
   WHERE p_source = 'bid' AND b.id = p_id
   LIMIT 1);
$$;

-- ============================================================================
-- 6) list_reports_with_job_info: bid_id column + join bids
-- ============================================================================
DROP FUNCTION IF EXISTS public.list_reports_with_job_info();

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
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role = 'subcontractor')
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at DESC;
$$;

-- ============================================================================
-- 7) list_my_reports: same shape (bid display + optional bid_id in select)
-- ============================================================================
DROP FUNCTION IF EXISTS public.list_my_reports();

CREATE OR REPLACE FUNCTION public.list_my_reports()
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
  WHERE r.created_by_user_id = auth.uid()
    AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
  ORDER BY r.created_at DESC;
$$;
