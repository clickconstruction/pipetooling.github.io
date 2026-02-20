-- Allow all assistants adopted by the same master to see all jobs_ledger entries.
-- Previously: assistants only saw jobs where master_user_id = auth.uid() (jobs they entered).
-- Now: assistants see jobs from their master and from other assistants adopted by the same master.
-- Matches the visibility model used for people_labor_jobs.

-- ============================================================================
-- jobs_ledger: expand SELECT so assistants see all jobs in their scope
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger" ON public.jobs_ledger;

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
    OR public.is_dev()
    -- Master sees jobs entered by adopted assistants
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = auth.uid()
      AND assistant_id = master_user_id
    )
    -- Assistant sees jobs entered by their master
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
    -- Assistant sees jobs entered by other assistants of the same master
    OR EXISTS (
      SELECT 1 FROM public.master_assistants ma_me
      WHERE ma_me.assistant_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.master_assistants ma_other
        WHERE ma_other.master_id = ma_me.master_id
        AND ma_other.assistant_id = master_user_id
      )
    )
  )
);

-- ============================================================================
-- jobs_ledger_materials: same visibility as job
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger materials" ON public.jobs_ledger_materials;

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
      OR public.is_dev()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = auth.uid()
        AND assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma_me
        WHERE ma_me.assistant_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.master_assistants ma_other
          WHERE ma_other.master_id = ma_me.master_id
          AND ma_other.assistant_id = j.master_user_id
        )
      )
    )
  )
);

-- ============================================================================
-- jobs_ledger_team_members: same visibility as job
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger team members" ON public.jobs_ledger_team_members;

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
      OR public.is_dev()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = auth.uid()
        AND assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma_me
        WHERE ma_me.assistant_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.master_assistants ma_other
          WHERE ma_other.master_id = ma_me.master_id
          AND ma_other.assistant_id = j.master_user_id
        )
      )
    )
  )
);

-- ============================================================================
-- jobs_ledger_fixtures: same visibility as job
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger fixtures" ON public.jobs_ledger_fixtures;

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
      OR public.is_dev()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = auth.uid()
        AND assistant_id = j.master_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma_me
        WHERE ma_me.assistant_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.master_assistants ma_other
          WHERE ma_other.master_id = ma_me.master_id
          AND ma_other.assistant_id = j.master_user_id
        )
      )
    )
  )
);

COMMENT ON POLICY "Devs, masters, assistants can read jobs ledger" ON public.jobs_ledger IS 'Assistants see all jobs from their master and from other assistants adopted by the same master.';
