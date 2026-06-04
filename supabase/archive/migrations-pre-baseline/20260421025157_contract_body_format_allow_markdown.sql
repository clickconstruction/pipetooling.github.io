-- Allow markdown as a third contract body format (library + signing).

ALTER TABLE public.contract_template_documents
  DROP CONSTRAINT IF EXISTS contract_template_documents_book_body_format_check;

ALTER TABLE public.contract_template_documents
  ADD CONSTRAINT contract_template_documents_book_body_format_check
  CHECK (book_body_format IN ('html', 'plain', 'markdown'));

COMMENT ON COLUMN public.contract_template_documents.book_body_format IS
  'Whether book_body_html is sanitized as HTML, shown as plain text, or rendered as Markdown (then sanitized).';

ALTER TABLE public.person_contract_documents
  DROP CONSTRAINT IF EXISTS person_contract_documents_signing_body_format_check;

ALTER TABLE public.person_contract_documents
  ADD CONSTRAINT person_contract_documents_signing_body_format_check
  CHECK (signing_body_format IN ('html', 'plain', 'markdown'));

COMMENT ON COLUMN public.person_contract_documents.signing_body_format IS
  'Whether signing_body_html is sanitized as HTML, shown as plain text, or rendered as Markdown (then sanitized).';
