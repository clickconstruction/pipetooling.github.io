SET lock_timeout = '3s';

-- Contract Forms PR 2: a form template knows what kind of paperwork it is, so
-- the person copies it produces land under the right compliance pill without
-- anyone setting the type by hand on People → Subs. The W-9 template carries
-- doc_type 'w9'; the resolver trigger stamps it onto copies that still have
-- the default 'agreement'.
--
-- Idempotent and additive.

ALTER TABLE public.contract_form_templates
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'other'
    CHECK (doc_type IN ('agreement', 'coi', 'w9', 'license', 'other'));

COMMENT ON COLUMN public.contract_form_templates.doc_type IS
  'What the form is for compliance (matches person_contract_documents.doc_type). Copied onto person copies by contract_docs_set_form_template.';

CREATE OR REPLACE FUNCTION public.contract_docs_set_form_template()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_form uuid;
  v_doc_type text;
BEGIN
  v_form := NEW.form_template_id;
  IF v_form IS NULL AND NEW.applied_contract_template_document_id IS NOT NULL THEN
    SELECT d.form_template_id INTO v_form
    FROM public.contract_template_documents d
    WHERE d.id = NEW.applied_contract_template_document_id;
  END IF;
  IF v_form IS NULL AND btrim(COALESCE(NEW.document_name, '')) <> '' THEN
    SELECT d.form_template_id INTO v_form
    FROM public.contract_template_documents d
    JOIN public.contract_form_templates t ON t.id = d.form_template_id
    WHERE d.form_template_id IS NOT NULL
      AND lower(btrim(d.document_name)) = lower(btrim(NEW.document_name))
      AND t.status = 'published'
    ORDER BY t.published_at DESC NULLS LAST
    LIMIT 1;
  END IF;
  NEW.form_template_id := v_form;
  IF v_form IS NOT NULL AND COALESCE(NEW.doc_type, 'agreement') = 'agreement' THEN
    SELECT t.doc_type INTO v_doc_type FROM public.contract_form_templates t WHERE t.id = v_form;
    IF v_doc_type IS NOT NULL AND v_doc_type <> 'other' THEN
      NEW.doc_type := v_doc_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_form_template_on_write ON public.person_contract_documents;
CREATE TRIGGER set_form_template_on_write
  BEFORE INSERT OR UPDATE OF applied_contract_template_document_id, document_name, form_template_id ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_docs_set_form_template();
