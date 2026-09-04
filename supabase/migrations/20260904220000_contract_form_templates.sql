SET lock_timeout = '3s';

-- Contract Forms PR 1 (v2.2788): a Contract Book entry can be a FORM — an
-- uploaded PDF plus the entry boxes a dev placed on it in the Form Studio. The
-- signer fills the real page (a W-9 first); the answers land in the PDF's own
-- fields or at drawn coordinates, the result is flattened and filed privately,
-- and only non-sensitive answers are kept on the person row.
--
--   contract_form_templates          — the uploaded PDF + the boxes (schema jsonb)
--   contract_template_documents      + form_template_id (a Book entry that is a form)
--   person_contract_documents        + form_template_id, form_values, form_hints,
--                                      form_pdf_storage_path, form_source
--   contract_form_pdf_opens          — who opened which signed form PDF, when
--
-- Storage buckets `contract-form-templates` and `contract-form-pdfs` (both
-- private) and their storage.objects policies are created OUT-OF-BAND, matching
-- every other bucket in this project (storage schema objects are not tracked by
-- this ledger). Exact SQL: docs/CONTRACT_FORMS.md § "Storage".
--
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.contract_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- e.g. "Rev. March 2024" — the issuing agency's revision, shown on the entry.
  revision_label text NOT NULL DEFAULT '',
  -- object path inside the private 'contract-form-templates' bucket: <id>/template.pdf
  pdf_storage_path text NOT NULL,
  pdf_sha256 text,
  page_count integer NOT NULL DEFAULT 1 CHECK (page_count >= 1),
  -- FormSchema (supabase/functions/_shared/formSchema.ts): pages, boxes, groups, oneOfs.
  schema jsonb NOT NULL DEFAULT '{"version":1,"pages":[],"boxes":[],"groups":[],"oneOfs":[]}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  superseded_by_id uuid REFERENCES public.contract_form_templates(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

COMMENT ON TABLE public.contract_form_templates IS
  'Contract Forms (v2.2788): an uploaded PDF plus the entry boxes a dev placed on it (schema jsonb, FormSchema). A Book entry points at one via contract_template_documents.form_template_id; the signer fills the real page. Dev-only writes; office reads.';
COMMENT ON COLUMN public.contract_form_templates.schema IS
  'FormSchema v1: pages [{width,height}], boxes [{key,type,page,rect,order,label,…,bind,mask,sensitive}], groups, oneOfs. Sensitive boxes are never stored on the person row.';

CREATE INDEX IF NOT EXISTS idx_contract_form_templates_status ON public.contract_form_templates (status, updated_at DESC);

DROP TRIGGER IF EXISTS update_contract_form_templates_updated_at ON public.contract_form_templates;
CREATE TRIGGER update_contract_form_templates_updated_at BEFORE UPDATE ON public.contract_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contract_form_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office reads contract form templates" ON public.contract_form_templates;
CREATE POLICY "Office reads contract form templates" ON public.contract_form_templates
  FOR SELECT USING (public.is_dev() OR public.is_master_or_dev() OR public.is_assistant() OR public.is_controller());
DROP POLICY IF EXISTS "Devs insert contract form templates" ON public.contract_form_templates;
CREATE POLICY "Devs insert contract form templates" ON public.contract_form_templates
  FOR INSERT WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs update contract form templates" ON public.contract_form_templates;
CREATE POLICY "Devs update contract form templates" ON public.contract_form_templates
  FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs delete contract form templates" ON public.contract_form_templates;
CREATE POLICY "Devs delete contract form templates" ON public.contract_form_templates
  FOR DELETE USING (public.is_dev());

-- A Book entry that is a form.
ALTER TABLE public.contract_template_documents
  ADD COLUMN IF NOT EXISTS form_template_id uuid REFERENCES public.contract_form_templates(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.contract_template_documents.form_template_id IS
  'Set = this Book entry is a form (Contract Forms v2.2788): the signer fills the template''s PDF instead of reading book_body_html.';
CREATE INDEX IF NOT EXISTS idx_contract_template_documents_form_template
  ON public.contract_template_documents (form_template_id) WHERE form_template_id IS NOT NULL;

-- The person copy: which form, what they answered (non-sensitive), the last four
-- of each sensitive answer, where the flattened PDF lives, and how it arrived.
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS form_template_id uuid REFERENCES public.contract_form_templates(id) ON DELETE SET NULL;
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS form_values jsonb;
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS form_hints jsonb;
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS form_pdf_storage_path text;
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS form_source text CHECK (form_source IN ('portal', 'paper'));

COMMENT ON COLUMN public.person_contract_documents.form_values IS
  'Contract Forms: the signer''s non-sensitive answers keyed by box key. Sensitive boxes are absent here by construction (splitFormValuesForStorage).';
COMMENT ON COLUMN public.person_contract_documents.form_hints IS
  'Contract Forms: last four characters of each sensitive answer, keyed by box key — enough to match a form to a 1099 without opening it.';
COMMENT ON COLUMN public.person_contract_documents.form_pdf_storage_path IS
  'Contract Forms: object path of the flattened, signed PDF inside the private ''contract-form-pdfs'' bucket. The full sensitive answers exist only here.';
COMMENT ON COLUMN public.person_contract_documents.form_source IS
  'Contract Forms: portal = the signer filled it; paper = staff keyed a paper copy in.';

-- Person copies are created client-side in several places (packets, quick send,
-- Add document). Rather than teach each path about forms, resolve the form from
-- the applied Book entry (or, for older copies, a Book entry of the same name)
-- on write — the same shape as contract_docs_set_person_id.
CREATE OR REPLACE FUNCTION public.contract_docs_set_form_template()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_form uuid;
BEGIN
  IF NEW.form_template_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.applied_contract_template_document_id IS NOT NULL THEN
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_form_template_on_write ON public.person_contract_documents;
CREATE TRIGGER set_form_template_on_write
  BEFORE INSERT OR UPDATE OF applied_contract_template_document_id, document_name ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_docs_set_form_template();

-- Who opened a signed form PDF. Rows are written by the open-contract-form-pdf
-- function (service role); devs read them.
CREATE TABLE IF NOT EXISTS public.contract_form_pdf_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_contract_document_id uuid NOT NULL REFERENCES public.person_contract_documents(id) ON DELETE CASCADE,
  opened_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.contract_form_pdf_opens IS
  'Contract Forms: one row per time a staff member opened a signed form PDF (holds the sensitive answers). Written by the edge function; devs read.';
CREATE INDEX IF NOT EXISTS idx_contract_form_pdf_opens_doc ON public.contract_form_pdf_opens (person_contract_document_id, opened_at DESC);

ALTER TABLE public.contract_form_pdf_opens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Devs read contract form pdf opens" ON public.contract_form_pdf_opens;
CREATE POLICY "Devs read contract form pdf opens" ON public.contract_form_pdf_opens
  FOR SELECT USING (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
