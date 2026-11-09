SET lock_timeout = '3s';

-- One documents table for people and matters (v2.6716, punch list #288 PR 1). The owner's pick of 2026-11-08 between a
-- text column beside a matter's file and the shared table #277 named as the long-term shape: the shared table.
--
-- person_documents (20261107040000) held a person's named documents; a matter's documents were files in a bucket, their
-- words unreadable to the case search and unrenderable on the desk. This migration makes person_documents THE documents
-- table — renamed `documents`, owned by a person OR a matter — and lets a text file on a matter's Evidence tab keep its
-- words there: `legal_matter_documents.text_document_id` points at the row, the bytes stay in the bucket as before, the
-- desk and the firm's portal render the text, and dev_case_search reads it a section at a time like a named document.
--
-- Every deployed reader keeps working: the rename keeps ids, foreign keys, the archive trigger, the policies and the
-- indexes; `person_documents` and `person_document_revisions` live on as views with the old names (security_invoker, so
-- the table's own policies decide), which dev_person_doc_write, dev_doc_read, dev_doc_history and the HR panel's read by
-- id go through unchanged until a later PR moves them. person_document_index follows the rename by itself (a view binds
-- the table's OID, not its name) and now lists the matter rows too, which every caller filters out by person_id.
--
-- Idempotent: the rename runs only while person_documents is still a table; everything else is IF NOT EXISTS / OR REPLACE.
-- No table is created, so no fence is owed; the four appliers run anyway and find nothing missing.

-- 1. The rename, once.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'person_documents' AND c.relkind = 'r') THEN
    ALTER TABLE public.person_documents RENAME TO documents;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'person_document_revisions' AND c.relkind = 'r') THEN
    ALTER TABLE public.person_document_revisions RENAME TO document_revisions;
  END IF;
END $$;
ALTER INDEX IF EXISTS public.idx_person_documents_person_updated RENAME TO idx_documents_person_updated;
ALTER INDEX IF EXISTS public.idx_person_documents_fts RENAME TO idx_documents_fts;
ALTER INDEX IF EXISTS public.idx_person_document_revisions_document RENAME TO idx_document_revisions_document;

-- 2. The second owner: a matter. Exactly one of person_id and matter_id is set.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS matter_id uuid REFERENCES public.legal_matters(id) ON DELETE CASCADE;
ALTER TABLE public.documents ALTER COLUMN person_id DROP NOT NULL;
DO $$
BEGIN
  ALTER TABLE public.documents ADD CONSTRAINT documents_one_owner_check CHECK ((person_id IS NULL) <> (matter_id IS NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.documents VALIDATE CONSTRAINT documents_one_owner_check;
CREATE INDEX IF NOT EXISTS idx_documents_matter_updated ON public.documents (matter_id, updated_at DESC) WHERE matter_id IS NOT NULL;
COMMENT ON TABLE public.documents IS
  'The documents table for people and matters (v2.6716, punch list #288; person_documents until then, v2.6613 / #277): any number of titled markdown or plain-text documents, each owned by a person (person_id, the HR file''s named documents, dev-only) or by a legal matter (matter_id, a text document on the Evidence tab, the office roles). Prior versions archive by trigger into document_revisions. counsel_only marks a document kept inside the circle whole; archived_at retires one without deleting it.';
COMMENT ON COLUMN public.documents.matter_id IS 'The legal matter that owns this text document (v2.6716); legal_matter_documents.text_document_id points back at it from the Evidence row. Null on a person''s document.';

ALTER TABLE public.document_revisions ADD COLUMN IF NOT EXISTS matter_id uuid REFERENCES public.legal_matters(id) ON DELETE CASCADE;
ALTER TABLE public.document_revisions ALTER COLUMN person_id DROP NOT NULL;
COMMENT ON TABLE public.document_revisions IS
  'The prior version of every documents rewrite (v2.6716; person_document_revisions until then, v2.6613), written only by the trigger documents_archive_revision; devs read every row, the office roles a matter''s.';

-- 3. The archive trigger carries the owner, whichever it is.
CREATE OR REPLACE FUNCTION public.documents_archive_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.document_revisions
      (document_id, person_id, matter_id, title, content, counsel_only, author_label, replaced_at, replaced_by, replaced_by_label)
    VALUES
      (OLD.id, OLD.person_id, OLD.matter_id, OLD.title, OLD.content, OLD.counsel_only, OLD.author_label, now(), NEW.updated_by, NEW.author_label);
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS person_documents_archive_revision ON public.documents;
DROP TRIGGER IF EXISTS documents_archive_revision ON public.documents;
CREATE TRIGGER documents_archive_revision
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_archive_revision();
DROP FUNCTION IF EXISTS public.person_documents_archive_revision();

-- 4. The old names live on as views, so nothing deployed breaks: the HR panel reads a document by id from
-- person_documents, dev_doc_history reads person_document_revisions, dev_person_doc_write inserts and updates through
-- person_documents (a one-table view with no aggregate is updatable). security_invoker: the table's policies decide.
CREATE OR REPLACE VIEW public.person_documents
WITH (security_invoker = true) AS
  SELECT d.* FROM public.documents d WHERE d.person_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.person_documents TO authenticated;
CREATE OR REPLACE VIEW public.person_document_revisions
WITH (security_invoker = true) AS
  SELECT r.* FROM public.document_revisions r WHERE r.person_id IS NOT NULL;
GRANT SELECT ON public.person_document_revisions TO authenticated;
COMMENT ON VIEW public.person_documents IS 'The old name of documents (v2.6716): a person''s rows. Read and write documents instead.';
COMMENT ON VIEW public.person_document_revisions IS 'The old name of document_revisions (v2.6716): a person''s rows. Read document_revisions instead.';

-- 5. The office roles own a matter's documents the way they own its Evidence rows; devs keep every row through the
-- policies the rename carried over ("Devs can read / add / change person documents", is_dev()). No DELETE policy: a
-- document is archived, never deleted.
DROP POLICY IF EXISTS "Office reads matter documents" ON public.documents;
CREATE POLICY "Office reads matter documents" ON public.documents
  FOR SELECT USING (matter_id IS NOT NULL AND public.legal_office_can_read());
DROP POLICY IF EXISTS "Office adds matter documents" ON public.documents;
CREATE POLICY "Office adds matter documents" ON public.documents
  FOR INSERT WITH CHECK (matter_id IS NOT NULL AND person_id IS NULL AND public.legal_office_can_read());
DROP POLICY IF EXISTS "Office changes matter documents" ON public.documents;
CREATE POLICY "Office changes matter documents" ON public.documents
  FOR UPDATE USING (matter_id IS NOT NULL AND public.legal_office_can_read()) WITH CHECK (matter_id IS NOT NULL AND person_id IS NULL AND public.legal_office_can_read());
DROP POLICY IF EXISTS "Office reads matter document revisions" ON public.document_revisions;
CREATE POLICY "Office reads matter document revisions" ON public.document_revisions
  FOR SELECT USING (matter_id IS NOT NULL AND public.legal_office_can_read());

-- 6. An Evidence row that is a text document points at its words.
ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS text_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS legal_matter_documents_text_document_idx ON public.legal_matter_documents (text_document_id) WHERE text_document_id IS NOT NULL;
COMMENT ON COLUMN public.legal_matter_documents.text_document_id IS
  'v2.6716 (punch list #288): the documents row holding this paper''s words when it is a .md or .txt — rendered on the desk and the portal, searched by section. Null on a PDF, an image or an .eml; the bytes are in the bucket either way.';

-- 7. dev_legal_document_write (20261028010000) takes a text document: p.markdown is the file's words. The server sends the
-- same file facts (the bytes are the words, UTF-8, stored in the bucket as before) plus markdown; the dry run names the
-- text's size and sections; the write inserts the documents row first and the Evidence row pointing at it. text/markdown
-- joins the kinds the tab takes.
CREATE OR REPLACE FUNCTION public.dev_legal_document_write(p jsonb, p_dry_run boolean DEFAULT true, p_file jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_matter public.legal_matters%ROWTYPE;
  v_title text := btrim(COALESCE(p->>'title', ''));
  v_shows text := btrim(COALESCE(p->>'shows', ''));
  v_name text := btrim(COALESCE(p->>'original_name', ''));
  v_mime text := lower(btrim(COALESCE(p->>'mime', '')));
  v_size bigint := NULLIF(p->>'size_bytes', '')::bigint;
  v_sha text := lower(btrim(COALESCE(p->>'sha256', '')));
  v_state text := COALESCE(NULLIF(btrim(p->>'state'), ''), 'final');
  v_dated date := NULLIF(p->>'dated_on', '')::date;
  v_received date := NULLIF(p->>'received_on', '')::date;
  v_sent_on date := NULLIF(p->>'sent_on', '')::date;
  v_sent_how text := COALESCE(NULLIF(btrim(p->>'sent_how'), ''), '');
  v_sent_to text := btrim(COALESCE(p->>'sent_to', ''));
  -- v2.6716: a text document's words, kept in documents beside the bytes.
  v_markdown text := CASE WHEN p ? 'markdown' THEN p->>'markdown' ELSE NULL END;
  v_text_id uuid;
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_id uuid;
  v_path text;
  v_live integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_document_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_legal_document_write: matter_id is required (a legal_matters.id)';
  END IF;
  SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_legal_document_write: matter % not found', p->>'matter_id';
  END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'dev_legal_document_write: give the document a title'; END IF;
  IF v_shows = '' THEN RAISE EXCEPTION 'dev_legal_document_write: say in one line what it shows'; END IF;
  IF length(v_title) > 200 OR length(v_shows) > 1000 THEN
    RAISE EXCEPTION 'dev_legal_document_write: keep the title under 200 characters and what it shows under 1,000';
  END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'dev_legal_document_write: original_name is required (the file name)'; END IF;
  -- The same kinds the Evidence tab takes (LEGAL_DOCUMENT_MIMES in _shared/legalMatterDocuments.ts).
  IF v_mime NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'message/rfc822', 'text/plain', 'text/markdown') THEN
    RAISE EXCEPTION 'dev_legal_document_write: % is not a kind the portal takes (PDF, an image, an email as .eml, plain text or markdown)', v_mime;
  END IF;
  IF v_size IS NULL OR v_size < 1 OR v_size > 10485760 THEN
    RAISE EXCEPTION 'dev_legal_document_write: the file must be between 1 byte and 10 MB';
  END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'dev_legal_document_write: sha256 must be the file''s digest, 64 hex characters';
  END IF;
  IF v_markdown IS NOT NULL THEN
    IF jsonb_typeof(p->'markdown') <> 'string' THEN
      RAISE EXCEPTION 'dev_legal_document_write: markdown must be text';
    END IF;
    IF v_mime NOT IN ('text/plain', 'text/markdown') THEN
      RAISE EXCEPTION 'dev_legal_document_write: markdown goes with a text file (.md or .txt); a % keeps its bytes alone', v_mime;
    END IF;
    IF btrim(v_markdown) = '' THEN
      RAISE EXCEPTION 'dev_legal_document_write: a text document needs words';
    END IF;
    IF length(v_markdown) > 1000000 THEN
      RAISE EXCEPTION 'dev_legal_document_write: the text is longer than 1,000,000 characters';
    END IF;
  END IF;
  IF v_state NOT IN ('draft', 'final', 'sent', 'received') THEN
    RAISE EXCEPTION 'dev_legal_document_write: state is draft, final, sent or received';
  END IF;
  IF v_state = 'sent' THEN
    v_sent_on := COALESCE(v_sent_on, public.app_today());
    IF v_sent_how NOT IN ('email', 'certified_mail', 'mail', 'hand', 'other') THEN
      RAISE EXCEPTION 'dev_legal_document_write: a sent paper needs sent_how: email, certified_mail, mail, hand or other';
    END IF;
    IF v_sent_to = '' THEN RAISE EXCEPTION 'dev_legal_document_write: a sent paper needs sent_to, who it went to'; END IF;
  ELSE
    v_sent_on := NULL; v_sent_how := ''; v_sent_to := '';
  END IF;
  IF v_state = 'received' THEN
    v_received := COALESCE(v_received, v_dated, public.app_today());
  ELSE
    v_received := NULL;
  END IF;
  SELECT count(*) INTO v_live FROM public.legal_matter_documents WHERE matter_id = v_matter.id AND voided_at IS NULL;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'after', jsonb_build_object(
        'title', v_title, 'shows', v_shows, 'original_name', v_name, 'mime', v_mime, 'size_bytes', v_size, 'sha256', v_sha,
        'dated_on', v_dated, 'state', v_state, 'sent_on', v_sent_on, 'sent_how', v_sent_how, 'sent_to', v_sent_to, 'received_on', v_received
      ),
      -- v2.6716: a text document's words, by size and section, kept in documents and searched by section; null on a file alone.
      'text', CASE WHEN v_markdown IS NULL THEN NULL ELSE jsonb_build_object(
        'chars', length(v_markdown),
        'lines', array_length(regexp_split_to_array(v_markdown, E'\n'), 1),
        'sections', (SELECT count(*) FROM public.hr_doc_headings(v_markdown))) END,
      'documents_on_matter', v_live,
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  -- The write. The function stored the file first; p_file names it. No object in the bucket, no row.
  v_id := NULLIF(p_file->>'id', '')::uuid;
  v_path := btrim(COALESCE(p_file->>'storage_path', ''));
  IF v_id IS NULL OR v_path = '' THEN
    RAISE EXCEPTION 'dev_legal_document_write: the file must be stored first (p_file.id, p_file.storage_path)';
  END IF;
  IF v_path NOT LIKE (v_matter.id::text || '/' || v_id::text || '-%') THEN
    RAISE EXCEPTION 'dev_legal_document_write: the storage path is not under this matter''s folder';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'legal-matter-documents' AND name = v_path) THEN
    RAISE EXCEPTION 'dev_legal_document_write: % is not in the legal-matter-documents bucket', v_path;
  END IF;
  IF EXISTS (SELECT 1 FROM public.legal_matter_documents WHERE id = v_id) THEN
    RAISE EXCEPTION 'dev_legal_document_write: document % already exists', v_id;
  END IF;
  IF v_markdown IS NOT NULL THEN
    SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
    v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
    INSERT INTO public.documents (matter_id, title, content, author_label, created_by, updated_by)
    VALUES (v_matter.id, v_title, v_markdown, v_label, auth.uid(), auth.uid())
    RETURNING id INTO v_text_id;
  END IF;
  INSERT INTO public.legal_matter_documents (id, matter_id, title, shows, storage_path, mime, size_bytes, original_name, dated_on, state, received_on, sent_on, sent_how, sent_to, added_by, text_document_id)
  VALUES (v_id, v_matter.id, v_title, v_shows, v_path, v_mime, v_size, v_name, v_dated, v_state, v_received, v_sent_on, v_sent_how, v_sent_to, auth.uid(), v_text_id);
  RETURN jsonb_build_object('ok', true, 'document_id', v_id, 'matter_id', v_matter.id, 'storage_path', v_path, 'state', v_state, 'text_document_id', v_text_id);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) TO authenticated;
COMMENT ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) IS
  'The dev MCP''s wrapper for a document on a legal matter''s Evidence tab (v2.6004; text documents v2.6716): p = { matter_id, title, shows, original_name, mime, size_bytes, sha256, markdown?, dated_on?, state?, received_on?, sent_on?, sent_how?, sent_to? }. p_dry_run true names the matter and the row that would be written (and the text''s size and sections when markdown is sent); false inserts the legal_matter_documents row as the caller once the file named in p_file (id, storage_path) is in the legal-matter-documents bucket under the matter''s folder — a text document''s words go into documents first and the row points at them. Devs only.';

-- 8. dev_case_search (20261107070000): the named documents read from documents; a matter document whose words are kept is
-- searched a section at a time beside its title and what-it-shows line, with the Evidence row's id on the hit.
CREATE OR REPLACE FUNCTION public.dev_case_search(p_person_id uuid, p_q text, p_in text DEFAULT NULL, p_limit int DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_q tsquery;
  v_lim int := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_matter uuid;
  v_hits jsonb;
  v_count int;
  v_opts constant text := 'MaxWords=32, MinWords=12, StartSel=«, StopSel=», MaxFragments=1';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_case_search: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'dev_case_search: person_id is required';
  END IF;
  IF btrim(COALESCE(p_q, '')) = '' THEN
    RAISE EXCEPTION 'dev_case_search: q is required — words, "a phrase", or a word with -another left out';
  END IF;
  IF p_in IS NOT NULL AND p_in NOT IN ('entries', 'evidence', 'documents', 'summary', 'narrative', 'matter') THEN
    RAISE EXCEPTION 'dev_case_search: in must be entries, evidence, documents, summary, narrative or matter';
  END IF;
  v_q := websearch_to_tsquery('english', p_q);
  IF numnode(v_q) = 0 THEN
    RAISE EXCEPTION 'dev_case_search: nothing to search for in "%" — the words are all stop words', p_q;
  END IF;
  SELECT m.id INTO v_matter FROM public.legal_matters m WHERE m.person_id = p_person_id ORDER BY (m.closed_at IS NULL) DESC, m.created_at DESC LIMIT 1;

  WITH hits AS (
    SELECT 'entry'::text AS source, e.id::text AS id, NULL::text AS title, NULL::int AS section_n, NULL::text AS section, e.entry_date::text AS day, false AS counsel_only,
           ts_rank_cd(to_tsvector('english', e.content), v_q) AS rank,
           ts_headline('english', e.content, v_q, v_opts) AS snippet
      FROM public.person_file_entries e
     WHERE e.person_id = p_person_id AND (p_in IS NULL OR p_in = 'entries') AND to_tsvector('english', e.content) @@ v_q
    UNION ALL
    SELECT 'evidence', r.id::text, r.title, NULL, NULL, r.dated_on::text, r.counsel_only,
           ts_rank_cd(to_tsvector('english', r.title || ' ' || r.memo), v_q),
           ts_headline('english', r.title || ' — ' || r.memo, v_q, v_opts)
      FROM public.person_file_evidence r
     WHERE r.person_id = p_person_id AND (p_in IS NULL OR p_in = 'evidence') AND to_tsvector('english', r.title || ' ' || r.memo) @@ v_q
    UNION ALL
    SELECT 'document', d.id::text, d.title, s.n, s.heading, d.updated_at::date::text, d.counsel_only,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts)
      FROM public.documents d
      CROSS JOIN LATERAL public.hr_doc_sections(d.content) s
     WHERE d.person_id = p_person_id AND d.archived_at IS NULL AND (p_in IS NULL OR p_in = 'documents')
       AND to_tsvector('english', d.content) @@ v_q AND to_tsvector('english', s.body) @@ v_q
    UNION ALL
    SELECT f.kind, f.id::text, f.kind, s.n, s.heading, f.updated_at::date::text, false,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts)
      FROM public.person_files f
      CROSS JOIN LATERAL public.hr_doc_sections(f.content) s
     WHERE f.person_id = p_person_id AND (p_in IS NULL OR p_in = f.kind)
       AND to_tsvector('english', f.content) @@ v_q AND to_tsvector('english', s.body) @@ v_q
    UNION ALL
    SELECT 'matter_narrative', m.id::text, 'The narrative for the firm', s.n, s.heading, m.narrative_updated_at::date::text, false,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts)
      FROM public.legal_matters m
      CROSS JOIN LATERAL public.hr_doc_sections(COALESCE(m.narrative_md, '')) s
     WHERE m.id = v_matter AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', s.body) @@ v_q
    UNION ALL
    SELECT 'matter_entry', e.id::text, e.kind, NULL, NULL, e.occurred_on::text, false,
           ts_rank_cd(to_tsvector('english', COALESCE(e.body, '')), v_q),
           ts_headline('english', COALESCE(e.body, ''), v_q, v_opts)
      FROM public.legal_matter_entries e
     WHERE e.matter_id = v_matter AND e.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', COALESCE(e.body, '')) @@ v_q
    UNION ALL
    SELECT 'matter_document', d.id::text, d.title, NULL, NULL, d.dated_on::text, false,
           ts_rank_cd(to_tsvector('english', d.title || ' ' || d.shows), v_q),
           ts_headline('english', d.title || ' — ' || d.shows, v_q, v_opts)
      FROM public.legal_matter_documents d
     WHERE d.matter_id = v_matter AND d.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', d.title || ' ' || d.shows) @@ v_q
    UNION ALL
    -- v2.6716: a matter document kept as text, a section at a time; the hit carries the Evidence row's id and its section.
    SELECT 'matter_document', d.id::text, d.title, s.n, s.heading, d.dated_on::text, false,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts)
      FROM public.legal_matter_documents d
      JOIN public.documents t ON t.id = d.text_document_id
      CROSS JOIN LATERAL public.hr_doc_sections(t.content) s
     WHERE d.matter_id = v_matter AND d.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter')
       AND to_tsvector('english', t.content) @@ v_q AND to_tsvector('english', s.body) @@ v_q
  ),
  ranked AS (
    SELECT h.*, count(*) OVER () AS total FROM hits h ORDER BY h.rank DESC, h.day DESC NULLS LAST LIMIT v_lim
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'source', r.source, 'id', r.id, 'title', r.title, 'section_n', r.section_n, 'section', r.section,
           'day', r.day, 'counsel_only', r.counsel_only, 'rank', round(r.rank::numeric, 4), 'snippet', r.snippet) ORDER BY r.rank DESC, r.day DESC NULLS LAST), '[]'::jsonb),
         COALESCE(max(r.total), 0)
    INTO v_hits, v_count
    FROM ranked r;

  RETURN jsonb_build_object(
    'q', p_q, 'query', v_q::text, 'in', p_in, 'person_id', p_person_id, 'matter_id', v_matter,
    'count', v_count, 'shown', jsonb_array_length(v_hits), 'hits', v_hits
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_case_search(uuid, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_case_search(uuid, text, text, int) TO authenticated;

-- The house fences: nothing is created here, so each finds nothing missing on the renamed tables.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
