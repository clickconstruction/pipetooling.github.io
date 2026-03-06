-- Pay Stubs: ledger of generated pay stubs for employees
-- Same RLS as people_hours: dev, approved masters, and their assistants

CREATE TABLE IF NOT EXISTS public.pay_stubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours_total NUMERIC(10, 2) NOT NULL,
  gross_pay NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_stubs_person_period ON public.pay_stubs(person_name, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_pay_stubs_created_at ON public.pay_stubs(created_at DESC);

COMMENT ON TABLE public.pay_stubs IS 'Ledger of generated pay stubs. Same access as people_hours.';

ALTER TABLE public.pay_stubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can read pay stubs"
ON public.pay_stubs
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);

CREATE POLICY "Pay access users can insert pay stubs"
ON public.pay_stubs
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
);
