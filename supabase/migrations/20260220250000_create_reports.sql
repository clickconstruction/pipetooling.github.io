-- Reports: job reports with templates, role-based permissions
-- Reports can link to jobs_ledger (HCP) or projects

-- ============================================================================
-- report_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sequence_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_sequence ON public.report_templates(sequence_order);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read report templates"
ON public.report_templates
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Devs can manage report templates"
ON public.report_templates
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- ============================================================================
-- report_template_fields
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.report_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sequence_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_template_fields_template ON public.report_template_fields(template_id);

ALTER TABLE public.report_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read report template fields"
ON public.report_template_fields
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Devs can manage report template fields"
ON public.report_template_fields
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- ============================================================================
-- reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_ledger_id UUID REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.report_templates(id) ON DELETE RESTRICT,
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  field_values JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT reports_job_or_project CHECK (
    (job_ledger_id IS NOT NULL AND project_id IS NULL) OR
    (job_ledger_id IS NULL AND project_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_reports_job_ledger ON public.reports(job_ledger_id);
CREATE INDEX IF NOT EXISTS idx_reports_project ON public.reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Helper: report_sub_visibility_months from app_settings (default 3)
CREATE OR REPLACE FUNCTION public.report_sub_visibility_months()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value_num FROM app_settings WHERE key = 'report_sub_visibility_months'), 3)::numeric;
$$;

-- Helper: report_edit_window_days from app_settings (default 2)
CREATE OR REPLACE FUNCTION public.report_edit_window_days()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value_num FROM app_settings WHERE key = 'report_edit_window_days'), 2)::numeric;
$$;

-- Devs, masters, assistants: full access
CREATE POLICY "Devs masters assistants can do all on reports"
ON public.reports
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- Subcontractors: insert any report
CREATE POLICY "Subcontractors can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
  AND created_by_user_id = auth.uid()
);

-- Subcontractors: select own reports within visibility window
CREATE POLICY "Subcontractors can select own reports within visibility"
ON public.reports
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
  AND created_by_user_id = auth.uid()
  AND created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
);

-- Subcontractors: update own reports within edit window
CREATE POLICY "Subcontractors can update own reports within edit window"
ON public.reports
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
  AND created_by_user_id = auth.uid()
  AND created_at >= (NOW() - (public.report_edit_window_days() || ' days')::interval)
)
WITH CHECK (
  created_by_user_id = auth.uid()
);

-- ============================================================================
-- report_enabled_users
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_enabled_users (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.report_enabled_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can manage report enabled users"
ON public.report_enabled_users
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- ============================================================================
-- App settings defaults
-- ============================================================================

INSERT INTO public.app_settings (key, value_num) VALUES
  ('report_edit_window_days', 2),
  ('report_sub_visibility_months', 3)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Seed templates
-- ============================================================================

DO $$
DECLARE
  t1_id UUID;
  t2_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Superintendent Report') THEN
    INSERT INTO public.report_templates (name, sequence_order) VALUES ('Superintendent Report', 0)
    RETURNING id INTO t1_id;
    INSERT INTO public.report_template_fields (template_id, label, sequence_order) VALUES
      (t1_id, 'Who was on the job?', 0),
      (t1_id, 'What is the status of the job?', 1),
      (t1_id, 'What needs to be done to get to the next stage?', 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Walk Report') THEN
    INSERT INTO public.report_templates (name, sequence_order) VALUES ('Walk Report', 1)
    RETURNING id INTO t2_id;
    INSERT INTO public.report_template_fields (template_id, label, sequence_order) VALUES
      (t2_id, 'What is a risk?', 0),
      (t2_id, 'What makes us look bad?', 1),
      (t2_id, 'What needs to be dealt with?', 2);
  END IF;
END $$;

-- ============================================================================
-- RPC: search jobs for report creation (allows subs to find jobs without direct read)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_jobs_for_reports(search_text TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  source TEXT,
  display_name TEXT,
  hcp_number TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  (SELECT jl.id, 'job_ledger'::TEXT, jl.job_name, jl.hcp_number
   FROM public.jobs_ledger jl
   WHERE (search_text IS NULL OR search_text = '' OR jl.hcp_number ILIKE '%' || search_text || '%' OR jl.job_name ILIKE '%' || search_text || '%' OR jl.job_address ILIKE '%' || search_text || '%')
   ORDER BY jl.job_name
   LIMIT 25)
  UNION ALL
  (SELECT p.id, 'project'::TEXT, p.name, COALESCE(p.housecallpro_number, '')::TEXT
   FROM public.projects p
   WHERE (search_text IS NULL OR search_text = '' OR COALESCE(p.housecallpro_number, '') ILIKE '%' || search_text || '%' OR p.name ILIKE '%' || search_text || '%' OR COALESCE(p.address, '') ILIKE '%' || search_text || '%')
   ORDER BY p.name
   LIMIT 25);
$$;

COMMENT ON TABLE public.report_templates IS 'Report templates (e.g. Superintendent Report, Walk Report)';
COMMENT ON TABLE public.report_template_fields IS 'Fields for each report template';
COMMENT ON TABLE public.reports IS 'Job/project reports from subcontractors and others';
COMMENT ON TABLE public.report_enabled_users IS 'Subcontractors/estimators who get New Report button but cannot see Reports section';
