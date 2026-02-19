-- Allow everyone in the same scope to see all labor jobs (People > Labor/Ledger).
-- Previously only the job creator (master_user_id) and dev/shared viewers could see a job.
-- Now: masters see jobs entered by their adopted assistants; assistants see jobs entered by
-- their master and by other assistants adopted by the same master.

-- ============================================================================
-- people_labor_jobs: expand SELECT so "anyone" in scope sees all jobs
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read people labor jobs" ON public.people_labor_jobs;

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
    -- Own jobs
    master_user_id = auth.uid()
    OR public.is_dev()
    -- Shared: another master shared with you
    OR EXISTS (
      SELECT 1 FROM public.master_shares
      WHERE sharing_master_id = master_user_id
      AND viewing_master_id = auth.uid()
    )
    -- Shared: you are an assistant and the job owner shared with your master
    OR EXISTS (
      SELECT 1 FROM public.master_assistants ma
      JOIN public.master_shares ms ON ms.viewing_master_id = ma.master_id
      WHERE ma.assistant_id = auth.uid()
      AND ms.sharing_master_id = master_user_id
    )
    -- You are a master and the job was entered by an assistant you adopted
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = auth.uid()
      AND assistant_id = master_user_id
    )
    -- You are an assistant and the job was entered by your master
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
    -- You are an assistant and the job was entered by another assistant adopted by the same master
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
-- people_labor_job_items: same visibility as the job (via job's RLS)
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
