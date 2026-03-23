-- Contract templates: named groups of documents (Farm Work, Master Plumber, etc.)
-- Same RLS as person_licenses

CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_sequence ON public.contract_templates(sequence_order);

COMMENT ON TABLE public.contract_templates IS 'Templates for contract document checklists (Farm Work, Government Projects, etc.). Same access as person_licenses.';

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage contract templates"
ON public.contract_templates FOR ALL
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
