-- People Labor and Ledger: jobs and items for Labor tab, displayed in Ledger tab

-- ============================================================================
-- people_labor_jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.people_labor_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  labor_rate NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_labor_jobs_master_user_id ON public.people_labor_jobs(master_user_id);

ALTER TABLE public.people_labor_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read own people labor jobs"
ON public.people_labor_jobs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    master_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert own people labor jobs"
ON public.people_labor_jobs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND master_user_id = auth.uid()
);

CREATE POLICY "Devs, masters, assistants, and estimators can update own people labor jobs"
ON public.people_labor_jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    master_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete own people labor jobs"
ON public.people_labor_jobs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    master_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  )
);

COMMENT ON TABLE public.people_labor_jobs IS 'Labor jobs from People Labor tab; owner is master_user_id.';

-- ============================================================================
-- people_labor_job_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.people_labor_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.people_labor_jobs(id) ON DELETE CASCADE,
  fixture TEXT NOT NULL DEFAULT '',
  count NUMERIC(12, 2) NOT NULL DEFAULT 1,
  hrs_per_unit NUMERIC(8, 2) NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_labor_job_items_job_id ON public.people_labor_job_items(job_id);

ALTER TABLE public.people_labor_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read people labor job items"
ON public.people_labor_job_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_items.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert people labor job items"
ON public.people_labor_job_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_items.job_id
    AND j.master_user_id = auth.uid()
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update people labor job items"
ON public.people_labor_job_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_items.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete people labor job items"
ON public.people_labor_job_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_items.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

COMMENT ON TABLE public.people_labor_job_items IS 'Fixture rows per labor job; labor hours = count * hrs_per_unit.';
