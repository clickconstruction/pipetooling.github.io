-- Add project_id to jobs_ledger to link Jobs (billing) with Projects (multi-phase work)
-- Jobs can optionally belong to a project; not all jobs need projects

-- ============================================================================
-- Schema: add project_id column
-- ============================================================================
ALTER TABLE public.jobs_ledger
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_project_id ON public.jobs_ledger(project_id);

COMMENT ON COLUMN public.jobs_ledger.project_id IS 'Optional link to project for multi-phase work. When set, job owner must match project owner.';

-- ============================================================================
-- Trigger: job owner must match project owner when project_id is set
-- (PostgreSQL CHECK constraints cannot use subqueries)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.jobs_ledger_project_master_match_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.master_user_id = NEW.master_user_id
    ) THEN
      RAISE EXCEPTION 'Job master_user_id must match project owner when project_id is set';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_project_master_match ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_project_master_match
  BEFORE INSERT OR UPDATE ON public.jobs_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_project_master_match_fn();

-- ============================================================================
-- RLS: jobs_ledger - add project-level access for superintendents
-- ============================================================================

-- SELECT: superintendents with project assignment can see jobs linked to that project
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can read jobs ledger"
ON public.jobs_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = master_user_id AND superintendent_id = auth.uid())
    OR (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = auth.uid()
      AND assistant_id = master_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
    OR public.assistants_share_master(auth.uid(), master_user_id)
  )
);

-- UPDATE: same project-level access
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can update jobs ledger"
ON public.jobs_ledger
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = master_user_id AND superintendent_id = auth.uid())
    OR (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = auth.uid()
      AND assistant_id = master_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
    OR public.assistants_share_master(auth.uid(), master_user_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
);

-- INSERT: allow creating jobs linked to projects when user has project access
DROP POLICY IF EXISTS "Devs, masters, assistants can insert jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants can insert jobs ledger"
ON public.jobs_ledger
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    master_user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND public.can_access_project_row(project_id)
      AND master_user_id = (SELECT master_user_id FROM public.projects WHERE id = project_id)
    )
  )
);

-- ============================================================================
-- RLS: reports - superintendent can see reports for jobs with project access
-- ============================================================================
DROP POLICY IF EXISTS "Superintendent can do all on reports (adoption)" ON public.reports;
CREATE POLICY "Superintendent can do all on reports (adoption)"
ON public.reports
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger jl
        JOIN public.master_superintendents ms ON ms.master_id = jl.master_user_id AND ms.superintendent_id = auth.uid()
        WHERE jl.id = job_ledger_id
      )
      OR EXISTS (
        SELECT 1 FROM public.jobs_ledger jl
        WHERE jl.id = job_ledger_id AND jl.project_id IS NOT NULL AND public.can_access_project_row(jl.project_id)
      )
    ))
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger jl
        JOIN public.master_superintendents ms ON ms.master_id = jl.master_user_id AND ms.superintendent_id = auth.uid()
        WHERE jl.id = job_ledger_id
      )
      OR EXISTS (
        SELECT 1 FROM public.jobs_ledger jl
        WHERE jl.id = job_ledger_id AND jl.project_id IS NOT NULL AND public.can_access_project_row(jl.project_id)
      )
    ))
  )
);

-- ============================================================================
-- list_reports_with_job_info: superintendent sees reports for jobs with project access
-- ============================================================================
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
  WHERE (
    -- Devs, masters, assistants, primary: all reports
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'primary')
    )
    OR
    -- Superintendent: adoption-filtered (project or job from adopted master or project-assigned job)
    (
      EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND (
        (r.project_id IS NOT NULL AND public.can_access_project_row(r.project_id))
        OR
        (r.job_ledger_id IS NOT NULL AND (
          EXISTS (
            SELECT 1 FROM public.jobs_ledger jl2
            JOIN public.master_superintendents ms ON ms.master_id = jl2.master_user_id AND ms.superintendent_id = auth.uid()
            WHERE jl2.id = r.job_ledger_id
          )
          OR EXISTS (
            SELECT 1 FROM public.jobs_ledger jl2
            WHERE jl2.id = r.job_ledger_id AND jl2.project_id IS NOT NULL AND public.can_access_project_row(jl2.project_id)
          )
        ))
      )
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
