SET lock_timeout = '3s';

-- Counsel-only on a matter document (v2.6720, punch list #288 PR 2). The HR file's evidence has had a counsel-only
-- record since v2.6554 (20261106020000); a matter's documents had none, so the one document written for counsel alone —
-- the intake memo's section held with counsel — sat on the HR file where the attorney cannot read it. This gives the
-- Evidence row the mark: legal_matter_documents.counsel_only, set on filing (the desk's tick, the seat's field, the mail
-- door's to.counsel_only) and settable from the row's menu.
--
-- What it binds, stated here, in docs/ACCESS_CONTROL.md and docs/HR_FILES.md: the firm's portal still lists the document
-- to the firm's own logins — counsel is who it is for — with a lock chip, and the printed packet (a paper for a third party)
-- leaves it out; the dev seat as deployed (the X-Dev-Seat header, request_is_dev_seat()) is refused the row and, when the
-- paper is a text document, its words in documents, so a session's reads name the hold and never carry the words;
-- the agent role (hr_agent) has no policy on either table and reads nothing. THE LIMIT, as on the HR file: a dev signed in
-- as themself reads the row; the flag binds the seat, the agent and the print, it is not a second password.
--
-- Additive and idempotent; no table is created, so no fence is owed.

ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS counsel_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.legal_matter_documents.counsel_only IS
  'v2.6720 (punch list #288): for counsel alone — the firm''s portal lists it with a lock, the printed packet leaves it out, the dev seat (X-Dev-Seat) and hr_agent never read the row or its text. Set on filing or from the row''s menu.';

-- The seat as deployed: a counsel-only Evidence row is refused to it, and so are the words a text document keeps in documents.
DROP POLICY IF EXISTS legal_matter_documents_counsel_only_seat ON public.legal_matter_documents;
CREATE POLICY legal_matter_documents_counsel_only_seat ON public.legal_matter_documents
  AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (counsel_only AND public.request_is_dev_seat()));

-- Whether a text document's Evidence row is counsel-only, read past RLS so the policy on documents can ask.
CREATE OR REPLACE FUNCTION public.matter_text_document_is_counsel_only(p_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT bool_or(d.counsel_only) FROM public.legal_matter_documents d WHERE d.text_document_id = p_document_id), false)
$$;
REVOKE EXECUTE ON FUNCTION public.matter_text_document_is_counsel_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matter_text_document_is_counsel_only(uuid) TO authenticated;

DROP POLICY IF EXISTS documents_matter_counsel_only_seat ON public.documents;
CREATE POLICY documents_matter_counsel_only_seat ON public.documents
  AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (matter_id IS NOT NULL AND public.request_is_dev_seat() AND public.matter_text_document_is_counsel_only(id)));

-- How many of a matter's documents the seat is not seeing: a count, never a row, so a read can name the hold.
CREATE OR REPLACE FUNCTION public.matter_counsel_only_count(p_matter_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_dev() OR public.legal_office_can_read() THEN (SELECT count(*)::integer FROM public.legal_matter_documents d WHERE d.matter_id = p_matter_id AND d.counsel_only AND d.voided_at IS NULL) ELSE 0 END
$$;
REVOKE EXECUTE ON FUNCTION public.matter_counsel_only_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matter_counsel_only_count(uuid) TO authenticated;

-- dev_legal_document_write (20261108210000) takes counsel_only: the mark on the Evidence row, and on the documents row when the paper is text.

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
  -- v2.6720: for counsel alone — the firm's portal lists it with a lock, the print leaves it out, the seat and the agent never read it.
  v_counsel boolean := COALESCE(NULLIF(btrim(COALESCE(p->>'counsel_only', '')), '')::boolean, false);
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
        'dated_on', v_dated, 'state', v_state, 'sent_on', v_sent_on, 'sent_how', v_sent_how, 'sent_to', v_sent_to, 'received_on', v_received,
        'counsel_only', v_counsel
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
    INSERT INTO public.documents (matter_id, title, content, counsel_only, author_label, created_by, updated_by)
    VALUES (v_matter.id, v_title, v_markdown, v_counsel, v_label, auth.uid(), auth.uid())
    RETURNING id INTO v_text_id;
  END IF;
  INSERT INTO public.legal_matter_documents (id, matter_id, title, shows, storage_path, mime, size_bytes, original_name, dated_on, state, received_on, sent_on, sent_how, sent_to, added_by, text_document_id, counsel_only)
  VALUES (v_id, v_matter.id, v_title, v_shows, v_path, v_mime, v_size, v_name, v_dated, v_state, v_received, v_sent_on, v_sent_how, v_sent_to, auth.uid(), v_text_id, v_counsel);
  RETURN jsonb_build_object('ok', true, 'document_id', v_id, 'matter_id', v_matter.id, 'storage_path', v_path, 'state', v_state, 'text_document_id', v_text_id, 'counsel_only', v_counsel);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) TO authenticated;
COMMENT ON FUNCTION public.dev_legal_document_write(jsonb, boolean, jsonb) IS
  'The dev MCP''s wrapper for a document on a legal matter''s Evidence tab (v2.6004; text documents v2.6716; counsel_only v2.6720): p = { matter_id, title, shows, original_name, mime, size_bytes, sha256, markdown?, counsel_only?, dated_on?, state?, received_on?, sent_on?, sent_how?, sent_to? }. p_dry_run true names the matter and the row that would be written (and the text''s size and sections when markdown is sent); false inserts the legal_matter_documents row as the caller once the file named in p_file (id, storage_path) is in the legal-matter-documents bucket under the matter''s folder — a text document''s words go into documents first and the row points at them. Devs only.';

-- dev_case_search: the body #285's 20261108220000 left (the file source and the three trailing record columns) with #288 PR 1's
-- sectioned text-document union, a text document's bytes left out of the file hits, and the two matter_document branches and a
-- matter document's file hit marked counsel_only from the Evidence row. This stamp is the last of the three, so it is the body prod keeps.
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
  IF p_in IS NOT NULL AND p_in NOT IN ('entries', 'evidence', 'documents', 'summary', 'narrative', 'matter', 'files') THEN
    RAISE EXCEPTION 'dev_case_search: in must be entries, evidence, documents, summary, narrative, matter or files';
  END IF;
  v_q := websearch_to_tsquery('english', p_q);
  IF numnode(v_q) = 0 THEN
    RAISE EXCEPTION 'dev_case_search: nothing to search for in "%" — the words are all stop words', p_q;
  END IF;
  SELECT m.id INTO v_matter FROM public.legal_matters m WHERE m.person_id = p_person_id ORDER BY (m.closed_at IS NULL) DESC, m.created_at DESC LIMIT 1;

  WITH hits AS (
    SELECT 'entry'::text AS source, e.id::text AS id, NULL::text AS title, NULL::int AS section_n, NULL::text AS section, e.entry_date::text AS day, false AS counsel_only,
           ts_rank_cd(to_tsvector('english', e.content), v_q) AS rank,
           ts_headline('english', e.content, v_q, v_opts) AS snippet,
           NULL::text AS record_kind, NULL::text AS record_id, NULL::text AS record_title
      FROM public.person_file_entries e
     WHERE e.person_id = p_person_id AND (p_in IS NULL OR p_in = 'entries') AND to_tsvector('english', e.content) @@ v_q
    UNION ALL
    SELECT 'evidence', r.id::text, r.title, NULL, NULL, r.dated_on::text, r.counsel_only,
           ts_rank_cd(to_tsvector('english', r.title || ' ' || r.memo), v_q),
           ts_headline('english', r.title || ' — ' || r.memo, v_q, v_opts),
           NULL, NULL, NULL
      FROM public.person_file_evidence r
     WHERE r.person_id = p_person_id AND (p_in IS NULL OR p_in = 'evidence') AND to_tsvector('english', r.title || ' ' || r.memo) @@ v_q
    UNION ALL
    SELECT 'document', d.id::text, d.title, s.n, s.heading, d.updated_at::date::text, d.counsel_only,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts),
           NULL, NULL, NULL
      FROM public.documents d
      CROSS JOIN LATERAL public.hr_doc_sections(d.content) s
     WHERE d.person_id = p_person_id AND d.archived_at IS NULL AND (p_in IS NULL OR p_in = 'documents')
       AND to_tsvector('english', d.content) @@ v_q AND to_tsvector('english', s.body) @@ v_q
    UNION ALL
    SELECT f.kind, f.id::text, f.kind, s.n, s.heading, f.updated_at::date::text, false,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts),
           NULL, NULL, NULL
      FROM public.person_files f
      CROSS JOIN LATERAL public.hr_doc_sections(f.content) s
     WHERE f.person_id = p_person_id AND (p_in IS NULL OR p_in = f.kind)
       AND to_tsvector('english', f.content) @@ v_q AND to_tsvector('english', s.body) @@ v_q
    UNION ALL
    SELECT 'matter_narrative', m.id::text, 'The narrative for the firm', s.n, s.heading, m.narrative_updated_at::date::text, false,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts),
           NULL, NULL, NULL
      FROM public.legal_matters m
      CROSS JOIN LATERAL public.hr_doc_sections(COALESCE(m.narrative_md, '')) s
     WHERE m.id = v_matter AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', s.body) @@ v_q
    UNION ALL
    SELECT 'matter_entry', e.id::text, e.kind, NULL, NULL, e.occurred_on::text, false,
           ts_rank_cd(to_tsvector('english', COALESCE(e.body, '')), v_q),
           ts_headline('english', COALESCE(e.body, ''), v_q, v_opts),
           NULL, NULL, NULL
      FROM public.legal_matter_entries e
     WHERE e.matter_id = v_matter AND e.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', COALESCE(e.body, '')) @@ v_q
    UNION ALL
    SELECT 'matter_document', d.id::text, d.title, NULL, NULL, d.dated_on::text, d.counsel_only,
           ts_rank_cd(to_tsvector('english', d.title || ' ' || d.shows), v_q),
           ts_headline('english', d.title || ' — ' || d.shows, v_q, v_opts),
           NULL, NULL, NULL
      FROM public.legal_matter_documents d
     WHERE d.matter_id = v_matter AND d.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', d.title || ' ' || d.shows) @@ v_q
    UNION ALL
    -- v2.6716 (#288 PR 1): a matter document kept as text, a section at a time; the hit carries the Evidence row's id and its section.
    -- v2.6720 (#288 PR 2): marked counsel-only when the row is, never hidden from the dev who calls.
    SELECT 'matter_document', d.id::text, d.title, s.n, s.heading, d.dated_on::text, d.counsel_only,
           ts_rank_cd(to_tsvector('english', s.body), v_q),
           ts_headline('english', s.body, v_q, v_opts),
           NULL, NULL, NULL
      FROM public.legal_matter_documents d
      JOIN public.documents t ON t.id = d.text_document_id
      CROSS JOIN LATERAL public.hr_doc_sections(t.content) s
     WHERE d.matter_id = v_matter AND d.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter')
       AND to_tsvector('english', t.content) @@ v_q AND to_tsvector('english', s.body) @@ v_q
    UNION ALL
    -- The files (#285, PR 2): every file_index row the index read on this person's records or their matter's documents.
    -- The record a file hangs on is joined so the hit can name it; a row whose record is gone (an attachment removed,
    -- a document voided) is left out until the sweep drops it.
    SELECT 'file', f.drive_file_id, f.name, NULL, NULL,
           COALESCE(e.dated_on, en.entry_date, d.dated_on, f.modified_at::date)::text, (f.counsel_only OR COALESCE(d.counsel_only, false)),
           ts_rank_cd(to_tsvector('english', coalesce(f.text, '')), v_q),
           ts_headline('english', f.text, v_q, v_opts),
           CASE WHEN f.source = 'matter_document' THEN 'matter_document' WHEN a.evidence_id IS NOT NULL THEN 'evidence' WHEN a.entry_id IS NOT NULL THEN 'entry' ELSE 'file' END,
           COALESCE(a.evidence_id, a.entry_id, d.id, f.source_id)::text,
           COALESCE(e.title, d.title)
      FROM public.file_index f
      LEFT JOIN public.person_file_attachments a ON f.source = 'hr_attachment' AND a.id = f.source_id
      LEFT JOIN public.person_file_evidence e ON e.id = a.evidence_id
      LEFT JOIN public.person_file_entries en ON en.id = a.entry_id
      LEFT JOIN public.legal_matter_documents d ON f.source = 'matter_document' AND d.id = f.source_id AND d.voided_at IS NULL
     WHERE f.source <> 'drive' AND f.text IS NOT NULL
       AND (f.person_id = p_person_id OR (v_matter IS NOT NULL AND f.matter_id = v_matter))
       AND (f.source <> 'hr_attachment' OR a.id IS NOT NULL)
       AND (f.source <> 'matter_document' OR d.id IS NOT NULL)
       -- a .md or .txt kept as text is searched by section above, not twice through its bytes (#288)
       AND (f.source <> 'matter_document' OR d.text_document_id IS NULL)
       AND (p_in IS NULL OR p_in = 'files')
       AND to_tsvector('english', coalesce(f.text, '')) @@ v_q
  ),
  ranked AS (
    SELECT h.*, count(*) OVER () AS total FROM hits h ORDER BY h.rank DESC, h.day DESC NULLS LAST LIMIT v_lim
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'source', r.source, 'id', r.id, 'title', r.title, 'section_n', r.section_n, 'section', r.section,
           'day', r.day, 'counsel_only', r.counsel_only, 'rank', round(r.rank::numeric, 4), 'snippet', r.snippet,
           'record_kind', r.record_kind, 'record_id', r.record_id, 'record_title', r.record_title) ORDER BY r.rank DESC, r.day DESC NULLS LAST), '[]'::jsonb),
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
