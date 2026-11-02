SET lock_timeout = '3s';

-- Search every file deeply (punch list #240, PR 1, v2.6319): our own text index over every file in the jobs Shared
-- Drive. Find a file (v2.6305) asks Drive's own full-text index, which names the files that match and never the
-- passage, cannot rank or stem, and keeps the text of a scan to itself. This table is one row per Drive file with
-- its job, bid or customer, its folder, its name and kind, and the text we read out of it (a Google Doc exported, a
-- PDF's text layer, a text file's bytes; later a scan's OCR), with a tsvector over name, path and text that
-- Postgres ranks, stems and answers in milliseconds. drive-link's `index` and `index_job` fill it on a press, the
-- file-index-sweep cron keeps it current as files land, and a Claude agent's one-time backfill fills the rest.
-- Drive's index stays as the floor: the box falls back to it when this table has nothing.
-- See docs/migrations/20261102040500_file_index.md.

CREATE TABLE IF NOT EXISTS public.file_index (
  -- Drive's own id for the file, the one key: a file moved or renamed keeps it.
  drive_file_id text PRIMARY KEY
    CONSTRAINT file_index_id_shape CHECK (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  -- The home the file was walked up to: a Pipeline job by one of its three folder links, or a bid by its folder.
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  -- Which of the job's folders holds it: top (the job's folder itself), plans, pictures (Customer Pictures),
  -- photos (Team only › Photos), sent (Team only › Sent by us), other (any other folder, or a bid's).
  folder_kind text NOT NULL DEFAULT 'other'
    CONSTRAINT file_index_folder_kind_known CHECK (folder_kind IN ('top', 'plans', 'pictures', 'photos', 'sent', 'other')),
  -- The folders between the home and the file, ' › ' joined; '' at the top of the home's folder.
  path text NOT NULL DEFAULT ''
    CONSTRAINT file_index_path_length CHECK (length(path) <= 2000),
  name text NOT NULL
    CONSTRAINT file_index_name_length CHECK (length(name) BETWEEN 1 AND 1000),
  mime text NOT NULL
    CONSTRAINT file_index_mime_length CHECK (length(mime) BETWEEN 1 AND 200),
  bytes bigint
    CONSTRAINT file_index_bytes_nonneg CHECK (bytes IS NULL OR bytes >= 0),
  modified_at timestamptz,
  -- The text we read, capped at 200,000 characters (plenty for ranking); null when there is none, with text_why.
  text text
    CONSTRAINT file_index_text_length CHECK (text IS NULL OR length(text) <= 200000),
  -- Where the text came from: export (a Google Doc, Sheet or Slides as text), pdf_layer (a PDF's own text),
  -- plain (a text file's bytes), ocr (our own OCR of a scan, PR 3).
  text_source text
    CONSTRAINT file_index_text_source_known CHECK (text_source IS NULL OR text_source IN ('export', 'pdf_layer', 'plain', 'ocr')),
  -- When text is null: scan (a PDF or picture with no text layer), kind (a kind we do not read), big (past the
  -- caps), slow (the read ran past its time, or the platform stopped the request mid-read), error (the read
  -- failed), reading (stamped before the read starts, so a request the platform kills leaves a trace).
  text_why text
    CONSTRAINT file_index_text_why_known CHECK (text_why IS NULL OR text_why IN ('scan', 'kind', 'big', 'slow', 'error', 'reading')),
  -- A PDF's page count when it was read.
  pages integer
    CONSTRAINT file_index_pages_nonneg CHECK (pages IS NULL OR pages >= 0),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  -- When the sweep last asked Drive whether the file is still there; a file trashed or gone loses its row.
  checked_at timestamptz NOT NULL DEFAULT now(),
  -- The name counts most, then the folders, then the words inside.
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(path, '')), 'B')
    || setweight(to_tsvector('english', left(coalesce(text, ''), 200000)), 'C')
  ) STORED
);

COMMENT ON TABLE public.file_index IS
  'Search every file deeply (#240, PR 1): one row per Drive file in the jobs Shared Drive with its home (job, bid, customer), its folder, its name and the text read out of it, and a weighted tsvector the search_file_index RPC ranks. Written by the service role alone: drive-link''s index and index_job, the file-index-sweep cron, the dev seat''s backfill. The office reads it through the RPC.';

CREATE INDEX IF NOT EXISTS file_index_search_idx ON public.file_index USING gin (search);
CREATE INDEX IF NOT EXISTS file_index_job_idx ON public.file_index (jobs_ledger_id) WHERE jobs_ledger_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_index_bid_idx ON public.file_index (bid_id) WHERE bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_index_modified_idx ON public.file_index (modified_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS file_index_text_why_idx ON public.file_index (text_why) WHERE text_why IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_index_checked_idx ON public.file_index (checked_at);

-- ── who reads, who writes ─────────────────────────────────────────────────────────────────────────────────────────
-- The office and the estimators read (the roles drive-link's door takes); nobody writes through the API: the three
-- writers run as the service role, so there is no INSERT, UPDATE or DELETE policy for authenticated on purpose. The
-- other roles (subcontractor, helpers, primary, superintendent) see nothing: a file's words are the office's.
ALTER TABLE public.file_index ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS file_index_select ON public.file_index;
CREATE POLICY file_index_select ON public.file_index
  FOR SELECT TO authenticated USING (public.is_office_or_estimator());
REVOKE ALL ON TABLE public.file_index FROM anon;
GRANT SELECT ON TABLE public.file_index TO authenticated;
GRANT ALL ON TABLE public.file_index TO service_role;

-- ── the search ────────────────────────────────────────────────────────────────────────────────────────────────────
-- Find a file asks this first. websearch_to_tsquery takes what a person types (two words are both, "a phrase" in
-- quotes, -not); ts_rank_cd ranks with the name over the folders over the text; the headline is the line around the
-- words with <mark> around each, computed only for the rows that made the cut (the hits CTE is materialized so the
-- headline is never built for every matching row). SECURITY INVOKER, so the table's own policy decides who reads.
CREATE OR REPLACE FUNCTION public.search_file_index(words text, max_hits integer DEFAULT 30)
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
  project_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', coalesce(words, '')) AS query
  ),
  hits AS MATERIALIZED (
    SELECT f.drive_file_id, f.jobs_ledger_id, f.bid_id, f.customer_id, f.folder_kind, f.path, f.name, f.mime, f.bytes,
           f.modified_at, f.text_source, f.text_why, f.text,
           ts_rank_cd(f.search, q.query)::real AS rank
    FROM public.file_index f
    CROSS JOIN q
    WHERE numnode(q.query) > 0 AND f.search @@ q.query
    ORDER BY ts_rank_cd(f.search, q.query) DESC, f.modified_at DESC NULLS LAST, f.drive_file_id
    LIMIT LEAST(GREATEST(coalesce(max_hits, 30), 1), 100)
  )
  SELECT h.drive_file_id, h.jobs_ledger_id, h.bid_id, h.customer_id, h.folder_kind, h.path, h.name, h.mime, h.bytes,
         h.modified_at, h.text_source, h.text_why, h.rank,
         CASE WHEN h.text IS NOT NULL AND h.text <> ''
              THEN ts_headline('english', left(h.text, 200000), q.query, 'MaxWords=35, MinWords=20, StartSel=<mark>, StopSel=</mark>, MaxFragments=1, FragmentDelimiter=…')
              ELSE NULL END AS headline,
         j.hcp_number, j.click_number, j.job_name,
         b.bid_number, b.project_name
  FROM hits h
  CROSS JOIN q
  LEFT JOIN public.jobs_ledger j ON j.id = h.jobs_ledger_id
  LEFT JOIN public.bids b ON b.id = h.bid_id
  ORDER BY h.rank DESC, h.modified_at DESC NULLS LAST, h.drive_file_id
$$;

COMMENT ON FUNCTION public.search_file_index(text, integer) IS
  'Find a file''s index search (#240, PR 1): the rows of file_index whose name, folders or text say the words (websearch_to_tsquery, english), ranked by ts_rank_cd with the name weighted over the folders over the text, at most max_hits (30, capped at 100), each with a ts_headline around the words (<mark>…</mark>) and the job''s or bid''s numbers and name joined in. SECURITY INVOKER: the table''s policy decides who reads.';

REVOKE EXECUTE ON FUNCTION public.search_file_index(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_file_index(text, integer) TO authenticated, service_role;

-- ── the sweep's cron ──────────────────────────────────────────────────────────────────────────────────────────────
-- Every ten minutes, three minutes past the folder sweep's slot so the two never share a minute: POST
-- /functions/v1/file-index-sweep { sweep: {} } with the cron secret (Vault PROJECT_URL and CRON_SECRET, as the
-- folder sweep is scheduled). The function lists what changed in Drive since its stamp (app_settings
-- file_index_sweep_last_at) and indexes it, so a quiet drive costs one Drive list and no writes. Unscheduled first
-- if it exists, so a second run leaves one row.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'file-index-sweep';

SELECT cron.schedule(
  'file-index-sweep',
  '3,13,23,33,43,53 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/file-index-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"sweep":{}}'::jsonb
  ) AS request_id;
  $$
);

-- The restrictive policies and the statement trigger that block writes from users flagged read_only (training mode),
-- and the fence that holds digital twins to their own bids: each creates only what is missing for the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
