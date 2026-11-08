SET lock_timeout = '3s';

-- The case search reaches the text of a linked file (punch list #285, PR 2, v2.6719). dev_case_search (20261107070000,
-- v2.6620) read the entries, the evidence titles and memos, the documents by section and the matter's words; the files a
-- record holds — a transcript linked from Drive, a .eml, a text PDF on the matter's Evidence tab — it never read. PR 1
-- (20261108200000) gave file_index a row for every such file with its text; this adds the `file` source to the union: a
-- hit names the record the file hangs on (record_kind: evidence, entry, file or matter_document; record_id; record_title),
-- the file's name as its title, the record's day, the row's counsel-only mark (marked, never hidden from a dev, as every
-- source here is) and a headline from the text. `in: 'files'` narrows to it. Every branch gains the three record columns
-- (null off a file hit), so a sibling branch (#288's sectioned matter-document text) carries them the same way.
-- A GIN over the text of the record rows alone makes the prefilter cheap; Find a file's `search` vector weights the name
-- and the path, which a case search should not rank by. No table, so no fence appliers.
-- This stamp follows #288's 20261108210000 (v2.6716: one `documents` table for people and matters, and
-- legal_matter_documents.text_document_id for a .md/.txt kept as text), which replaces dev_case_search too; migrations
-- apply by stamp, so this body is the final one and carries #288's sectioned matter-document union, and the file union
-- leaves a text document's bytes out so one line is not found twice. PUSH THIS ONLY ONCE 20261108210000 IS ON MAIN: a
-- plpgsql body compiles without its tables, and the function would fail at every call until the column exists.
-- See docs/migrations/20261108220000_case_search_files.md.

CREATE INDEX IF NOT EXISTS file_index_record_text_fts ON public.file_index USING gin (to_tsvector('english', coalesce(text, ''))) WHERE source <> 'drive';

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
      FROM public.person_documents d
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
    SELECT 'matter_document', d.id::text, d.title, NULL, NULL, d.dated_on::text, false,
           ts_rank_cd(to_tsvector('english', d.title || ' ' || d.shows), v_q),
           ts_headline('english', d.title || ' — ' || d.shows, v_q, v_opts),
           NULL, NULL, NULL
      FROM public.legal_matter_documents d
     WHERE d.matter_id = v_matter AND d.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', d.title || ' ' || d.shows) @@ v_q
    UNION ALL
    -- v2.6716 (#288): a matter document kept as text, a section at a time; the hit carries the Evidence row's id and its section.
    SELECT 'matter_document', d.id::text, d.title, s.n, s.heading, d.dated_on::text, false,
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
           COALESCE(e.dated_on, en.entry_date, d.dated_on, f.modified_at::date)::text, f.counsel_only,
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
       -- A .md/.txt kept as text (#288) is read by section above; its bytes are not a second hit.
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
