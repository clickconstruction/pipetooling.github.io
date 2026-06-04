-- Create jobs_ledger_payments for multiple payments per job; mirrors jobs_ledger_materials pattern
-- payments_made on jobs_ledger = sum of amounts (kept in sync on save)

CREATE TABLE IF NOT EXISTS public.jobs_ledger_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_payments_job_id ON public.jobs_ledger_payments(job_id);
ALTER TABLE public.jobs_ledger_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Devs, masters, assistants, primary can read jobs ledger payments"
ON public.jobs_ledger_payments
FOR SELECT
USING (
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
    )
  )
);
CREATE POLICY "Devs, masters, assistants, primary can update jobs ledger payments"
ON public.jobs_ledger_payments
FOR UPDATE
USING (
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
    AND role IN ('dev', 'master_technician', 'assistant', 'primary')
  )
);
CREATE POLICY "Devs, masters, assistants, primary can delete jobs ledger payments"
ON public.jobs_ledger_payments
FOR DELETE
USING (
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
COMMENT ON TABLE public.jobs_ledger_payments IS 'Individual payments per job. Total payments_made = sum(amount). Remaining = revenue - sum(amount).';
-- Data migration: migrate existing payments_made to jobs_ledger_payments
INSERT INTO public.jobs_ledger_payments (job_id, amount, sequence_order)
SELECT id, COALESCE(payments_made, 0), 0
FROM public.jobs_ledger
WHERE COALESCE(payments_made, 0) > 0;
