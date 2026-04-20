-- Contract Book: library body + tags per template document row (shared defaults for staff).

ALTER TABLE public.contract_template_documents
  ADD COLUMN IF NOT EXISTS book_body_html TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.contract_template_documents.book_body_html IS
  'Optional org-wide default contract HTML/plain for this template document (sanitized in app).';
COMMENT ON COLUMN public.contract_template_documents.tags IS
  'Freeform labels for filtering/display in Contract Book (e.g. employment, NDA).';
