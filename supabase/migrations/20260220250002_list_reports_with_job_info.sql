-- RPC: list reports with job display info (for Reports tab)
-- Returns reports with template name, creator name, and job display
-- Respects role: devs/masters/assistants see all; subcontractors see own within visibility
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
  job_display_name TEXT,
  job_hcp_number TEXT
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
    COALESCE(jl.hcp_number, p.housecallpro_number, '')::TEXT AS job_hcp_number
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  WHERE (
    -- Devs, masters, assistants: all reports
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant')
    )
    OR
    -- Subcontractors: own reports within visibility window
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role = 'subcontractor')
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at DESC;
$$;
