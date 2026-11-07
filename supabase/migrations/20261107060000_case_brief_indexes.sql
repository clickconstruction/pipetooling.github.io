SET lock_timeout = '3s';

-- The seat reads a case the way an agent reads a folder (v2.6619, punch list #278, PR 1): get_case_brief needs the
-- section index of every document on a person's file without carrying the text through the door. Two views answer it:
-- person_document_index (20261107040000) gains a headings column, and person_file_index does the same for the summary
-- and the narrative in person_files. A heading's number is read as the app's hrDocCitations reads it (`16. …`, `§3 …`,
-- `2 — …`), null when it carries none. Both views are security_invoker: the tables' own dev-only policies decide what a
-- reader sees. No table, no function body changed.

-- The headings of one document as a jsonb list: [{ n, level, heading, line }], in order.
CREATE OR REPLACE FUNCTION public.hr_doc_heading_index(md text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
              'n', (regexp_match(h.heading, '^\s*(?:§\s*)?(\d{1,3})(?:[.:)]|\s+[-–—]|\s)'))[1]::int,
              'level', h.level, 'heading', h.heading, 'line', h.line_no) ORDER BY h.line_no)
       FROM public.hr_doc_headings(md) h),
    '[]'::jsonb);
$fn$;

CREATE OR REPLACE VIEW public.person_document_index
WITH (security_invoker = true) AS
  SELECT d.id, d.person_id, d.title, d.counsel_only, d.author_label, d.created_by, d.updated_by, d.created_at, d.updated_at, d.archived_at,
         length(d.content) AS chars,
         (SELECT count(*)::int FROM public.hr_doc_headings(d.content)) AS sections,
         public.hr_doc_heading_index(d.content) AS headings
    FROM public.person_documents d;
GRANT SELECT ON public.person_document_index TO authenticated;

CREATE OR REPLACE VIEW public.person_file_index
WITH (security_invoker = true) AS
  SELECT f.id, f.person_id, f.kind, f.author_label, f.updated_by, f.updated_at, f.covered_through,
         length(f.content) AS chars,
         (SELECT count(*)::int FROM public.hr_doc_headings(f.content)) AS sections,
         public.hr_doc_heading_index(f.content) AS headings
    FROM public.person_files f;
GRANT SELECT ON public.person_file_index TO authenticated;

REVOKE EXECUTE ON FUNCTION public.hr_doc_heading_index(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_doc_heading_index(text) TO authenticated;
