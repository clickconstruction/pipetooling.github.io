-- Add assistants_share_master to INSERT policies for jobs_ledger_invoices and jobs_ledger_payments
-- Fixes: Assistants who see jobs via shared masters (assistants_share_master) could view/update/delete
-- invoices but could not create them. Now INSERT matches SELECT/UPDATE/DELETE.

DROP POLICY IF EXISTS "Devs, masters, assistants, primary can insert jobs ledger invoices"
ON public.jobs_ledger_invoices;
CREATE POLICY "Devs, masters, assistants, primary can insert jobs ledger invoices"
ON public.jobs_ledger_invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_invoices.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);
DROP POLICY IF EXISTS "Devs, masters, assistants, primary can insert jobs ledger payments"
ON public.jobs_ledger_payments;
CREATE POLICY "Devs, masters, assistants, primary can insert jobs ledger payments"
ON public.jobs_ledger_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = jobs_ledger_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = j.master_user_id
        AND assistant_id = auth.uid()
      )
      OR public.assistants_share_master(auth.uid(), j.master_user_id)
    )
  )
);
