SET lock_timeout = '3s';

-- The case search finds a quoted phrase wherever it sits in a long text (dev_case_search, the seat's search_case).
--
-- What was wrong. A tsvector keeps a word's position only up to 16,383 (every later word is filed at 16,383) and keeps
-- 255 positions a word, so a phrase test (`'a' <-> 'b'`) over a long text can never match past either mark. The
-- sectioned branches tested the query twice: `to_tsvector(d.content) @@ v_q AND to_tsvector(s.body) @@ v_q`. The first
-- test ran the PHRASE over the whole document, so a document whose phrase sat past its 16,383rd word was thrown out
-- before its sections were read, while the same words unquoted were found everywhere. The whole-text branches (a
-- file's text, an entry) had one test with the same cap, and a word used more than 255 times in one section hid every
-- phrase after its 255th use.
--
-- What this does. Each branch keeps its cheap GIN test, now on fts_prefilter(v_q) — the same words with every phrase
-- operator read as AND and everything left out read as true, a query the index answers for certain and which never
-- refuses a text the query matches — and takes its match, rank and snippet from fts_hit, which tests each phrase on the
-- text 200 words at a time, where no cap can bite. So a left-out word (-word) now leaves out the section, entry or file
-- that holds it, never a whole document for one use of the word somewhere in it. The snippet shows the phrase itself:
-- ts_headline starts at the first use of any of the phrase's words and shows 32 words from there, so a phrase whose
-- first word was used earlier in the text had a snippet that never reached it.
--
-- No table, so no fence appliers. Idempotent (CREATE OR REPLACE). The six GIN indexes are untouched.
-- See docs/migrations/20261111180000_case_search_phrases.md.

-- A parsed query cut into the pieces it prints: each word (quoted, with its flags), each phrase operator, & | ! ( ).
CREATE OR REPLACE FUNCTION public.fts_query_tokens(p_q tsquery)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT COALESCE(array_agg(t.m[1] ORDER BY t.ord), '{}')
    FROM regexp_matches(p_q::text, $re$('(?:[^'\\]|''|\\.)*'(?::[*A-D]+)?|<->|<\d+>|[&|!()])$re$, 'g') WITH ORDINALITY AS t(m, ord)
$fn$;

-- The query a GIN index answers for certain: the same words, every phrase operator read as AND, and everything left
-- out (-word, -"a phrase") read as true — `!'zz never'`, a word with a space in it, which no text can hold. It never
-- refuses a text the query itself matches, so it only narrows; fts_hit decides.
CREATE OR REPLACE FUNCTION public.fts_prefilter(p_q tsquery)
RETURNS tsquery
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  c_true constant text := $s$!'zz never'$s$;
  v_tok text[];
  v_out text := '';
  v_n int;
  v_depth int;
  i int := 1;
BEGIN
  IF p_q IS NULL OR numnode(p_q) = 0 THEN
    RETURN p_q;
  END IF;
  v_tok := public.fts_query_tokens(p_q);
  v_n := cardinality(v_tok);
  WHILE i <= v_n LOOP
    IF v_tok[i] = '!' AND i < v_n THEN
      -- what is left out cannot narrow a superset: the word, or the whole group in brackets, reads as true
      IF v_tok[i + 1] = '(' THEN
        v_depth := 0;
        i := i + 1;
        LOOP
          IF v_tok[i] = '(' THEN v_depth := v_depth + 1; ELSIF v_tok[i] = ')' THEN v_depth := v_depth - 1; END IF;
          i := i + 1;
          EXIT WHEN v_depth = 0 OR i > v_n;
        END LOOP;
      ELSE
        i := i + 2;
      END IF;
      v_out := v_out || ' ' || c_true;
    ELSIF left(v_tok[i], 1) = '<' THEN
      v_out := v_out || ' &';
      i := i + 1;
    ELSE
      v_out := v_out || ' ' || v_tok[i];
      i := i + 1;
    END IF;
  END LOOP;
  RETURN v_out::tsquery;
EXCEPTION WHEN OTHERS THEN
  -- a shape this does not read: the index narrows nothing and fts_hit decides alone
  RETURN c_true::tsquery;
END;
$fn$;

-- A text cut into windows of p_words words, a new one starting every p_step words, in the order they start: any run
-- of up to p_words - p_step + 1 words is whole in one of them.
CREATE OR REPLACE FUNCTION public.fts_windows(p_text text, p_words int, p_step int)
RETURNS TABLE(n int, body text)
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT (row_number() OVER (ORDER BY min(t.ord), p.shift))::int, string_agg(t.tok, ' ' ORDER BY t.ord)
    FROM regexp_split_to_table(p_text, '\s+') WITH ORDINALITY AS t(tok, ord),
         generate_series(0, p_words - 1, p_step) AS p(shift)
   GROUP BY p.shift, (t.ord - 1 + p.shift) / p_words
$fn$;

-- One text against a query: no row when the text does not match, else its rank and its snippet.
--
-- A query with no phrase is the plain test. With a phrase, each plain run of words (`'a' <-> 'b' <2> 'c'`) is looked
-- for in the text 200 words at a time — a new window every 100 words, so a phrase of up to 100 words is whole in one,
-- and a window is too short for either cap — and only in a text that holds all of the run's words. The run
-- is then read as true or false and the rest of the query (other words, or, what is left out) is tested on the whole
-- text, where positions do not matter. A phrase that is not a plain run (a group or a left-out word inside it, which
-- websearch_to_tsquery does not write) falls back to the plain test.
--
-- The rank is ts_rank_cd over the whole text, or, when that is 0 because the phrase sits past a cap, the phrase's rank
-- in its window. The snippet is ts_headline over the whole text when that shows the first phrase found; when it does
-- not (the phrase sits past the 16,383rd word, or one of its words was used earlier), it is the 32 words around the
-- phrase, with the phrase marked.
CREATE OR REPLACE FUNCTION public.fts_hit(p_text text, p_q tsquery, p_headline_options text)
RETURNS TABLE(rank real, snippet text)
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  c_true constant text := $s$!'zz never'$s$;
  c_false constant text := $s$'zz never'$s$;
  v_vec tsvector;
  v_tok text[];
  v_n int;
  v_out text := '';
  v_chain text;
  v_words text;
  v_wvec tsvector[];
  v_wtext text[];
  v_passage text;
  v_at int;
  v_first_at int;
  v_first_chain tsquery;
  v_plain boolean := false;
  i int := 1;
  j int;
BEGIN
  IF p_text IS NULL OR p_q IS NULL THEN
    RETURN;
  END IF;
  v_vec := to_tsvector('english', p_text);
  IF p_q::text ~ '<' THEN
    v_tok := public.fts_query_tokens(p_q);
    v_n := cardinality(v_tok);
    WHILE i <= v_n LOOP
      IF left(v_tok[i], 1) = '''' AND i < v_n AND left(v_tok[i + 1], 1) = '<' AND (i = 1 OR v_tok[i - 1] <> '!') THEN
        v_chain := v_tok[i];
        v_words := v_tok[i];
        j := i;
        WHILE j + 2 <= v_n AND left(v_tok[j + 1], 1) = '<' AND left(v_tok[j + 2], 1) = '''' LOOP
          v_chain := v_chain || ' ' || v_tok[j + 1] || ' ' || v_tok[j + 2];
          v_words := v_words || ' & ' || v_tok[j + 2];
          j := j + 2;
        END LOOP;
        v_at := NULL;
        IF v_vec @@ v_words::tsquery THEN
          IF v_wvec IS NULL THEN
            SELECT COALESCE(array_agg(to_tsvector('english', w.body) ORDER BY w.n), '{}'), COALESCE(array_agg(w.body ORDER BY w.n), '{}')
              INTO v_wvec, v_wtext
              FROM public.fts_windows(p_text, 200, 100) w;
          END IF;
          SELECT u.ord INTO v_at FROM unnest(v_wvec) WITH ORDINALITY AS u(vec, ord) WHERE u.vec @@ v_chain::tsquery ORDER BY u.ord LIMIT 1;
          IF v_at IS NOT NULL AND v_first_at IS NULL THEN
            v_first_at := v_at;
            v_first_chain := v_chain::tsquery;
          END IF;
        END IF;
        v_out := v_out || ' ' || CASE WHEN v_at IS NOT NULL THEN c_true ELSE c_false END;
        i := j + 1;
      ELSE
        IF left(v_tok[i], 1) = '<' THEN
          v_plain := true;
        END IF;
        v_out := v_out || ' ' || v_tok[i];
        i := i + 1;
      END IF;
    END LOOP;
  ELSE
    v_plain := true;
  END IF;

  IF v_plain THEN
    IF NOT (v_vec @@ p_q) THEN
      RETURN;
    END IF;
    rank := ts_rank_cd(v_vec, p_q);
    snippet := ts_headline('english', p_text, p_q, p_headline_options);
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT (v_vec @@ v_out::tsquery) THEN
    RETURN;
  END IF;
  rank := ts_rank_cd(v_vec, p_q);
  IF rank = 0 AND v_first_at IS NOT NULL THEN
    rank := ts_rank_cd(v_wvec[v_first_at], v_first_chain);
  END IF;
  snippet := ts_headline('english', p_text, p_q, p_headline_options);
  IF v_first_at IS NOT NULL AND NOT (to_tsvector('english', snippet) @@ v_first_chain) THEN
    -- the 32 words around the phrase: of the windows that hold it, a new one every 8 words, the middle one
    SELECT m.body INTO v_passage
      FROM (SELECT w.body, row_number() OVER (ORDER BY w.n) AS k, count(*) OVER () AS c
              FROM public.fts_windows(v_wtext[v_first_at], 32, 8) w WHERE to_tsvector('english', w.body) @@ v_first_chain) m
     WHERE m.k = (m.c + 1) / 2;
    snippet := ts_headline('english', COALESCE(v_passage, v_wtext[v_first_at]), v_first_chain, p_headline_options);
  END IF;
  RETURN NEXT;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.fts_query_tokens(tsquery) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fts_query_tokens(tsquery) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fts_windows(text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fts_windows(text, int, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fts_prefilter(tsquery) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fts_prefilter(tsquery) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fts_hit(text, tsquery, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fts_hit(text, tsquery, text) TO authenticated;
COMMENT ON FUNCTION public.fts_prefilter(tsquery) IS
  'The query a GIN index answers for certain (v2.6938): the same words, every phrase operator read as AND, everything left out read as true. Never refuses a text the query matches; fts_hit decides.';
COMMENT ON FUNCTION public.fts_hit(text, tsquery, text) IS
  'One text against a query (v2.6938): no row when it does not match, else its rank and snippet. A phrase is tested on the text 200 words at a time, so it is found past a tsvector''s caps (position 16,383, 255 positions a word).';

-- dev_case_search: 20261108230000's body with each branch's test changed and nothing else — the index test on v_pre
-- (fts_prefilter), the match, rank and snippet from fts_hit. Sources, columns, gate, order and the reply are as they were.
CREATE OR REPLACE FUNCTION public.dev_case_search(p_person_id uuid, p_q text, p_in text DEFAULT NULL, p_limit int DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_q tsquery;
  v_pre tsquery;
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
  -- What the GIN indexes are asked: the words, never the phrase (a tsvector's positions stop at 16,383).
  v_pre := public.fts_prefilter(v_q);
  SELECT m.id INTO v_matter FROM public.legal_matters m WHERE m.person_id = p_person_id ORDER BY (m.closed_at IS NULL) DESC, m.created_at DESC LIMIT 1;

  WITH hits AS (
    SELECT 'entry'::text AS source, e.id::text AS id, NULL::text AS title, NULL::int AS section_n, NULL::text AS section, e.entry_date::text AS day, false AS counsel_only,
           h.rank AS rank,
           h.snippet AS snippet,
           NULL::text AS record_kind, NULL::text AS record_id, NULL::text AS record_title
      FROM public.person_file_entries e
      CROSS JOIN LATERAL public.fts_hit(e.content, v_q, v_opts) h
     WHERE e.person_id = p_person_id AND (p_in IS NULL OR p_in = 'entries') AND to_tsvector('english', e.content) @@ v_pre
    UNION ALL
    SELECT 'evidence', r.id::text, r.title, NULL, NULL, r.dated_on::text, r.counsel_only,
           h.rank,
           h.snippet,
           NULL, NULL, NULL
      FROM public.person_file_evidence r
      CROSS JOIN LATERAL public.fts_hit(r.title || ' — ' || r.memo, v_q, v_opts) h
     WHERE r.person_id = p_person_id AND (p_in IS NULL OR p_in = 'evidence') AND to_tsvector('english', r.title || ' ' || r.memo) @@ v_pre
    UNION ALL
    SELECT 'document', d.id::text, d.title, s.n, s.heading, d.updated_at::date::text, d.counsel_only,
           h.rank,
           h.snippet,
           NULL, NULL, NULL
      FROM public.documents d
      CROSS JOIN LATERAL public.hr_doc_sections(d.content) s
      CROSS JOIN LATERAL public.fts_hit(s.body, v_q, v_opts) h
     WHERE d.person_id = p_person_id AND d.archived_at IS NULL AND (p_in IS NULL OR p_in = 'documents')
       AND to_tsvector('english', d.content) @@ v_pre
    UNION ALL
    SELECT f.kind, f.id::text, f.kind, s.n, s.heading, f.updated_at::date::text, false,
           h.rank,
           h.snippet,
           NULL, NULL, NULL
      FROM public.person_files f
      CROSS JOIN LATERAL public.hr_doc_sections(f.content) s
      CROSS JOIN LATERAL public.fts_hit(s.body, v_q, v_opts) h
     WHERE f.person_id = p_person_id AND (p_in IS NULL OR p_in = f.kind)
       AND to_tsvector('english', f.content) @@ v_pre
    UNION ALL
    SELECT 'matter_narrative', m.id::text, 'The narrative for the firm', s.n, s.heading, m.narrative_updated_at::date::text, false,
           h.rank,
           h.snippet,
           NULL, NULL, NULL
      FROM public.legal_matters m
      CROSS JOIN LATERAL public.hr_doc_sections(COALESCE(m.narrative_md, '')) s
      CROSS JOIN LATERAL public.fts_hit(s.body, v_q, v_opts) h
     WHERE m.id = v_matter AND (p_in IS NULL OR p_in = 'matter')
    UNION ALL
    SELECT 'matter_entry', e.id::text, e.kind, NULL, NULL, e.occurred_on::text, false,
           h.rank,
           h.snippet,
           NULL, NULL, NULL
      FROM public.legal_matter_entries e
      CROSS JOIN LATERAL public.fts_hit(COALESCE(e.body, ''), v_q, v_opts) h
     WHERE e.matter_id = v_matter AND e.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter') AND to_tsvector('english', COALESCE(e.body, '')) @@ v_pre
    UNION ALL
    SELECT 'matter_document', d.id::text, d.title, NULL, NULL, d.dated_on::text, d.counsel_only,
           h.rank,
           h.snippet,
           NULL, NULL, NULL
      FROM public.legal_matter_documents d
      CROSS JOIN LATERAL public.fts_hit(d.title || ' — ' || d.shows, v_q, v_opts) h
     WHERE d.matter_id = v_matter AND d.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter')
    UNION ALL
    -- v2.6716 (#288 PR 1): a matter document kept as text, a section at a time; the hit carries the Evidence row's id and its section.
    -- v2.6720 (#288 PR 2): marked counsel-only when the row is, never hidden from the dev who calls.
    SELECT 'matter_document', d.id::text, d.title, s.n, s.heading, d.dated_on::text, d.counsel_only,
           h.rank,
           h.snippet,
           NULL, NULL, NULL
      FROM public.legal_matter_documents d
      JOIN public.documents t ON t.id = d.text_document_id
      CROSS JOIN LATERAL public.hr_doc_sections(t.content) s
      CROSS JOIN LATERAL public.fts_hit(s.body, v_q, v_opts) h
     WHERE d.matter_id = v_matter AND d.voided_at IS NULL AND (p_in IS NULL OR p_in = 'matter')
       AND to_tsvector('english', t.content) @@ v_pre
    UNION ALL
    -- The files (#285, PR 2): every file_index row the index read on this person's records or their matter's documents.
    -- The record a file hangs on is joined so the hit can name it; a row whose record is gone (an attachment removed,
    -- a document voided) is left out until the sweep drops it.
    SELECT 'file', f.drive_file_id, f.name, NULL, NULL,
           COALESCE(e.dated_on, en.entry_date, d.dated_on, f.modified_at::date)::text, (f.counsel_only OR COALESCE(d.counsel_only, false)),
           h.rank,
           h.snippet,
           CASE WHEN f.source = 'matter_document' THEN 'matter_document' WHEN a.evidence_id IS NOT NULL THEN 'evidence' WHEN a.entry_id IS NOT NULL THEN 'entry' ELSE 'file' END,
           COALESCE(a.evidence_id, a.entry_id, d.id, f.source_id)::text,
           COALESCE(e.title, d.title)
      FROM public.file_index f
      LEFT JOIN public.person_file_attachments a ON f.source = 'hr_attachment' AND a.id = f.source_id
      LEFT JOIN public.person_file_evidence e ON e.id = a.evidence_id
      LEFT JOIN public.person_file_entries en ON en.id = a.entry_id
      LEFT JOIN public.legal_matter_documents d ON f.source = 'matter_document' AND d.id = f.source_id AND d.voided_at IS NULL
      CROSS JOIN LATERAL public.fts_hit(f.text, v_q, v_opts) h
     WHERE f.source <> 'drive' AND f.text IS NOT NULL
       AND (f.person_id = p_person_id OR (v_matter IS NOT NULL AND f.matter_id = v_matter))
       AND (f.source <> 'hr_attachment' OR a.id IS NOT NULL)
       AND (f.source <> 'matter_document' OR d.id IS NOT NULL)
       -- a .md or .txt kept as text is searched by section above, not twice through its bytes (#288)
       AND (f.source <> 'matter_document' OR d.text_document_id IS NULL)
       AND (p_in IS NULL OR p_in = 'files')
       AND to_tsvector('english', coalesce(f.text, '')) @@ v_pre
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
