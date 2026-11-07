SET lock_timeout = '3s';

-- search_case (v2.6620, punch list #278 PR 2): one full-text search across a person's case, the grep an agent has over
-- a folder. dev_case_search reads, as a dev only, the person's HR entries, the evidence records' titles and memos, the
-- named documents and the summary and narrative a SECTION at a time (hr_doc_sections splits a text at its headings, so
-- a hit names the section it sits in), and the matter standing on the person — its narrative by section, its entries'
-- words, its documents' titles and what-it-shows lines. Each hit carries the source, the id, the section, the day, a
-- headline with the match marked, and the counsel-only mark (marked, never hidden from a dev). GIN indexes over the
-- English text vectors make the prefilter cheap; the section split runs only on the documents that match. No table,
-- so no fence appliers. A matter document's body (a file in the bucket) is not searched here; its title and what it
-- shows are — the body joins when the write keeps a text column, a follow-up on the card.

-- A document split at its headings: the preamble (heading null) when words come before the first heading, then one
-- row a section — the heading, its number as hr_doc_heading_index reads it, its line, and its body (heading line included).
CREATE OR REPLACE FUNCTION public.hr_doc_sections(md text)
RETURNS TABLE(n int, heading text, line_no int, body text)
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_lines text[];
  v_total int;
  v_h record;
  v_prev_line int := 1;
  v_prev_heading text := NULL;
  v_prev_n int := NULL;
  v_started boolean := false;
BEGIN
  IF md IS NULL OR md = '' THEN
    RETURN;
  END IF;
  v_lines := regexp_split_to_array(md, E'\n');
  v_total := array_length(v_lines, 1);
  FOR v_h IN
    SELECT h.line_no, h.heading, (regexp_match(h.heading, '^\s*(?:§\s*)?(\d{1,3})(?:[.:)]|\s+[-–—]|\s)'))[1]::int AS num
      FROM public.hr_doc_headings(md) h ORDER BY h.line_no
  LOOP
    IF v_started OR v_h.line_no > 1 THEN
      n := v_prev_n;
      heading := v_prev_heading;
      line_no := v_prev_line;
      body := array_to_string(v_lines[v_prev_line : v_h.line_no - 1], E'\n');
      IF btrim(body) <> '' THEN
        RETURN NEXT;
      END IF;
    END IF;
    v_started := true;
    v_prev_line := v_h.line_no;
    v_prev_heading := v_h.heading;
    v_prev_n := v_h.num;
  END LOOP;
  n := v_prev_n;
  heading := v_prev_heading;
  line_no := v_prev_line;
  body := array_to_string(v_lines[v_prev_line : v_total], E'\n');
  IF btrim(body) <> '' THEN
    RETURN NEXT;
  END IF;
END;
$fn$;

CREATE INDEX IF NOT EXISTS idx_person_file_entries_fts ON public.person_file_entries USING gin (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_person_file_evidence_fts ON public.person_file_evidence USING gin (to_tsvector('english', title || ' ' || memo));
CREATE INDEX IF NOT EXISTS idx_person_documents_fts ON public.person_documents USING gin (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_person_files_fts ON public.person_files USING gin (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_legal_matter_entries_fts ON public.legal_matter_entries USING gin (to_tsvector('english', COALESCE(body, '')));

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
      FROM public.person_documents d
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
REVOKE EXECUTE ON FUNCTION public.hr_doc_sections(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_doc_sections(text) TO authenticated;
