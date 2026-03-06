-- Inspections: scheduled inspections linked to jobs (jobs_ledger or projects)
-- Access: dev, master_technician, assistant, primary (same as reports)

-- ============================================================================
-- inspections
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_ledger_id UUID REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  inspection_type TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT inspections_job_or_project CHECK (
    (job_ledger_id IS NOT NULL AND project_id IS NULL) OR
    (job_ledger_id IS NULL AND project_id IS NOT NULL)
  ),
  CONSTRAINT inspections_type_check CHECK (
    inspection_type IN (
      'Plumbing Rough-In',
      'Plumbing Pre Pour',
      'Gas Rough-In',
      'Gas Final',
      'Plumbing Top Out',
      'Shower Pan',
      'Sewer & Water Service (water line)',
      'Plumbing Final'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_inspections_job_ledger ON public.inspections(job_ledger_id);
CREATE INDEX IF NOT EXISTS idx_inspections_project ON public.inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_inspections_scheduled_date ON public.inspections(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_inspections_created_by ON public.inspections(created_by_user_id);

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Trigger: update updated_at
CREATE TRIGGER set_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Devs, masters, assistants: SELECT, INSERT, UPDATE
CREATE POLICY "Devs masters assistants can select inspections"
ON public.inspections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs masters assistants can insert inspections"
ON public.inspections
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Devs masters assistants can update inspections"
ON public.inspections
FOR UPDATE
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

-- Devs only: DELETE
CREATE POLICY "Devs can delete inspections"
ON public.inspections
FOR DELETE
USING (public.is_dev());

-- Primary: SELECT, INSERT, UPDATE (no DELETE)
CREATE POLICY "Primary can select inspections"
ON public.inspections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
);

CREATE POLICY "Primary can insert inspections"
ON public.inspections
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Primary can update inspections"
ON public.inspections
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'primary'
  )
);

COMMENT ON TABLE public.inspections IS 'Scheduled inspections linked to jobs (jobs_ledger or projects).';
