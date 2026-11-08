SET lock_timeout = '3s';

-- Search reaches the text of a linked file (punch list #285, PR 1, v2.6714): the file index (#240) reaches past the jobs
-- Shared Drive to the files a person's HR file and a legal matter hold — a transcript linked from Drive on an evidence
-- record, a staged .eml or PDF in the hr-files bucket, a document in the legal-matter-documents bucket — so the case
-- search (PR 2) can find a line of a call without the transcript being retyped into a named document. One table, as the
-- card decided: `source` says where a row came from (drive, as every row before; hr_attachment, a person_file_attachments
-- row; matter_document, a legal_matter_documents row), `source_id` the row it stands for, `person_id` / `matter_id` the
-- file it hangs on, and `counsel_only` carried from the evidence record. The key column keeps its name: for a record's
-- file it holds that row's own id (a uuid passes the key's shape), never a Drive id, so a staged file later filed into
-- Drive by hr-evidence-drive keeps one row.
--
-- Who reads what: Find a file (search_file_index, search_file_index_meaning) answers Drive rows alone, whoever asks —
-- the service role runs them for drive-link; the table's own policy opens a record's row to a dev only, and the seat as
-- deployed (X-Dev-Seat) is refused a counsel-only row, as it is the record's files (20261106020000). hr_agent has no
-- grant on the table and reads none. The embedding queue takes Drive rows alone: the case search is words-only, so a
-- record's text never goes to Gemini for nothing. The queue the sweep's records step and the seat's backfill read is
-- file_index_records_due; file_index_records_drop_gone drops the rows whose record is gone or voided.
-- See docs/migrations/20261108200000_file_index_reach.md.

ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'drive';
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE CASCADE;
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS matter_id uuid REFERENCES public.legal_matters(id) ON DELETE CASCADE;
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS counsel_only boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_index_source_known') THEN
    ALTER TABLE public.file_index ADD CONSTRAINT file_index_source_known CHECK (source IN ('drive', 'hr_attachment', 'matter_document'));
  END IF;
  -- A Drive row stands for itself; a record's row names the row it stands for.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_index_source_id_shape') THEN
    ALTER TABLE public.file_index ADD CONSTRAINT file_index_source_id_shape CHECK ((source = 'drive') = (source_id IS NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.file_index.source IS 'Where the row came from (#285): drive (a file in the jobs Shared Drive, every row before v2.6714), hr_attachment (a person_file_attachments row: staged in hr-files, or linked from Drive), matter_document (a legal_matter_documents row in its bucket).';
COMMENT ON COLUMN public.file_index.source_id IS 'The person_file_attachments or legal_matter_documents row this row stands for; null for a Drive row. For a record''s file drive_file_id holds this same id as text.';
COMMENT ON COLUMN public.file_index.person_id IS 'The person whose HR file the record is on, or whose matter the document is on (#285), so a case search and a person''s backfill find the file.';
COMMENT ON COLUMN public.file_index.matter_id IS 'The legal matter a document is on (#285).';
COMMENT ON COLUMN public.file_index.counsel_only IS 'Carried from the evidence record (#285): the text sits here and nowhere in Drive, the seat as deployed is refused the row, and the case search marks the hit.';

CREATE UNIQUE INDEX IF NOT EXISTS file_index_source_id_idx ON public.file_index (source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_index_person_idx ON public.file_index (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_index_matter_idx ON public.file_index (matter_id) WHERE matter_id IS NOT NULL;

-- ── who reads ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- The office and the estimators read the Drive rows as before (never a twin, 20261102215000); a record's row is a
-- dev's alone, as the record is. The seat as deployed is refused a counsel-only row, the way it is refused the record.
DROP POLICY IF EXISTS file_index_select ON public.file_index;
CREATE POLICY file_index_select ON public.file_index
  FOR SELECT TO authenticated USING ((SELECT public.is_office_or_estimator()) AND NOT (SELECT public.is_digital_twin()) AND (source = 'drive' OR (SELECT public.is_dev())));
DROP POLICY IF EXISTS file_index_counsel_only_seat ON public.file_index;
CREATE POLICY file_index_counsel_only_seat ON public.file_index
  AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (counsel_only AND public.request_is_dev_seat()));

-- ── Find a file answers Drive rows alone ──────────────────────────────────────────────────────────────────────────
-- drive-link runs both as the service role once the door has checked the office role, and the service role sees past
-- the policy, so the filter is in the functions themselves. The bodies are 20261102040500's and 20261102051500's with
-- `source = 'drive'` on the file_index reads; the signatures and the return shapes are unchanged.
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
    WHERE f.source = 'drive' AND numnode(q.query) > 0 AND f.search @@ q.query
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

-- The function below carries SET hnsw.ef_search, a parameter the vector library defines when it loads. A fresh session
-- has not loaded it (20261102051500 ran CREATE EXTENSION in its own session, which did), and a placeholder parameter
-- may be set by a superuser alone, so the push and the SQL beds answered "permission denied to set parameter". One
-- cast through the type's input function loads the library first.
DO $$ BEGIN PERFORM '[1]'::extensions.vector; END $$;

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
SET hnsw.ef_search = 200
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('english', coalesce(words, '')) AS query
  ),
  fts AS (
    SELECT f.drive_file_id, row_number() OVER (ORDER BY ts_rank_cd(f.search, q.query) DESC, f.modified_at DESC NULLS LAST, f.drive_file_id) AS r
    FROM public.file_index f
    CROSS JOIN q
    WHERE f.source = 'drive' AND numnode(q.query) > 0 AND f.search @@ q.query
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
    JOIN public.file_index f ON f.drive_file_id = u.id AND f.source = 'drive'
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

-- The embedding queue takes Drive rows alone: a record's text is searched by its words (PR 2) and never sent to Gemini.
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
  WHERE f.source = 'drive' AND f.text IS NOT NULL AND (f.embedded_at IS NULL OR f.embedded_at < f.indexed_at)
  ORDER BY f.embed_tried_at ASC NULLS FIRST
  LIMIT LEAST(GREATEST(coalesce(max_rows, 30), 1), 300)
$$;

-- ── the records' queue ────────────────────────────────────────────────────────────────────────────────────────────
-- Every file a person's HR file or a matter holds that the index has no row for, or holds held (slow, error, reading)
-- with a check older than retry_after: a person_file_attachments row (staged in hr-files, or linked from Drive with
-- its drive_file_id) under its evidence record, its entry or alone; a legal_matter_documents row (not voided) in its
-- bucket. Newest first, so a file just filed is read on the next run. p_person_id narrows to one person's files and
-- their matter's documents; p_matter_id to one matter's documents. Service role only: the sweep's records step, the
-- Drive filer's hook and the seat's backfill run as it, and the rows name every file on every HR file.
CREATE OR REPLACE FUNCTION public.file_index_records_due(max_rows integer DEFAULT 40, p_person_id uuid DEFAULT NULL, p_matter_id uuid DEFAULT NULL, retry_after interval DEFAULT '1 hour')
RETURNS TABLE (
  source text,
  source_id uuid,
  person_id uuid,
  matter_id uuid,
  counsel_only boolean,
  name text,
  mime text,
  bytes bigint,
  bucket text,
  storage_path text,
  drive_file_id text,
  record_kind text,
  record_id uuid,
  record_title text,
  record_day date,
  path text,
  modified_at timestamptz,
  held boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH att AS (
    SELECT 'hr_attachment'::text AS source, a.id AS source_id, a.person_id, NULL::uuid AS matter_id,
           COALESCE(e.counsel_only, false) AS counsel_only,
           COALESCE(NULLIF(btrim(a.filename), ''), 'Untitled') AS name,
           COALESCE(NULLIF(btrim(a.mime_type), ''), 'application/octet-stream') AS mime,
           a.size_bytes AS bytes,
           'hr-files'::text AS bucket, a.storage_path, a.drive_file_id,
           CASE WHEN a.evidence_id IS NOT NULL THEN 'evidence' WHEN a.entry_id IS NOT NULL THEN 'entry' ELSE 'file' END AS record_kind,
           COALESCE(a.evidence_id, a.entry_id, a.id) AS record_id,
           e.title AS record_title,
           COALESCE(e.dated_on, en.entry_date, a.created_at::date) AS record_day,
           'People › ' || COALESCE(NULLIF(btrim(p.name), ''), 'this person') || ' › '
             || COALESCE(e.dated_on::text || ' · ' || e.title, 'Files from before records') AS path,
           a.created_at AS modified_at
    FROM public.person_file_attachments a
    JOIN public.people p ON p.id = a.person_id
    LEFT JOIN public.person_file_evidence e ON e.id = a.evidence_id
    LEFT JOIN public.person_file_entries en ON en.id = a.entry_id
    WHERE p_matter_id IS NULL AND (p_person_id IS NULL OR a.person_id = p_person_id)
  ),
  docs AS (
    SELECT 'matter_document'::text, d.id, m.person_id, d.matter_id,
           false,
           COALESCE(NULLIF(btrim(d.original_name), ''), d.title),
           COALESCE(NULLIF(btrim(d.mime), ''), 'application/octet-stream'),
           d.size_bytes::bigint,
           'legal-matter-documents'::text, d.storage_path, NULL::text,
           'matter_document'::text, d.id, d.title, COALESCE(d.dated_on, d.added_at::date),
           'Matter › ' || COALESCE(NULLIF(btrim(m.payer_name), ''), NULLIF(btrim(m.handling_name), ''), 'matter') || ' › Evidence',
           d.added_at
    FROM public.legal_matter_documents d
    JOIN public.legal_matters m ON m.id = d.matter_id
    WHERE d.voided_at IS NULL
      AND (p_matter_id IS NULL OR d.matter_id = p_matter_id)
      AND (p_person_id IS NULL OR m.person_id = p_person_id)
  ),
  every AS (SELECT * FROM att UNION ALL SELECT * FROM docs)
  SELECT r.source, r.source_id, r.person_id, r.matter_id, r.counsel_only, r.name, r.mime, r.bytes, r.bucket, r.storage_path,
         r.drive_file_id, r.record_kind, r.record_id, r.record_title, r.record_day, r.path, r.modified_at,
         (f.drive_file_id IS NOT NULL) AS held
  FROM every r
  LEFT JOIN public.file_index f ON f.source = r.source AND f.source_id = r.source_id
  WHERE f.drive_file_id IS NULL
     OR (f.text_why IN ('slow', 'error', 'reading') AND f.checked_at < now() - retry_after)
  ORDER BY r.modified_at DESC
  LIMIT LEAST(GREATEST(coalesce(max_rows, 40), 1), 500)
$$;

COMMENT ON FUNCTION public.file_index_records_due(integer, uuid, uuid, interval) IS
  'The records'' queue for the file index (#285, PR 1): every person_file_attachments row and every unvoided legal_matter_documents row with no file_index row, or a held one (slow, error, reading) checked over retry_after ago, newest first, at most max_rows (500); p_person_id narrows to a person''s files and their matter''s documents, p_matter_id to a matter''s documents. Service role only.';

-- The rows whose record is gone: an attachment removed, a document voided. Answers how many went.
CREATE OR REPLACE FUNCTION public.file_index_records_drop_gone()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_att integer;
  v_docs integer;
BEGIN
  DELETE FROM public.file_index f
   WHERE f.source = 'hr_attachment' AND NOT EXISTS (SELECT 1 FROM public.person_file_attachments a WHERE a.id = f.source_id);
  GET DIAGNOSTICS v_att = ROW_COUNT;
  DELETE FROM public.file_index f
   WHERE f.source = 'matter_document' AND NOT EXISTS (SELECT 1 FROM public.legal_matter_documents d WHERE d.id = f.source_id AND d.voided_at IS NULL);
  GET DIAGNOSTICS v_docs = ROW_COUNT;
  RETURN v_att + v_docs;
END;
$$;

COMMENT ON FUNCTION public.file_index_records_drop_gone() IS
  'Drops the file_index rows whose record is gone (#285, PR 1): an hr_attachment row with no person_file_attachments row, a matter_document row whose document is voided or gone. Service role only; the sweep''s records step runs it first.';

REVOKE EXECUTE ON FUNCTION public.file_index_records_due(integer, uuid, uuid, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_index_records_due(integer, uuid, uuid, interval) TO service_role;
REVOKE EXECUTE ON FUNCTION public.file_index_records_drop_gone() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_index_records_drop_gone() TO service_role;

-- ── the status, with the reach ────────────────────────────────────────────────────────────────────────────────────
-- dev_file_index_status (20261102050300) gains by_reach (rows by source), records_with_rows and records_without_rows
-- (the attachments and unvoided documents with and without a row), so read_file_index_status says where the reach stands.
CREATE OR REPLACE FUNCTION public.dev_file_index_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_dev() THEN jsonb_build_object('refused', 'Devs only: read_file_index_status runs as a dev.')
    ELSE jsonb_build_object(
      'rows', (SELECT count(*) FROM public.file_index),
      'with_text', (SELECT count(*) FROM public.file_index WHERE text IS NOT NULL),
      'by_source', (SELECT coalesce(jsonb_object_agg(s.text_source, s.n), '{}'::jsonb) FROM (SELECT text_source, count(*) AS n FROM public.file_index WHERE text_source IS NOT NULL GROUP BY text_source) s),
      'by_why', (SELECT coalesce(jsonb_object_agg(w.text_why, w.n), '{}'::jsonb) FROM (SELECT text_why, count(*) AS n FROM public.file_index WHERE text_why IS NOT NULL GROUP BY text_why) w),
      'by_folder', (SELECT coalesce(jsonb_object_agg(k.folder_kind, k.n), '{}'::jsonb) FROM (SELECT folder_kind, count(*) AS n FROM public.file_index GROUP BY folder_kind) k),
      'by_reach', (SELECT coalesce(jsonb_object_agg(r.source, r.n), '{}'::jsonb) FROM (SELECT source, count(*) AS n FROM public.file_index GROUP BY source) r),
      'records_with_rows', (SELECT count(*) FROM public.file_index WHERE source <> 'drive'),
      'records_without_rows',
        (SELECT count(*) FROM public.person_file_attachments a WHERE NOT EXISTS (SELECT 1 FROM public.file_index f WHERE f.source = 'hr_attachment' AND f.source_id = a.id))
        + (SELECT count(*) FROM public.legal_matter_documents d WHERE d.voided_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.file_index f WHERE f.source = 'matter_document' AND f.source_id = d.id)),
      'jobs_with_rows', (SELECT count(DISTINCT jobs_ledger_id) FROM public.file_index WHERE jobs_ledger_id IS NOT NULL),
      'bids_with_rows', (SELECT count(DISTINCT bid_id) FROM public.file_index WHERE bid_id IS NOT NULL),
      'rows_under_no_home', (SELECT count(*) FROM public.file_index WHERE source = 'drive' AND jobs_ledger_id IS NULL AND bid_id IS NULL),
      'read_in_part', (SELECT count(*) FROM public.file_index WHERE pages_read IS NOT NULL AND pages IS NOT NULL AND pages_read < pages),
      'live_jobs_with_folder', (SELECT count(*) FROM public.jobs_ledger j WHERE j.google_drive_link IS NOT NULL AND (j.status IS NULL OR j.status <> 'paid')),
      'live_jobs_without_rows', (SELECT count(*) FROM public.jobs_ledger j WHERE j.google_drive_link IS NOT NULL AND (j.status IS NULL OR j.status <> 'paid') AND NOT EXISTS (SELECT 1 FROM public.file_index f WHERE f.jobs_ledger_id = j.id)),
      'paid_jobs_with_folder', (SELECT count(*) FROM public.jobs_ledger j WHERE j.google_drive_link IS NOT NULL AND j.status = 'paid'),
      'paid_jobs_without_rows', (SELECT count(*) FROM public.jobs_ledger j WHERE j.google_drive_link IS NOT NULL AND j.status = 'paid' AND NOT EXISTS (SELECT 1 FROM public.file_index f WHERE f.jobs_ledger_id = j.id)),
      'newest_indexed_at', (SELECT max(indexed_at) FROM public.file_index),
      'oldest_checked_at', (SELECT min(checked_at) FROM public.file_index),
      'sweep_last_at', (SELECT value_text FROM public.app_settings WHERE key = 'file_index_sweep_last_at')
    )
  END
$$;
