# 20261111180000_case_search_phrases.sql (2026-11-11, v2.6938)

The case search finds a quoted phrase wherever it sits in a long text ([v2.6938](../recent-features/v2.6938.md)). A tsvector keeps positions up to 16,383 and 255 positions a word, and `dev_case_search` (the seat's `search_case`) tested the phrase over a whole document before reading its sections, so a phrase past the document's 16,383rd word was never found.

- **`fts_query_tokens(tsquery)`** → `text[]`: a parsed query cut into the pieces it prints. Each word quoted with its flags, each phrase operator (`<->`, `<N>`), `&`, `|`, `!`, `(`, `)`.
- **`fts_prefilter(tsquery)`** → `tsquery`: the query a GIN index answers for certain. The same words, every phrase operator read as `&`, and every left-out word or group read as true (`!'zz never'`, a word with a space in it, which no text can hold). It never refuses a text the query matches. `'brass' <-> 'elbow' & !'return'` becomes `'brass' & 'elbow' & !'zz never'`. A shape it cannot read becomes `!'zz never'` alone, so the index narrows nothing and `fts_hit` decides.
- **`fts_windows(text, words, step)`** → `(n, body)`: the text cut into windows of `words` words, a new one every `step` words, in the order they start.
- **`fts_hit(text, tsquery, headline options)`** → `(rank real, snippet text)`: no row when the text does not match. A query with no phrase is the plain test, `ts_rank_cd` and `ts_headline`. With a phrase, each plain run of words is looked for in windows of 200 words, a new one every 100, and only in a text that holds all of the run's words. The run is then read as true or false and the rest of the query is tested on the whole text. The rank is the whole text's, or the phrase's in its window when that is 0. The snippet is `ts_headline` over the whole text when that shows the first phrase found, else the middle one of the 32-word windows that hold the phrase. A phrase that is not a plain run of words, which `websearch_to_tsquery` does not write, falls back to the plain test.
- **`dev_case_search(p_person_id, p_q, p_in, p_limit)`** replaced: [`20261108230000`](./20261108230000_matter_document_counsel_only.md)'s body with `v_pre := fts_prefilter(v_q)`, each branch's index test on `v_pre`, and each branch's match, rank and snippet from `CROSS JOIN LATERAL fts_hit(<the text>, v_q, v_opts)`. The two branches with no index (the matter's narrative, a matter document's title and what it shows) take `fts_hit` alone. Sources, columns, gate, parsing, order, limit and the reply are unchanged.

All four helpers are `IMMUTABLE`, revoked from `PUBLIC` and `anon`, granted to `authenticated`. No table, so no fence appliers. No index is added or changed. Idempotent (`CREATE OR REPLACE`).

## What changes for a caller

- A quoted phrase is found past the 16,383rd word of a document, a file's text, a summary or a matter's text document, and after a word's 255th use in one text.
- `-word` leaves out the section, entry or file that holds the word. It used to drop every section of a document that used the word anywhere.
- A phrase hit's snippet shows the phrase.

## The plan

The index test alone reads its GIN index. With `enable_seqscan` and `enable_indexscan` off:

```
Bitmap Heap Scan on documents d
  Recheck Cond: (to_tsvector('english'::regconfig, content) @@ '''brass'' & ''elbow'' & !''zz never'''::tsquery)
  ->  Bitmap Index Scan on idx_documents_fts
        Index Cond: (to_tsvector('english'::regconfig, content) @@ '''brass'' & ''elbow'' & !''zz never'''::tsquery)
```

and the same for `idx_person_files_fts`, `idx_person_file_entries_fts`, `idx_person_file_evidence_fts`, `idx_legal_matter_entries_fts` and `file_index_record_text_fts`. Beside the person's own key on a small table the planner reads the person's rows and filters, as it did before.

## Bed

`supabase/tests/case_search_phrases/20_scenario.sql` (`npm run test:pg:case-search-phrases`): 60 checks, made-up text, the search run as a dev through RLS. It asserts the plan above for each of the six indexes. With the old body of `dev_case_search` put back it fails on its first search.

## Order

After `20261108230000`. Nothing else waits on it: the seat calls the same function with the same arguments, so no edge function is deployed. The types PR follows the push for the four new functions.

**Not applied yet**: `supabase db push` is owed once this file is on `main`.
