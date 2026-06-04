-- Library and signing contract body: explicit html vs plain text rendering.

ALTER TABLE public.contract_template_documents
  ADD COLUMN IF NOT EXISTS book_body_format text NOT NULL DEFAULT 'html';

ALTER TABLE public.contract_template_documents
  DROP CONSTRAINT IF EXISTS contract_template_documents_book_body_format_check;

ALTER TABLE public.contract_template_documents
  ADD CONSTRAINT contract_template_documents_book_body_format_check
  CHECK (book_body_format IN ('html', 'plain'));

COMMENT ON COLUMN public.contract_template_documents.book_body_format IS
  'Whether book_body_html is sanitized as HTML or shown as plain text (pre-wrap, escaped).';

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS signing_body_format text NOT NULL DEFAULT 'html';

ALTER TABLE public.person_contract_documents
  DROP CONSTRAINT IF EXISTS person_contract_documents_signing_body_format_check;

ALTER TABLE public.person_contract_documents
  ADD CONSTRAINT person_contract_documents_signing_body_format_check
  CHECK (signing_body_format IN ('html', 'plain'));

COMMENT ON COLUMN public.person_contract_documents.signing_body_format IS
  'Whether signing_body_html is sanitized as HTML or shown as plain text (pre-wrap, escaped).';
