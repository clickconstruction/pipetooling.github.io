SET lock_timeout = '3s';

-- Search every file deeply (punch list #240, PR 2, v2.6332): the dev seat's read of where the file index stands, one
-- call for dev-mcp's read_file_index_status. Counts over file_index by source and by why, the jobs with and without
-- rows, the newest and oldest stamps and the sweep's last look. SECURITY DEFINER so the counts need no row-by-row read
-- through the API, gated on is_dev() inside as the health RPCs are (20260920232141); anyone else gets a refusal.
-- See docs/migrations/20261102050300_dev_file_index_status.md.

-- How many of a PDF's pages its read had time for: a long plan set is read from its first page until its budget is
-- spent, so `pages_read` under `pages` says the words past that point are Drive's search alone.
ALTER TABLE public.file_index ADD COLUMN IF NOT EXISTS pages_read integer;
COMMENT ON COLUMN public.file_index.pages_read IS 'Pages of a PDF its read reached (#240, v2.6332); under `pages` when the time budget or the text cap stopped it.';

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
      'jobs_with_rows', (SELECT count(DISTINCT jobs_ledger_id) FROM public.file_index WHERE jobs_ledger_id IS NOT NULL),
      'bids_with_rows', (SELECT count(DISTINCT bid_id) FROM public.file_index WHERE bid_id IS NOT NULL),
      'rows_under_no_home', (SELECT count(*) FROM public.file_index WHERE jobs_ledger_id IS NULL AND bid_id IS NULL),
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

COMMENT ON FUNCTION public.dev_file_index_status() IS
  'The dev seat''s read of the file index (#240, PR 2): counts by source, why and folder, the jobs with and without rows, the stamps and the sweep''s last look. Devs only (is_dev()); dev-mcp''s read_file_index_status.';

REVOKE EXECUTE ON FUNCTION public.dev_file_index_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_file_index_status() TO authenticated, service_role;
