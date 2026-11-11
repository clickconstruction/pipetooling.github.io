-- The case search finds a quoted phrase wherever it sits in a long text (v2.6938, migration 20261111180000:
-- fts_prefilter, fts_hit, dev_case_search). A tsvector keeps positions up to 16,383 and 255 positions a word; the
-- search used to test the phrase over a whole document first, so a phrase past the 16,383rd word was never found.
-- Here: a made-up shop log of twelve sections and 24,000 words with the phrase in sections 10 and 11, found quoted and
-- unquoted; a phrase whose words never sit together and one whose words sit in two sections, found nowhere; a word
-- left out, which leaves out its section and not the document; a document with no headings, a summary, a file's text
-- and a matter's text document, each with the phrase past the cap; a section where one word is used 300 times before
-- the phrase; the snippet and the rank of a late phrase; who may call; and the plan of each index test, which must
-- still read the GIN index. Made-up people and words. Fixtures made as postgres; the search runs as a dev through
-- RLS; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "case_search_phrases PASSED". See scripts/pgtest-case-search-phrases.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA csp;
CREATE FUNCTION csp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`.
CREATE FUNCTION csp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION csp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- p_n made-up words, none of them a word any search here names, a line every 25.
CREATE FUNCTION csp.filler(p_n int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg('gasket' || (g % 700) || CASE WHEN g % 25 = 0 THEN E'\n' ELSE '' END, ' ' ORDER BY g) FROM generate_series(1, p_n) g $$;
-- A search's hits in a line: each hit's source, its title and its section number (- for the words before a heading).
CREATE FUNCTION csp.hits(p_q text, p_in text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(s.h, ', ' ORDER BY s.h COLLATE "C"), 'none') FROM (
    SELECT concat_ws(' ', x->>'source', NULLIF(x->>'title', x->>'source'),
                     CASE WHEN x->>'source' IN ('document', 'summary', 'narrative', 'matter_narrative') THEN COALESCE(x->>'section_n', '-') ELSE x->>'section_n' END) AS h
      FROM jsonb_array_elements(public.dev_case_search('00000000-0000-0000-0000-0000000938b1', p_q, p_in, 100)->'hits') x) s $$;
-- One hit of a search, by source and title.
CREATE FUNCTION csp.hit(p_q text, p_source text, p_title text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT x FROM jsonb_array_elements(public.dev_case_search('00000000-0000-0000-0000-0000000938b1', p_q, NULL, 100)->'hits') x
   WHERE x->>'source' = p_source AND x->>'title' = p_title LIMIT 1 $$;
-- A statement's plan in one line, with the planner kept off the sequential read and the plain index walk.
CREATE FUNCTION csp.plan(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_line text; v_all text := '';
BEGIN
  PERFORM set_config('enable_seqscan', 'off', true);
  PERFORM set_config('enable_indexscan', 'off', true);
  FOR v_line IN EXECUTE 'EXPLAIN ' || stmt LOOP v_all := v_all || ' ' || btrim(v_line); END LOOP;
  PERFORM set_config('enable_seqscan', 'on', true);
  PERFORM set_config('enable_indexscan', 'on', true);
  RETURN v_all;
END $$;
GRANT USAGE ON SCHEMA csp TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA csp TO authenticated;

-- ── fts_prefilter: the words, never the phrase, and nothing left out ────────────────────────────────────────────────
SELECT csp.same('a phrase is asked of the index as its words', public.fts_prefilter(websearch_to_tsquery('english', '"brass elbow" bench'))::text, $$'brass' & 'elbow' & 'bench'$$);
SELECT csp.same('a phrase over stop words too', public.fts_prefilter(websearch_to_tsquery('english', '"elbow of the brass"'))::text, $$'elbow' & 'brass'$$);
SELECT csp.same('a word left out narrows nothing', public.fts_prefilter(websearch_to_tsquery('english', '"brass elbow" -returned'))::text, $$'brass' & 'elbow' & !'zz never'$$);
SELECT csp.same('a phrase left out narrows nothing', public.fts_prefilter(websearch_to_tsquery('english', '-"brass elbow" bench'))::text, $$!'zz never' & 'bench'$$);
SELECT csp.same('or stays or', public.fts_prefilter(websearch_to_tsquery('english', '"brass elbow" or walnut'))::text, $$'brass' & 'elbow' | 'walnut'$$);
SELECT csp.same('a hyphenated word is a phrase to the parser and words to the index', public.fts_prefilter(websearch_to_tsquery('english', 'slip-joint'))::text, $$'slip-joint' & 'slip' & 'joint'$$);
SELECT csp.same('plain words pass as they are', public.fts_prefilter(websearch_to_tsquery('english', 'brass elbow'))::text, websearch_to_tsquery('english', 'brass elbow')::text);
SELECT csp.same('a word with a quote in it survives', public.fts_prefilter($$'o''brien' <-> 'elbow'$$::tsquery)::text, $$'o''brien' & 'elbow'$$);

-- ── fts_hit on a text alone ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE csp_text (name text PRIMARY KEY, body text) ON COMMIT DROP;
INSERT INTO csp_text VALUES
  -- brass and elbow apart at the start, the phrase after 20,000 words, 40 words after it
  ('late', 'Brass was short. An elbow came later. ' || csp.filler(20000) || ' the brass elbow came on Friday. ' || csp.filler(40)),
  -- elbow 300 times, then the phrase
  ('worn', (SELECT string_agg('elbow wire', ' ') FROM generate_series(1, 300)) || ' and one brass elbow fitted at last'),
  ('short', 'One brass elbow, fitted on Friday.');
SELECT csp.same('the fixture sits past the cap: the plain test misses the late phrase', (SELECT (to_tsvector('english', body) @@ websearch_to_tsquery('english', '"brass elbow"'))::text FROM csp_text WHERE name = 'late'), 'false');
SELECT csp.same('and the plain test misses a phrase after a word''s 255th use', (SELECT (to_tsvector('english', body) @@ websearch_to_tsquery('english', '"brass elbow"'))::text FROM csp_text WHERE name = 'worn'), 'false');
CREATE FUNCTION csp.found(p_name text, p_q text) RETURNS text LANGUAGE sql AS $$
  SELECT (EXISTS (SELECT 1 FROM csp_text t, public.fts_hit(t.body, websearch_to_tsquery('english', p_q), 'MaxWords=32, MinWords=12, StartSel=«, StopSel=», MaxFragments=1') WHERE t.name = p_name))::text $$;
SELECT csp.same('a late phrase is found', csp.found('late', '"brass elbow"'), 'true');
SELECT csp.same('a longer late phrase over a stop word is found', csp.found('late', '"brass elbow came on Friday"'), 'true');
SELECT csp.same('the words in the other order are not', csp.found('late', '"elbow brass"'), 'false');
SELECT csp.same('a phrase one word off is not', csp.found('late', '"brass elbow on Friday"'), 'false');
SELECT csp.same('a late phrase with a word the text has', csp.found('late', '"brass elbow" short'), 'true');
SELECT csp.same('a late phrase with a word the text lacks', csp.found('late', '"brass elbow" walnut'), 'false');
SELECT csp.same('a late phrase with a word left out that the text has', csp.found('late', '"brass elbow" -friday'), 'false');
SELECT csp.same('a late phrase with a word left out that the text lacks', csp.found('late', '"brass elbow" -walnut'), 'true');
SELECT csp.same('a late phrase left out refuses the text (the plain test let it through)', csp.found('late', '-"brass elbow" short') || ' ' || (SELECT (to_tsvector('english', body) @@ websearch_to_tsquery('english', '-"brass elbow" short'))::text FROM csp_text WHERE name = 'late'), 'false true');
SELECT csp.same('a missing phrase or a word', csp.found('late', '"elbow brass" or friday'), 'true');
SELECT csp.same('a missing phrase or a missing word', csp.found('late', '"elbow brass" or walnut'), 'false');
SELECT csp.same('a phrase after a word''s 255th use is found', csp.found('worn', '"brass elbow fitted"'), 'true');
SELECT csp.same('a short text answers as it always did', csp.found('short', '"brass elbow"') || ' ' || csp.found('short', '"elbow brass"') || ' ' || csp.found('short', 'elbow -friday') || ' ' || csp.found('short', 'friday elbow'), 'true false false true');
SELECT csp.same('a late phrase ranks above nothing', (SELECT (h.rank > 0)::text FROM csp_text t, public.fts_hit(t.body, websearch_to_tsquery('english', '"brass elbow"'), 'MaxWords=32, MinWords=12, StartSel=«, StopSel=», MaxFragments=1') h WHERE t.name = 'late'), 'true');
SELECT csp.same('and its snippet shows the phrase, marked', (SELECT (h.snippet LIKE '%the «brass» «elbow» came on Friday.%')::text FROM csp_text t, public.fts_hit(t.body, websearch_to_tsquery('english', '"brass elbow"'), 'MaxWords=32, MinWords=12, StartSel=«, StopSel=», MaxFragments=1') h WHERE t.name = 'late'), 'true');
SELECT csp.same('no text or no query is no hit', (SELECT count(*)::text FROM public.fts_hit(NULL, 'brass'::tsquery, '')) || ' ' || (SELECT count(*)::text FROM public.fts_hit('brass', NULL, '')), '0 0');

-- ── a person's case ─────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000938d1', 'dev@phrases.test'),
  ('00000000-0000-0000-0000-0000000938d2', 'estimator@phrases.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000938d1', 'dev@phrases.test', 'Phrase Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000938d2', 'estimator@phrases.test', 'Phrase Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000938b1', '00000000-0000-0000-0000-0000000938d1', 'helper', 'Pat Sample');

-- Two entries: one holds the phrase, one holds the words apart.
INSERT INTO public.person_file_entries (id, person_id, entry_date, content, source) VALUES
  ('00000000-0000-0000-0000-0000000938e1', '00000000-0000-0000-0000-0000000938b1', '2026-03-02', 'Dropped a brass elbow in the yard.', 'incident'),
  ('00000000-0000-0000-0000-0000000938e2', '00000000-0000-0000-0000-0000000938b1', '2026-03-09', 'Brass on one shelf, an elbow on another.', 'incident');
INSERT INTO public.person_file_evidence (id, person_id, dated_on, title, memo) VALUES
  ('00000000-0000-0000-0000-0000000938f1', '00000000-0000-0000-0000-0000000938b1', '2026-03-02', 'Counter receipt', 'A made-up receipt, one zinc washer short.');

-- The shop log: words before any heading, then twelve sections of 2,000 words. Sections 1 to 9 hold 18,000 words, so
-- sections 10 and 11 sit past the 16,383rd. The phrase is in 10 (with "returned") and 11; section 1 holds the two words
-- apart; walnut is in 2 and hinge in 3.
INSERT INTO public.documents (id, person_id, title, content) VALUES
  ('00000000-0000-0000-0000-0000000938a1', '00000000-0000-0000-0000-0000000938b1', 'Log',
   'Brass fittings were counted before the year began.' || E'\n\n'
   || (SELECT string_agg('## ' || g || '. Month ' || g || E'\n\n' || csp.filler(2000) || E'\n\n' || CASE g
          WHEN 1 THEN 'The elbow was brass and the tee was not.'
          WHEN 2 THEN 'A walnut handle went on the drawer.'
          WHEN 3 THEN 'The hinge on the cage door stuck.'
          WHEN 10 THEN 'The brass elbow was returned to the counter.'
          WHEN 11 THEN 'A brass elbow sat on the bench all week.'
          ELSE 'Nothing else to note.' END, E'\n\n' ORDER BY g) FROM generate_series(1, 12) g)),
  -- no heading at all: one section of 20,000 words and then the phrase
  ('00000000-0000-0000-0000-0000000938a2', '00000000-0000-0000-0000-0000000938b1', 'Flat',
   csp.filler(20000) || ' the brass elbow came on Friday. ' || csp.filler(40)),
  -- one short section where elbow is used 300 times before the phrase
  ('00000000-0000-0000-0000-0000000938a3', '00000000-0000-0000-0000-0000000938b1', 'Worn',
   E'## 1. Counts\n\n' || (SELECT string_agg('elbow wire', ' ') FROM generate_series(1, 300)) || ' and one brass elbow fitted at last');
INSERT INTO public.person_files (person_id, kind, content) VALUES
  ('00000000-0000-0000-0000-0000000938b1', 'summary',
   E'## 1. Who\n\nA made-up helper.\n\n## 2. History\n\n' || csp.filler(17000) || E'\n\n## 3. Now\n\nA copper flange cracked on the last day.');

-- A file on the evidence record, its text read by the index: 17,500 words and then the phrase.
INSERT INTO public.person_file_attachments (id, person_id, evidence_id, filename, drive_url) VALUES
  ('00000000-0000-0000-0000-0000000938c1', '00000000-0000-0000-0000-0000000938b1', '00000000-0000-0000-0000-0000000938f1', 'receipt.pdf', 'https://drive.test/receipt');
INSERT INTO public.file_index (drive_file_id, name, mime, text, text_source, source, source_id, person_id) VALUES
  ('bed_case_search_phrases_1', 'receipt.pdf', 'application/pdf', csp.filler(17500) || ' and one zinc washer short on the ticket', 'pdf_layer', 'hr_attachment',
   '00000000-0000-0000-0000-0000000938c1', '00000000-0000-0000-0000-0000000938b1');

-- The matter standing on the person: a narrative, an entry, a document by its title, and a text document whose second
-- section sits past the cap.
INSERT INTO public.legal_matters (id, payer_key, kind, person_id, narrative_md) VALUES
  ('00000000-0000-0000-0000-000000093801', 'bed:case-search-phrases', 'person', '00000000-0000-0000-0000-0000000938b1',
   E'## 1. Start\n\nNothing yet.\n\n## 2. Later\n\nA nickel valve stuck open.');
INSERT INTO public.legal_matter_entries (id, matter_id, kind, body, occurred_on) VALUES
  ('00000000-0000-0000-0000-000000093802', '00000000-0000-0000-0000-000000093801', 'note', 'The nickel valve was swapped.', '2026-04-01');
INSERT INTO public.documents (id, matter_id, title, content) VALUES
  ('00000000-0000-0000-0000-0000000938a4', '00000000-0000-0000-0000-000000093801', 'Bench notes',
   E'## 1. First\n\n' || csp.filler(17000) || E'\n\n## 2. Last\n\nThe nickel valve leaked again.');
INSERT INTO public.legal_matter_documents (id, matter_id, title, shows, storage_path, text_document_id) VALUES
  ('00000000-0000-0000-0000-000000093803', '00000000-0000-0000-0000-000000093801', 'Valve photo', 'The nickel valve on the bench.', 'bed/valve.jpg', NULL),
  ('00000000-0000-0000-0000-000000093804', '00000000-0000-0000-0000-000000093801', 'Bench notes', 'Notes kept at the bench.', 'bed/bench-notes.md', '00000000-0000-0000-0000-0000000938a4');

SELECT csp.same('the log is long and its sections are short', (SELECT (length(content) > 200000)::text || ' ' || (SELECT (max(length(s.body)) < 42000)::text FROM public.hr_doc_sections(content) s) FROM public.documents WHERE id = '00000000-0000-0000-0000-0000000938a1'), 'true true');
SELECT csp.same('the plain test over the whole log misses the phrase (what the search used to ask first)', (SELECT (to_tsvector('english', content) @@ websearch_to_tsquery('english', '"brass elbow"'))::text FROM public.documents WHERE id = '00000000-0000-0000-0000-0000000938a1'), 'false');

-- Who may call it.
SELECT csp.refused('nobody signed in is refused', $q$SELECT public.dev_case_search('00000000-0000-0000-0000-0000000938b1', 'brass')$q$, 'devs only');
SET LOCAL ROLE authenticated;
SELECT csp.as_user('00000000-0000-0000-0000-0000000938d2');
SELECT csp.refused('an estimator is refused', $q$SELECT public.dev_case_search('00000000-0000-0000-0000-0000000938b1', 'brass')$q$, 'devs only');
SELECT csp.as_user('00000000-0000-0000-0000-0000000938d1');
SELECT csp.refused('stop words alone are refused in words', $q$SELECT public.dev_case_search('00000000-0000-0000-0000-0000000938b1', 'the of and')$q$, 'all stop words');

-- The phrase, quoted: every place it sits, the late sections with the rest.
SELECT csp.same('a quoted phrase is found wherever it sits', csp.hits('"brass elbow"'), 'document Flat -, document Log 10, document Log 11, document Worn 1, entry');
SELECT csp.same('the same words unquoted add the section that holds them apart, and the entry that does', csp.hits('brass elbow'), 'document Flat -, document Log 1, document Log 10, document Log 11, document Worn 1, entry, entry');
SELECT csp.same('narrowed to the documents', csp.hits('"brass elbow"', 'documents'), 'document Flat -, document Log 10, document Log 11, document Worn 1');
SELECT csp.same('the reply prints the query it parsed', public.dev_case_search('00000000-0000-0000-0000-0000000938b1', '"brass elbow" -returned', 'documents')->>'query', $$'brass' <-> 'elbow' & !'return'$$);
SELECT csp.same('and counts what it found', (SELECT (r->>'count') || ' ' || (r->>'shown') FROM (SELECT public.dev_case_search('00000000-0000-0000-0000-0000000938b1', '"brass elbow"', NULL, 2) AS r) s), '5 2');

-- A phrase that spans nothing.
SELECT csp.same('the words in the other order are found nowhere', csp.hits('"elbow brass"'), 'none');
SELECT csp.same('a phrase whose words sit in two sections is found nowhere', csp.hits('"walnut hinge"'), 'none');
SELECT csp.same('nor are those words unquoted: a hit is a section', csp.hits('walnut hinge'), 'none');
SELECT csp.same('each word alone names its section', csp.hits('walnut') || ' / ' || csp.hits('hinge'), 'document Log 2 / document Log 3');

-- A word left out leaves out its section, not the document.
SELECT csp.same('a word left out drops the section that holds it', csp.hits('"brass elbow" -returned', 'documents'), 'document Flat -, document Log 11, document Worn 1');
SELECT csp.same('and unquoted', csp.hits('brass elbow -returned', 'documents'), 'document Flat -, document Log 1, document Log 11, document Worn 1');
SELECT csp.same('a word left out that no section holds changes nothing', csp.hits('"brass elbow" -walnut -friday', 'documents'), 'document Log 10, document Log 11, document Worn 1');
SELECT csp.same('a phrase left out', csp.hits('-"brass elbow" brass', 'documents'), 'document Log -, document Log 1');
SELECT csp.same('a phrase or a word', csp.hits('"brass elbow" or walnut', 'documents'), 'document Flat -, document Log 10, document Log 11, document Log 2, document Worn 1');

-- The other sources past the cap.
SELECT csp.same('the summary''s late section', csp.hits('"copper flange"'), 'summary 3');
SELECT csp.same('a file''s late words, beside the record''s own memo', csp.hits('"zinc washer"'), 'evidence Counter receipt, file receipt.pdf');
SELECT csp.same('the file hit names its record', (SELECT (x->>'record_kind') || ' ' || (x->>'record_title') FROM csp.hit('"zinc washer short"', 'file', 'receipt.pdf') x), 'evidence Counter receipt');
SELECT csp.same('the matter: narrative, entry, a document by its title, a text document''s late section', csp.hits('"nickel valve"'), 'matter_document Bench notes 2, matter_document Valve photo, matter_entry note, matter_narrative The narrative for the firm 2');
SELECT csp.same('narrowed to the matter', csp.hits('"nickel valve" -swapped', 'matter'), 'matter_document Bench notes 2, matter_document Valve photo, matter_narrative The narrative for the firm 2');

-- What a late hit carries.
SELECT csp.same('a late section''s snippet marks the phrase', (SELECT ((x->>'snippet') LIKE '%«brass» «elbow» sat on the %')::text FROM jsonb_array_elements(public.dev_case_search('00000000-0000-0000-0000-0000000938b1', '"brass elbow" bench', 'documents')->'hits') x), 'true');
SELECT csp.same('a text with no headings: the snippet is the phrase''s own words', (SELECT ((x->>'snippet') LIKE '%the «brass» «elbow» came on Friday.%')::text || ' ' || ((x->>'rank')::numeric > 0)::text FROM csp.hit('"brass elbow"', 'document', 'Flat') x), 'true true');
SELECT csp.same('a phrase after a word''s 255th use: the snippet marks it and it ranks', (SELECT ((x->>'snippet') LIKE '%«brass» «elbow» fitted%')::text || ' ' || ((x->>'rank')::numeric > 0)::text FROM csp.hit('"brass elbow"', 'document', 'Worn') x), 'true true');
SELECT csp.same('a file''s late phrase: the snippet marks it', (SELECT ((x->>'snippet') LIKE '%one «zinc» «washer» short%')::text FROM csp.hit('"zinc washer"', 'file', 'receipt.pdf') x), 'true');
RESET ROLE;

-- The index test still reads each GIN index, asked the words of a phrase with a word left out.
CREATE FUNCTION csp.pre() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT quote_literal(public.fts_prefilter(websearch_to_tsquery('english', '"brass elbow" -returned'))::text) || '::tsquery' $$;
SELECT csp.same('the documents test reads its index', (csp.plan('SELECT 1 FROM public.documents d WHERE to_tsvector(''english'', d.content) @@ ' || csp.pre()) LIKE '%Bitmap Index Scan on idx_documents_fts%')::text, 'true');
SELECT csp.same('the summary and narrative test reads its index', (csp.plan('SELECT 1 FROM public.person_files f WHERE to_tsvector(''english'', f.content) @@ ' || csp.pre()) LIKE '%Bitmap Index Scan on idx_person_files_fts%')::text, 'true');
SELECT csp.same('the entries test reads its index', (csp.plan('SELECT 1 FROM public.person_file_entries e WHERE to_tsvector(''english'', e.content) @@ ' || csp.pre()) LIKE '%Bitmap Index Scan on idx_person_file_entries_fts%')::text, 'true');
SELECT csp.same('the evidence test reads its index', (csp.plan('SELECT 1 FROM public.person_file_evidence r WHERE to_tsvector(''english'', r.title || '' '' || r.memo) @@ ' || csp.pre()) LIKE '%Bitmap Index Scan on idx_person_file_evidence_fts%')::text, 'true');
SELECT csp.same('the matter entries test reads its index', (csp.plan('SELECT 1 FROM public.legal_matter_entries e WHERE to_tsvector(''english'', COALESCE(e.body, '''')) @@ ' || csp.pre()) LIKE '%Bitmap Index Scan on idx_legal_matter_entries_fts%')::text, 'true');
SELECT csp.same('the files test reads its index', (csp.plan('SELECT 1 FROM public.file_index f WHERE f.source <> ''drive'' AND to_tsvector(''english'', coalesce(f.text, '''')) @@ ' || csp.pre()) LIKE '%Bitmap Index Scan on file_index_record_text_fts%')::text, 'true');

DO $$ BEGIN RAISE NOTICE 'case_search_phrases PASSED'; END $$;
ROLLBACK;
