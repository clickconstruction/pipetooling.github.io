-- Reports for a single job (same visibility rules as list_reports_with_job_info) for Job activity / notes merge.
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
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role = 'subcontractor')
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at ASC;
$$;

COMMENT ON FUNCTION public.list_reports_for_job_ledger(uuid) IS
  'Job-scoped field reports with same joins/visibility as list_reports_with_job_info; oldest first for activity merge.';

GRANT EXECUTE ON FUNCTION public.list_reports_for_job_ledger(uuid) TO authenticated;

-- Realtime: refresh Job activity / notes when a new report is filed (client subscribes to reports INSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  END IF;
END
$$;
