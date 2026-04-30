-- Report list RPCs previously returned reported_at_lat/lng only for dev, master_technician, assistant.
-- Extend coordinates to primary, superintendent, estimator when the row is visible; helpers/subcontractor
-- see coords on their own submissions. list_my_reports is always own rows — return stored coords directly.

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
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
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
        (r.job_ledger_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(r.job_ledger_id))
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

COMMENT ON FUNCTION public.list_reports_for_job_ledger(uuid) IS
  'Job-scoped field reports with same joins/visibility as list_reports_with_job_info; oldest first for activity merge.';

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
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
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
        (r.job_ledger_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(r.job_ledger_id))
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
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
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

COMMENT ON FUNCTION public.list_reports_for_bid(uuid) IS
  'Bid-scoped field reports; same visibility family as list_reports_for_job_ledger; oldest first.';

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
    r.reported_at_lat AS reported_at_lat,
    r.reported_at_lng AS reported_at_lng
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
