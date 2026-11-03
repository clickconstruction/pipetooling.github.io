SET lock_timeout = '3s';

-- Signed hours statement (punch list #212, PR 3, v2.6411): a statement is signed as a Contract Form of its own — the
-- paper drawn with pdf-lib as the form's template, its schema recorded as drawn, one `contract_form_templates` row and
-- one `person_contract_documents` copy per statement (hours-statement-signing). Both tables type their rows with
-- `doc_type`, whose check named five kinds; the statement is a sixth, `hours_statement`, so the Form Studio can leave
-- the per-statement templates out of its list and the person's Paperwork can name the chip. Idempotent: the checks are
-- re-added with the new kind, NOT VALID then validated, as the GC portal's migrations did.

ALTER TABLE public.contract_form_templates DROP CONSTRAINT IF EXISTS contract_form_templates_doc_type_check;
ALTER TABLE public.contract_form_templates
  ADD CONSTRAINT contract_form_templates_doc_type_check
  CHECK (doc_type IN ('agreement', 'coi', 'w9', 'license', 'other', 'hours_statement')) NOT VALID;
ALTER TABLE public.contract_form_templates VALIDATE CONSTRAINT contract_form_templates_doc_type_check;

ALTER TABLE public.person_contract_documents DROP CONSTRAINT IF EXISTS person_contract_documents_doc_type_check;
ALTER TABLE public.person_contract_documents
  ADD CONSTRAINT person_contract_documents_doc_type_check
  CHECK (doc_type IN ('agreement', 'coi', 'w9', 'license', 'other', 'hours_statement')) NOT VALID;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_doc_type_check;

COMMENT ON COLUMN public.contract_form_templates.doc_type IS
  'What the form is for compliance (matches person_contract_documents.doc_type). Copied onto person copies by contract_docs_set_form_template. hours_statement (v2.6411) is a signed hours statement''s own per-statement template, left out of the Form Studio''s list.';
