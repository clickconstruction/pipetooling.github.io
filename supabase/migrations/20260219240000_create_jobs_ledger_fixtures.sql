-- Fixture/Tie-ins per billing job (Jobs page Billing tab)

CREATE TABLE IF NOT EXISTS public.jobs_ledger_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 1,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_fixtures_job_id ON public.jobs_ledger_fixtures(job_id);

ALTER TABLE public.jobs_ledger_fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants can read jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

CREATE POLICY "Devs, masters, assistants can insert jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
    AND j.master_user_id = auth.uid()
  )
);

CREATE POLICY "Devs, masters, assistants can update jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
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
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can delete jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

COMMENT ON TABLE public.jobs_ledger_fixtures IS 'Fixture/tie-in items per billing job.';
