-- Jobs Receivables: Payer, Point Of Contact, Account Rep, Amount to Collect
-- For Receivables tab on Jobs page; assistants enter data for their master

CREATE TABLE IF NOT EXISTS public.jobs_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payer TEXT NOT NULL DEFAULT '',
  point_of_contact TEXT NOT NULL DEFAULT '',
  account_rep_name TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_receivables_master_user_id ON public.jobs_receivables(master_user_id);

ALTER TABLE public.jobs_receivables ENABLE ROW LEVEL SECURITY;

-- RLS: same visibility as jobs_ledger (dev, master, assistant; assistants_share_master)
CREATE POLICY "Devs, masters, assistants can read jobs receivables"
ON public.jobs_receivables
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

CREATE POLICY "Devs, masters, assistants can insert jobs receivables"
ON public.jobs_receivables
FOR INSERT
WITH CHECK (
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
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
  )
);

CREATE POLICY "Devs, masters, assistants can update jobs receivables"
ON public.jobs_receivables
FOR UPDATE
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can delete jobs receivables"
ON public.jobs_receivables
FOR DELETE
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

DROP TRIGGER IF EXISTS update_jobs_receivables_updated_at ON public.jobs_receivables;
CREATE TRIGGER update_jobs_receivables_updated_at
  BEFORE UPDATE ON public.jobs_receivables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.jobs_receivables IS 'Receivables from Jobs page; Payer, Point Of Contact, Account Rep, Amount to Collect.';
