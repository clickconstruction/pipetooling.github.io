-- Optional pin: which Contract Book row defines "Applied version" for this person+document (display).
-- NULL = use latest updated_at among assigned templates' matching document_name rows (legacy behavior).

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS applied_contract_template_document_id uuid NULL
  REFERENCES public.contract_template_documents (id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.person_contract_documents.applied_contract_template_document_id IS
  'If set, Applied version uses this contract_template_documents.updated_at; otherwise max among assigned templates.';
