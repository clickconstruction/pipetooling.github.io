-- Document names within each contract template

CREATE TABLE IF NOT EXISTS public.contract_template_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_template_documents_template ON public.contract_template_documents(template_id);

COMMENT ON TABLE public.contract_template_documents IS 'Document names per contract template. Same access as person_licenses.';

ALTER TABLE public.contract_template_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage contract template documents"
ON public.contract_template_documents FOR ALL
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
