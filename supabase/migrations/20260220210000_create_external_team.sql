-- Create external_team_sub_managers and external_team_job_payments tables
-- For External Team section in Materials Supply Houses & External Subs tab

-- ============================================================================
-- external_team_sub_managers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.external_team_sub_managers (
  person_id UUID PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.external_team_sub_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants can read external team sub managers"
ON public.external_team_sub_managers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can insert external team sub managers"
ON public.external_team_sub_managers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can update external team sub managers"
ON public.external_team_sub_managers
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

CREATE POLICY "Devs, masters, assistants can delete external team sub managers"
ON public.external_team_sub_managers
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

DROP TRIGGER IF EXISTS update_external_team_sub_managers_updated_at ON public.external_team_sub_managers;
CREATE TRIGGER update_external_team_sub_managers_updated_at
  BEFORE UPDATE ON public.external_team_sub_managers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.external_team_sub_managers IS 'Assigns a user as Sub Manager per subcontractor in External Team.';

-- ============================================================================
-- external_team_job_payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.external_team_job_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_team_job_payments_person_id ON public.external_team_job_payments(person_id);
CREATE INDEX IF NOT EXISTS idx_external_team_job_payments_is_paid ON public.external_team_job_payments(is_paid);

ALTER TABLE public.external_team_job_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants can read external team job payments"
ON public.external_team_job_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can insert external team job payments"
ON public.external_team_job_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can update external team job payments"
ON public.external_team_job_payments
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

CREATE POLICY "Devs, masters, assistants can delete external team job payments"
ON public.external_team_job_payments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

DROP TRIGGER IF EXISTS update_external_team_job_payments_updated_at ON public.external_team_job_payments;
CREATE TRIGGER update_external_team_job_payments_updated_at
  BEFORE UPDATE ON public.external_team_job_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.external_team_job_payments IS 'Job payments per subcontractor in External Team. Unpaid contribute to Outstanding.';
