-- Field reports for a single bid (visibility aligned with list_reports_for_job_ledger) for Bid Board notes panel.

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
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role = 'subcontractor')
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

GRANT EXECUTE ON FUNCTION public.list_reports_for_bid(uuid) TO authenticated;
