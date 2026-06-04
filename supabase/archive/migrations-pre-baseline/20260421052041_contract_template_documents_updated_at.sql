-- Library row last-edited time for Contract Book entries (body, tags, URL, name, etc.)

ALTER TABLE public.contract_template_documents
  ADD COLUMN updated_at TIMESTAMPTZ;

UPDATE public.contract_template_documents
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.contract_template_documents
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DROP TRIGGER IF EXISTS update_contract_template_documents_updated_at ON public.contract_template_documents;

CREATE TRIGGER update_contract_template_documents_updated_at
  BEFORE UPDATE ON public.contract_template_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.contract_template_documents.updated_at IS
  'Contract Book / library row last change time (body, tags, canonical URL, document name, etc.).';
