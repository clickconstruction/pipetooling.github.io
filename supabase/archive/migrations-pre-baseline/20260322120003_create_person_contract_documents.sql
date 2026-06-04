-- Per-person document instances: URL, status, signed_at, note
-- status: unsent | sent | signed

CREATE TABLE IF NOT EXISTS public.person_contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  document_name TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'unsent' CHECK (status IN ('unsent', 'sent', 'signed')),
  signed_at DATE,
  sent_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_name, document_name)
);

CREATE INDEX IF NOT EXISTS idx_person_contract_documents_person ON public.person_contract_documents(person_name);
CREATE INDEX IF NOT EXISTS idx_person_contract_documents_status ON public.person_contract_documents(status);

COMMENT ON TABLE public.person_contract_documents IS 'Contract document instances per person: URL, status, signed_at, note. Same access as person_licenses.';

ALTER TABLE public.person_contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage person contract documents"
ON public.person_contract_documents FOR ALL
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
