-- Job Tally: Subs record parts used per job/fixture for review
-- jobs_tally_parts links job + fixture + part from price book + quantity

-- ============================================================================
-- jobs_tally_parts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs_tally_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  fixture_name TEXT NOT NULL DEFAULT '',
  part_id UUID NOT NULL REFERENCES public.material_parts(id) ON DELETE RESTRICT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_tally_parts_job_id ON public.jobs_tally_parts(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tally_parts_job_fixture ON public.jobs_tally_parts(job_id, fixture_name);
CREATE INDEX IF NOT EXISTS idx_jobs_tally_parts_part_id ON public.jobs_tally_parts(part_id);

ALTER TABLE public.jobs_tally_parts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.jobs_tally_parts IS 'Parts tally per job/fixture from subs; for review on Jobs Parts tab.';

-- Devs, masters, assistants: full CRUD (same pattern as jobs_ledger_materials)
CREATE POLICY "Devs masters assistants can read jobs tally parts"
ON public.jobs_tally_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

CREATE POLICY "Devs masters assistants can insert jobs tally parts"
ON public.jobs_tally_parts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

CREATE POLICY "Devs masters assistants can update jobs tally parts"
ON public.jobs_tally_parts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

CREATE POLICY "Devs masters assistants can delete jobs tally parts"
ON public.jobs_tally_parts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- Subcontractors: SELECT and INSERT only (for Job Tally flow)
-- SELECT: jobs where they are team member
-- INSERT: when created_by_user_id = auth.uid() and they are team member of job
CREATE POLICY "Subcontractors can read jobs tally parts for their jobs"
ON public.jobs_tally_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = jobs_tally_parts.job_id AND jtm.user_id = auth.uid()
  )
);

CREATE POLICY "Subcontractors can insert jobs tally parts for their jobs"
ON public.jobs_tally_parts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
  AND created_by_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = jobs_tally_parts.job_id AND jtm.user_id = auth.uid()
  )
);

-- ============================================================================
-- RPC: list_jobs_for_tally
-- Returns jobs_ledger rows where auth.uid() is in jobs_ledger_team_members
-- Used by Job Tally page for subs to select a job
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_jobs_for_tally()
RETURNS TABLE (
  id UUID,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    jl.hcp_number,
    jl.job_name,
    jl.job_address
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'subcontractor'
  )
  ORDER BY jl.hcp_number DESC, jl.job_name;
$$;
