-- Add master_shares support to people, people_labor_jobs, and people_labor_job_items
-- When a Dev shares with another Master (e.g., Malachi), both Malachi and his assistants
-- can see the shared people (including subs) and labor jobs/ledger.

-- ============================================================================
-- people: Add SELECT policy for shared access
-- ============================================================================

CREATE POLICY "Users can see people shared with them or their master"
ON public.people
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.master_shares
    WHERE sharing_master_id = master_user_id
    AND viewing_master_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_assistants ma
    JOIN public.master_shares ms ON ms.viewing_master_id = ma.master_id
    WHERE ma.assistant_id = auth.uid()
    AND ms.sharing_master_id = master_user_id
  )
);

-- ============================================================================
-- people_labor_jobs: Update SELECT policy to include shared access
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read own people labor jobs" ON public.people_labor_jobs;

CREATE POLICY "Devs, masters, assistants, and estimators can read people labor jobs"
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
    OR public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.master_shares
      WHERE sharing_master_id = master_user_id
      AND viewing_master_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants ma
      JOIN public.master_shares ms ON ms.viewing_master_id = ma.master_id
      WHERE ma.assistant_id = auth.uid()
      AND ms.sharing_master_id = master_user_id
    )
  )
);

-- ============================================================================
-- people_labor_job_items: Update SELECT policy so items are visible when job
-- is visible via shared access
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read people labor job items" ON public.people_labor_job_items;

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
      OR public.is_dev()
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = j.master_user_id
        AND viewing_master_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        JOIN public.master_shares ms ON ms.viewing_master_id = ma.master_id
        WHERE ma.assistant_id = auth.uid()
        AND ms.sharing_master_id = j.master_user_id
      )
    )
  )
);
