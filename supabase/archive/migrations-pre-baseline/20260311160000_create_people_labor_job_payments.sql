-- Create people_labor_job_payments for Sub Labor Make Payment and Backcharge
-- Replaces binary paid_at with individual payment records

CREATE TABLE IF NOT EXISTS public.people_labor_job_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.people_labor_jobs(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  memo TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_people_labor_job_payments_job_id ON public.people_labor_job_payments(job_id);
ALTER TABLE public.people_labor_job_payments ENABLE ROW LEVEL SECURITY;

-- SELECT: same visibility as people_labor_job_items (expanded scope)
CREATE POLICY "Devs, masters, assistants, and estimators can read people labor job payments"
ON public.people_labor_job_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_payments.job_id
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

-- INSERT: job owner or dev
CREATE POLICY "Devs, masters, assistants, and estimators can insert people labor job payments"
ON public.people_labor_job_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

-- UPDATE: job owner or dev
CREATE POLICY "Devs, masters, assistants, and estimators can update people labor job payments"
ON public.people_labor_job_payments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

-- DELETE: job owner or dev
CREATE POLICY "Devs, masters, assistants, and estimators can delete people labor job payments"
ON public.people_labor_job_payments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.people_labor_jobs j
    WHERE j.id = people_labor_job_payments.job_id
    AND (
      j.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
    )
  )
);

COMMENT ON TABLE public.people_labor_job_payments IS 'Payments and backcharges per Sub Labor job. Positive amount = payment, negative = backcharge. Outstanding = total_cost - sum(amount).';
