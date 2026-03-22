-- Cost line items per license (amount, note, date). Sum = total cost to company.
-- Same RLS as person_licenses

CREATE TABLE IF NOT EXISTS public.person_license_cost_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_license_id UUID NOT NULL REFERENCES public.person_licenses(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  note TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_license_cost_lines_license_id ON public.person_license_cost_lines(person_license_id);

COMMENT ON TABLE public.person_license_cost_lines IS 'Cost line items per license (amount, note, date). Sum = total cost to company.';

ALTER TABLE public.person_license_cost_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage person license cost lines"
ON public.person_license_cost_lines FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
