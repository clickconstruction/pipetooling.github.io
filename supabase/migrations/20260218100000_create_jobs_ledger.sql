-- Jobs Ledger: HCP jobs with materials list and team members
-- Visible to dev, master_technician, assistant only (Jobs page)

-- ============================================================================
-- jobs_ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hcp_number TEXT NOT NULL DEFAULT '',
  job_name TEXT NOT NULL DEFAULT '',
  job_address TEXT NOT NULL DEFAULT '',
  revenue NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_master_user_id ON public.jobs_ledger(master_user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_hcp_number ON public.jobs_ledger(hcp_number);
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_job_name ON public.jobs_ledger(job_name);

ALTER TABLE public.jobs_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants can read jobs ledger"
ON public.jobs_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    master_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  )
);

CREATE POLICY "Devs, masters, assistants can insert jobs ledger"
ON public.jobs_ledger
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND master_user_id = auth.uid()
);

CREATE POLICY "Devs, masters, assistants can update jobs ledger"
ON public.jobs_ledger
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
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
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can delete jobs ledger"
ON public.jobs_ledger
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    master_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
  )
);

COMMENT ON TABLE public.jobs_ledger IS 'Jobs ledger from Jobs page; HCP #, name, address, materials, team, revenue.';

-- ============================================================================
-- jobs_ledger_materials
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs_ledger_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_materials_job_id ON public.jobs_ledger_materials(job_id);

ALTER TABLE public.jobs_ledger_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants can read jobs ledger materials"
ON public.jobs_ledger_materials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

CREATE POLICY "Devs, masters, assistants can insert jobs ledger materials"
ON public.jobs_ledger_materials
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
    AND j.master_user_id = auth.uid()
  )
);

CREATE POLICY "Devs, masters, assistants can update jobs ledger materials"
ON public.jobs_ledger_materials
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
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

CREATE POLICY "Devs, masters, assistants can delete jobs ledger materials"
ON public.jobs_ledger_materials
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

COMMENT ON TABLE public.jobs_ledger_materials IS 'Materials line items per job; description and amount.';

-- ============================================================================
-- jobs_ledger_team_members
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs_ledger_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_ledger_team_members_job_id ON public.jobs_ledger_team_members(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_team_members_user_id ON public.jobs_ledger_team_members(user_id);

ALTER TABLE public.jobs_ledger_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants can read jobs ledger team members"
ON public.jobs_ledger_team_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_team_members.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

CREATE POLICY "Devs, masters, assistants can insert jobs ledger team members"
ON public.jobs_ledger_team_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_team_members.job_id
    AND j.master_user_id = auth.uid()
  )
);

CREATE POLICY "Devs, masters, assistants can delete jobs ledger team members"
ON public.jobs_ledger_team_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_team_members.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

COMMENT ON TABLE public.jobs_ledger_team_members IS 'Team members (users) assigned to a job.';
