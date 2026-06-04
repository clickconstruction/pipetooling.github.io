-- Superintendents: see ledger (jobs_ledger and child tables) only for jobs linked to projects they're assigned to.
-- Replace adoption-based (master_superintendents) with project-assignment (project_id + can_access_project_row).
-- Aligns with can_access_project_row which grants superintendents access only via project_superintendents.

-- ============================================================================
-- jobs_ledger: superintendent access via assigned projects only
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can read jobs ledger"
ON public.jobs_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR (project_id IS NOT NULL AND public.can_access_project_row(project_id))
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

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger" ON public.jobs_ledger;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can update jobs ledger"
ON public.jobs_ledger
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND (
    master_user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR (project_id IS NOT NULL AND public.can_access_project_row(project_id))
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
);

-- ============================================================================
-- jobs_ledger_materials: superintendent via job.project_id + can_access_project_row
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can read jobs ledger materials"
ON public.jobs_ledger_materials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can insert jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can insert jobs ledger materials"
ON public.jobs_ledger_materials
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can update jobs ledger materials"
ON public.jobs_ledger_materials
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can delete jobs ledger materials" ON public.jobs_ledger_materials;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can delete jobs ledger materials"
ON public.jobs_ledger_materials
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_materials.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
-- jobs_ledger_invoices
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can read jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can insert jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can insert jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can update jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can delete jobs ledger invoices" ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can delete jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
-- jobs_ledger_payments
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can read jobs ledger payments"
ON public.jobs_ledger_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can insert jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can insert jobs ledger payments"
ON public.jobs_ledger_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can update jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can update jobs ledger payments"
ON public.jobs_ledger_payments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can delete jobs ledger payments" ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can delete jobs ledger payments"
ON public.jobs_ledger_payments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
-- jobs_tally_parts
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can read jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary superintendent can read jobs tally parts"
ON public.jobs_tally_parts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);
DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can insert jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary superintendent can insert jobs tally parts"
ON public.jobs_tally_parts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);
DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can update jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary superintendent can update jobs tally parts"
ON public.jobs_tally_parts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);
DROP POLICY IF EXISTS "Devs masters assistants primary superintendent can delete jobs tally parts" ON public.jobs_tally_parts;
CREATE POLICY "Devs masters assistants primary superintendent can delete jobs tally parts"
ON public.jobs_tally_parts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_tally_parts.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);

-- ============================================================================
-- jobs_ledger_fixtures (Billing: fixtures/tie-ins per job)
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants can read jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can read jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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

DROP POLICY IF EXISTS "Devs, masters, assistants can insert jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants, superintendent can insert jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants can update jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants, superintendent can update jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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

DROP POLICY IF EXISTS "Devs, masters, assistants can delete jobs ledger fixtures" ON public.jobs_ledger_fixtures;
CREATE POLICY "Devs, masters, assistants, superintendent can delete jobs ledger fixtures"
ON public.jobs_ledger_fixtures
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_fixtures.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
-- jobs_ledger_team_members (Billing / Sub Sheet Ledger)
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, primary, superintendent can read jobs ledger team members" ON public.jobs_ledger_team_members;
CREATE POLICY "Devs, masters, assistants, primary, superintendent can read jobs ledger team members"
ON public.jobs_ledger_team_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_team_members.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
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
-- job_status_events (Billing status changes)
-- ============================================================================
DROP POLICY IF EXISTS "job_status_events_select" ON public.job_status_events;
CREATE POLICY "job_status_events_select"
ON public.job_status_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = job_status_events.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "job_status_events_insert" ON public.job_status_events;
CREATE POLICY "job_status_events_insert"
ON public.job_status_events
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = job_status_events.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
      OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
    )
  )
);

-- ============================================================================
-- reports: superintendent via project_id or job.project_id only (no adoption)
-- ============================================================================
DROP POLICY IF EXISTS "Superintendent can do all on reports (adoption)" ON public.reports;
DROP POLICY IF EXISTS "Superintendent can do all on reports (assigned projects)" ON public.reports;
CREATE POLICY "Superintendent can do all on reports (assigned projects)"
ON public.reports
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_ledger_id AND jl.project_id IS NOT NULL AND public.can_access_project_row(jl.project_id)
    ))
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    (project_id IS NOT NULL AND public.can_access_project_row(project_id))
    OR
    (job_ledger_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = job_ledger_id AND jl.project_id IS NOT NULL AND public.can_access_project_row(jl.project_id)
    ))
  )
);

-- ============================================================================
-- list_reports_with_job_info: superintendent sees reports for assigned projects only
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_reports_with_job_info()
RETURNS TABLE (
  id UUID,
  template_id UUID,
  template_name TEXT,
  created_by_user_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  field_values JSONB,
  job_ledger_id UUID,
  project_id UUID,
  job_display_name TEXT,
  job_hcp_number TEXT,
  reported_at_lat NUMERIC,
  reported_at_lng NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.template_id,
    rt.name AS template_name,
    r.created_by_user_id,
    u.name AS created_by_name,
    r.created_at,
    r.updated_at,
    r.field_values,
    r.job_ledger_id,
    r.project_id,
    COALESCE(jl.job_name, p.name) AS job_display_name,
    COALESCE(jl.hcp_number, p.housecallpro_number, '')::TEXT AS job_hcp_number,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant'))
      THEN r.reported_at_lng ELSE NULL END AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  WHERE (
    -- Devs, masters, assistants, primary: all reports
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'primary')
    )
    OR
    -- Superintendent: assigned projects only (project or job linked to assigned project)
    (
      EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND (
        (r.project_id IS NOT NULL AND public.can_access_project_row(r.project_id))
        OR
        (r.job_ledger_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.jobs_ledger jl2
          WHERE jl2.id = r.job_ledger_id AND jl2.project_id IS NOT NULL AND public.can_access_project_row(jl2.project_id)
        ))
      )
    )
    OR
    -- Subcontractors: own reports within visibility window
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role = 'subcontractor')
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at DESC;
$$;
