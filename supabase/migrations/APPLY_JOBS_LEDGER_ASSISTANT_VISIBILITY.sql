-- MANUAL FIX: Run this in Supabase Dashboard > SQL Editor if assistants only see their own Billing Jobs.
-- This creates assistants_share_master() and applies the fixed RLS policies from
-- 20260219270001_fix_jobs_ledger_assistant_visibility_rls.sql

-- Create SECURITY DEFINER function (bypasses RLS on master_assistants)
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

-- jobs_ledger
DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants can read jobs ledger" ON public.jobs_ledger FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = master_user_id)
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
    OR public.assistants_share_master(auth.uid(), master_user_id)
  )
);

-- jobs_ledger_materials
DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants can read jobs ledger materials" ON public.jobs_ledger_materials FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_materials.job_id AND (
      j.master_user_id = auth.uid() OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- jobs_ledger_team_members
DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger team members" ON public.jobs_ledger_team_members;
CREATE POLICY "Devs, masters, assistants can read jobs ledger team members" ON public.jobs_ledger_team_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_team_members.job_id AND (
      j.master_user_id = auth.uid() OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- jobs_ledger_fixtures
DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants can read jobs ledger fixtures" ON public.jobs_ledger_fixtures FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_fixtures.job_id AND (
      j.master_user_id = auth.uid() OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);
