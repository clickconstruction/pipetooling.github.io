SET lock_timeout = '3s';

-- Search every file deeply (punch list #240, PR 4, v2.6338): search by meaning. Every indexed file's text is cut into
-- chunks and each chunk gets a vector from Gemini's gemini-embedding-001 at 768 dimensions (the key in the secret
-- GEMINI_API_KEY, read at call time; unset, nothing is embedded and the words alone answer). A search embeds the query
-- the same way and search_file_index_meaning fuses the words' rank and the nearest chunks (reciprocal rank fusion,
-- k = 60), so "the letter where the GC agreed to the extra rock" finds the rock-clause letter when it never says
-- "agreed". The dimension is fixed here: a change of provider or dimension is a new table.
-- See docs/migrations/20261102051500_file_index_meaning.md.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ── the chunks ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.file_index_chunks (
  drive_file_id text NOT NULL REFERENCES public.file_index(drive_file_id) ON DELETE CASCADE,
  chunk_no integer NOT NULL
    CONSTRAINT file_index_chunks_no_nonneg CHECK (chunk_no >= 0),
  -- About 800 tokens of the file's text, as embedded; the box shows its opening for a hit found by meaning alone.
  text text NOT NULL
    CONSTRAINT file_index_chunks_text_length CHECK (length(text) BETWEEN 1 AND 8000),
  embedding extensions.vector(768) NOT NULL,
  embedded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drive_file_id, chunk_no)
);

COMMENT ON TABLE public.file_index_chunks IS
  'Search by meaning (#240, PR 4): one row per chunk of an indexed file''s text with its gemini-embedding-001 vector (768). Written by the service role alone, inside the index pass; the office reads through search_file_index_meaning.';

CREATE INDEX IF NOT EXISTS file_index_chunks_embedding_idx ON public.file_index_chunks USING hnsw (embedding extensions.vector_cosine_ops);

ALTER TABLE public.file_index_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS file_index_chunks_select ON public.file_index_chunks;
CREATE POLICY file_index_chunks_select ON public.file_index_chunks
  FOR SELECT TO authenticated USING ((SELECT public.is_office_or_estimator()) AND NOT (SELECT public.is_digital_twin()));
REVOKE ALL ON TABLE public.file_index_chunks FROM anon;
GRANT SELECT ON TABLE public.file_index_chunks TO authenticated;
GRANT ALL ON TABLE public.file_index_chunks TO service_role;

-- ── the file's embedding state ────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS embed_tried_at timestamptz;
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS embed_note text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_index_embed_note_length') THEN
    ALTER TABLE public.file_index ADD CONSTRAINT file_index_embed_note_length CHECK (embed_note IS NULL OR length(embed_note) <= 1000);
  END IF;
END $$;
COMMENT ON COLUMN public.file_index.embedded_at IS 'When the row''s chunks were last embedded (#240, PR 4); older than indexed_at means the text changed since and the row is due again.';
COMMENT ON COLUMN public.file_index.embed_tried_at IS 'When embedding last tried this row; a refusal is tried again a day later.';
COMMENT ON COLUMN public.file_index.embed_note IS 'The provider''s own reason the last time it refused this row; null once embedded.';

-- The embedding pass's queue: rows with text whose chunks are missing or older than the text.
CREATE INDEX IF NOT EXISTS file_index_embed_due_idx ON public.file_index (embed_tried_at NULLS FIRST) WHERE text IS NOT NULL AND (embedded_at IS NULL OR embedded_at < indexed_at);

-- ── the hybrid search ─────────────────────────────────────────────────────────────────────────────────────────────
-- The words' top sixty (ts_rank_cd, as search_file_index ranks) and the nearest sixty chunks within max_distance (cosine,
-- the HNSW index) grouped to their files, fused by reciprocal rank (k = 60), the top max_hits; each hit says how it was
-- found (`by`: words, meaning, both) and carries the words' headline when the words matched and the nearest chunk's
-- text when they did not. SECURITY INVOKER, so the tables' own policies decide who reads.
CREATE OR REPLACE FUNCTION public.search_file_index_meaning(query_embedding extensions.vector(768), words text, max_hits integer DEFAULT 30, max_distance real DEFAULT 0.45)
RETURNS TABLE (
  drive_file_id text,
  jobs_ledger_id uuid,
  bid_id uuid,
  customer_id uuid,
  folder_kind text,
  path text,
  name text,
  mime text,
  bytes bigint,
  modified_at timestamptz,
  text_source text,
  text_why text,
  rank real,
  headline text,
  hcp_number text,
  click_number text,
  job_name text,
  bid_number text,
  project_name text,
  by text,
  chunk_text text,
  distance real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
-- An HNSW scan answers at most ef_search rows (40 by default), so the nearest two hundred need the knob raised here.
SET hnsw.ef_search = 200
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', coalesce(words, '')) AS query
  ),
  fts AS (
    SELECT f.drive_file_id, row_number() OVER (ORDER BY ts_rank_cd(f.search, q.query) DESC, f.modified_at DESC NULLS LAST, f.drive_file_id) AS r
    FROM public.file_index f
    CROSS JOIN q
    WHERE numnode(q.query) > 0 AND f.search @@ q.query
    ORDER BY ts_rank_cd(f.search, q.query) DESC, f.modified_at DESC NULLS LAST, f.drive_file_id
    LIMIT 60
  ),
  near AS (
    SELECT c.drive_file_id, c.text AS chunk_text, (c.embedding <=> query_embedding)::real AS dist
    FROM public.file_index_chunks c
    ORDER BY c.embedding <=> query_embedding
    LIMIT 200
  ),
  vec AS (
    SELECT DISTINCT ON (n.drive_file_id) n.drive_file_id, n.chunk_text, n.dist
    FROM near n
    WHERE n.dist <= max_distance
    ORDER BY n.drive_file_id, n.dist
  ),
  vecr AS (
    SELECT v.drive_file_id, v.chunk_text, v.dist, row_number() OVER (ORDER BY v.dist, v.drive_file_id) AS r
    FROM vec v
    ORDER BY v.dist
    LIMIT 60
  ),
  fused AS (
    SELECT coalesce(fts.drive_file_id, vecr.drive_file_id) AS id,
           (coalesce(1.0 / (60 + fts.r), 0) + coalesce(1.0 / (60 + vecr.r), 0))::real AS score,
           fts.r AS fr, vecr.r AS vr, vecr.chunk_text, vecr.dist
    FROM fts
    FULL OUTER JOIN vecr ON fts.drive_file_id = vecr.drive_file_id
    ORDER BY score DESC, coalesce(fts.r, 999), coalesce(vecr.r, 999)
    LIMIT LEAST(GREATEST(coalesce(max_hits, 30), 1), 100)
  ),
  hits AS MATERIALIZED (
    SELECT f.drive_file_id, f.jobs_ledger_id, f.bid_id, f.customer_id, f.folder_kind, f.path, f.name, f.mime, f.bytes,
           f.modified_at, f.text_source, f.text_why, f.text, u.score, u.fr, u.vr, u.chunk_text, u.dist
    FROM fused u
    JOIN public.file_index f ON f.drive_file_id = u.id
  )
  SELECT h.drive_file_id, h.jobs_ledger_id, h.bid_id, h.customer_id, h.folder_kind, h.path, h.name, h.mime, h.bytes,
         h.modified_at, h.text_source, h.text_why, h.score AS rank,
         CASE WHEN h.fr IS NOT NULL AND h.text IS NOT NULL AND h.text <> ''
              THEN ts_headline('english', left(h.text, 200000), q.query, 'MaxWords=35, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1, FragmentDelimiter=…')
              ELSE NULL END AS headline,
         j.hcp_number, j.click_number, j.job_name,
         b.bid_number, b.project_name,
         CASE WHEN h.fr IS NOT NULL AND h.vr IS NOT NULL THEN 'both' WHEN h.fr IS NOT NULL THEN 'words' ELSE 'meaning' END AS by,
         h.chunk_text,
         h.dist AS distance
  FROM hits h
  CROSS JOIN q
  LEFT JOIN public.jobs_ledger j ON j.id = h.jobs_ledger_id
  LEFT JOIN public.bids b ON b.id = h.bid_id
  ORDER BY h.score DESC, coalesce(h.fr, 999), coalesce(h.vr, 999)
$$;

COMMENT ON FUNCTION public.search_file_index_meaning(extensions.vector, text, integer, real) IS
  'Search by meaning (#240, PR 4): the words'' top sixty and the nearest sixty chunks within max_distance fused by reciprocal rank (k = 60), the top max_hits, each with how it was found (by: words, meaning, both), the words'' headline or the nearest chunk''s text. SECURITY INVOKER.';

REVOKE EXECUTE ON FUNCTION public.search_file_index_meaning(extensions.vector, text, integer, real) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_file_index_meaning(extensions.vector, text, integer, real) TO authenticated, service_role;

-- The restrictive policies and the statement trigger that block writes from users flagged read_only (training mode),
-- and the fence that holds digital twins to their own bids: each creates only what is missing for the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
