-- Fix: Assistants couldn't see other assistants' Billing Jobs because RLS on master_assistants
-- blocks the subquery. Assistants can only read master_assistants rows where assistant_id = auth.uid(),
-- so Wendi cannot read Taunya's adoption rows. Use SECURITY DEFINER to bypass RLS when checking
-- if two assistants share a master (same pattern as master_adopted_current_user in fix_users_rls_for_project_masters.sql).

CREATE OR REPLACE FUNCTION public.assistants_share_master(assistant_a UUID, assistant_b UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_assistants ma_a
    JOIN public.master_assistants ma_b ON ma_b.master_id = ma_a.master_id
    WHERE ma_a.assistant_id = assistants_share_master.assistant_a
    AND ma_b.assistant_id = assistants_share_master.assistant_b
  );
$$;

COMMENT ON FUNCTION public.assistants_share_master(UUID, UUID) IS 'Returns true if both assistants are adopted by the same master. Uses SECURITY DEFINER to bypass RLS on master_assistants.';

-- ============================================================================
-- jobs_ledger: use assistants_share_master for assistant-to-assistant visibility
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

-- ============================================================================
-- jobs_ledger_materials
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
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_ledger_team_members
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
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_ledger_fixtures
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
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

COMMENT ON POLICY "Devs, masters, assistants can read jobs ledger" ON public.jobs_ledger IS 'Assistants see all jobs from their master and from other assistants adopted by the same master. Uses assistants_share_master() to bypass RLS on master_assistants.';
