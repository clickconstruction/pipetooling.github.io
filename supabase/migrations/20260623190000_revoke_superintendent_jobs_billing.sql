-- Revoke superintendent access to Jobs billing (jobs_ledger and child tables).
-- Superintendents should not see Jobs Billing tab; the correct ledger is Workflow Line Items For Office.

-- ============================================================================
-- jobs_ledger
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger"
ON public.jobs_ledger FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = master_user_id)
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
    OR public.assistants_share_master(auth.uid(), master_user_id)
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants, primary can update jobs ledger"
ON public.jobs_ledger FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = master_user_id)
    OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
    OR public.assistants_share_master(auth.uid(), master_user_id)
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
);

-- ============================================================================
-- jobs_ledger_materials
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger materials"
ON public.jobs_ledger_materials FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_materials.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can insert jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary can insert jobs ledger materials"
ON public.jobs_ledger_materials FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_materials.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary can update jobs ledger materials"
ON public.jobs_ledger_materials FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_materials.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
)
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')));

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can delete jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary can delete jobs ledger materials"
ON public.jobs_ledger_materials FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_materials.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_ledger_invoices
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger invoices"
ON public.jobs_ledger_invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_invoices.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can insert jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary can insert jobs ledger invoices"
ON public.jobs_ledger_invoices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_invoices.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary can update jobs ledger invoices"
ON public.jobs_ledger_invoices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_invoices.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
)
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')));

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can delete jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary can delete jobs ledger invoices"
ON public.jobs_ledger_invoices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_invoices.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_ledger_payments
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger payments"
ON public.jobs_ledger_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_payments.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can insert jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary can insert jobs ledger payments"
ON public.jobs_ledger_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_payments.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary can update jobs ledger payments"
ON public.jobs_ledger_payments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_payments.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
)
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary')));

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can delete jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary can delete jobs ledger payments"
ON public.jobs_ledger_payments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_payments.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_tally_parts
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can read jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary can read jobs tally parts"
ON public.jobs_tally_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_tally_parts.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can insert jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary can insert jobs tally parts"
ON public.jobs_tally_parts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_tally_parts.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can update jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary can update jobs tally parts"
ON public.jobs_tally_parts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_tally_parts.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can delete jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary can delete jobs tally parts"
ON public.jobs_tally_parts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_tally_parts.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_ledger_fixtures
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger fixtures"
ON public.jobs_ledger_fixtures FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_fixtures.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, superintendent can insert jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants can insert jobs ledger fixtures"
ON public.jobs_ledger_fixtures FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_fixtures.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, superintendent can update jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants can update jobs ledger fixtures"
ON public.jobs_ledger_fixtures FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_fixtures.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, superintendent can delete jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants can delete jobs ledger fixtures"
ON public.jobs_ledger_fixtures FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_fixtures.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_ledger_team_members
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger team members" ON public.jobs_ledger_team_members;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger team members"
ON public.jobs_ledger_team_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = jobs_ledger_team_members.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- job_status_events
-- ============================================================================
DROP POLICY IF EXISTS "job_status_events_select" ON public.job_status_events;
CREATE POLICY "job_status_events_select" ON public.job_status_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_status_events.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "job_status_events_insert" ON public.job_status_events;
CREATE POLICY "job_status_events_insert" ON public.job_status_events FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_status_events.job_id AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);
