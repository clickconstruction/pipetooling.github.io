SET lock_timeout = '3s';

-- Search every file deeply (punch list #240, v2.6491): the embedding pass's queue. The partial index
-- file_index_embed_due_idx (20261102051500) holds the catch-up rule — a row with text whose chunks are missing or
-- older than the text, embedded_at IS NULL OR embedded_at < indexed_at — but PostgREST cannot compare two columns,
-- so the pass asked for embedded_at IS NULL alone and a row embedded before its last index was never taken again.
-- This function asks the rule the index serves. Service role only: the pass runs as it, and the rows carry every
-- file's text. See docs/migrations/20261104160000_file_index_embed_due.md.

CREATE OR REPLACE FUNCTION public.file_index_embed_due(max_rows integer DEFAULT 30)
RETURNS TABLE (
  drive_file_id text,
  name text,
  text text,
  indexed_at timestamptz,
  embedded_at timestamptz,
  embed_tried_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT f.drive_file_id, f.name, f.text, f.indexed_at, f.embedded_at, f.embed_tried_at
  FROM public.file_index f
  WHERE f.text IS NOT NULL AND (f.embedded_at IS NULL OR f.embedded_at < f.indexed_at)
  ORDER BY f.embed_tried_at ASC NULLS FIRST
  LIMIT LEAST(GREATEST(coalesce(max_rows, 30), 1), 300)
$$;

COMMENT ON FUNCTION public.file_index_embed_due(integer) IS
  'The embedding pass''s queue (#240, v2.6491): rows with text whose chunks are missing or older than the text (embedded_at IS NULL OR embedded_at < indexed_at, the rule file_index_embed_due_idx serves), oldest try first, never tried first, at most max_rows (300). Service role only.';

REVOKE EXECUTE ON FUNCTION public.file_index_embed_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_index_embed_due(integer) TO service_role;
