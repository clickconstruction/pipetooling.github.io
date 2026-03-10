-- Supply house invoice job allocations: split invoices across jobs by percentage
-- Materials: link invoices to jobs; Jobs Parts: show allocated invoice amount per job

CREATE TABLE public.supply_house_invoice_job_allocations (
  invoice_id UUID NOT NULL REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  pct NUMERIC(5, 2) NOT NULL CHECK (pct >= 0 AND pct <= 100),
  PRIMARY KEY (invoice_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_supply_house_invoice_job_allocations_job_id ON public.supply_house_invoice_job_allocations(job_id);
COMMENT ON TABLE public.supply_house_invoice_job_allocations IS 'Percentage allocation of supply house invoices to jobs. Used by Materials (Edit Invoice) and Jobs Parts (Invoice Amount column).';

ALTER TABLE public.supply_house_invoice_job_allocations ENABLE ROW LEVEL SECURITY;

-- RLS: same as supply_house_invoices (dev, master_technician, assistant)
CREATE POLICY "Devs, masters, assistants can read supply house invoice job allocations"
ON public.supply_house_invoice_job_allocations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);
CREATE POLICY "Devs, masters, assistants can insert supply house invoice job allocations"
ON public.supply_house_invoice_job_allocations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);
CREATE POLICY "Devs, masters, assistants can update supply house invoice job allocations"
ON public.supply_house_invoice_job_allocations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);
CREATE POLICY "Devs, masters, assistants can delete supply house invoice job allocations"
ON public.supply_house_invoice_job_allocations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- RPC: get invoice amounts per job for Jobs Parts tab (visibility same as list_tally_parts_with_po)
CREATE OR REPLACE FUNCTION public.get_invoice_amounts_for_jobs(p_job_ids uuid[])
RETURNS TABLE (job_id uuid, invoice_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    COALESCE(SUM(i.amount * a.pct / 100), 0)::numeric AS invoice_amount
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  GROUP BY a.job_id;
$$;
COMMENT ON FUNCTION public.get_invoice_amounts_for_jobs(uuid[]) IS 'Returns allocated invoice amount per job for Jobs Parts tab. Visibility matches list_tally_parts_with_po.';
