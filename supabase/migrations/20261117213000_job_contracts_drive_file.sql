SET lock_timeout = '3s';

-- Signed contracts in Google Drive (punch list #377, PR 2): where a signed job contract's copy in Drive is, on the
-- contract's own row. A signed paper lived in the app's storage (job-contract-documents) and nowhere in Drive or the
-- file index, so Find a file could not find it. The function job-contract-drive files each signed paper in its job's
-- folder, under Team only › Contracts, or adopts the Drive file a typed link already names; these columns are what it
-- writes, and what the Contract window, Documents → Where files go and the Contract sweep's Drive pass read.
--
--   drive_file_id          the Drive file that is this paper's copy; null until it is filed.
--   drive_filed_at         when it was filed or adopted.
--   drive_file_origin      filed (the app put it there, under its own name and mark) or adopted (the office already
--                          kept it in the jobs drive; never copied, moved or renamed).
--   drive_file_hold        why it is not in Drive: one of the eight kinds in _shared/jobContractDrive.ts.
--   drive_file_hold_words  the same, in the words a person reads: the kind's own, the job's folder hold or Drive's.
--   drive_file_tried_at    when the function last tried; a held paper is taken again an hour on.
--   drive_void_marked_at   when a voided paper's copy was renamed to start with VOIDED. Only a filed copy is renamed.
--
-- No new table, so no fence calls. signed_document_url is not touched: it stays what the office typed (the owner's
-- call 7). The four office roles read and write job_contracts as before; the function writes with the service role.
-- No cron here: the sweep is switched on in a later migration, once the Drive pass knows to leave a filed copy alone.
-- See docs/migrations/20261117213000_job_contracts_drive_file.md.

ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS drive_filed_at timestamptz;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS drive_file_origin text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS drive_file_hold text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS drive_file_hold_words text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS drive_file_tried_at timestamptz;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS drive_void_marked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_contracts_drive_file_origin_known') THEN
    ALTER TABLE public.job_contracts ADD CONSTRAINT job_contracts_drive_file_origin_known
      CHECK (drive_file_origin IS NULL OR drive_file_origin IN ('filed', 'adopted'));
  END IF;
  -- A Drive copy says how it came to be, and nothing else does.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_contracts_drive_file_origin_shape') THEN
    ALTER TABLE public.job_contracts ADD CONSTRAINT job_contracts_drive_file_origin_shape
      CHECK ((drive_file_id IS NULL) = (drive_file_origin IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_contracts_drive_file_hold_known') THEN
    ALTER TABLE public.job_contracts ADD CONSTRAINT job_contracts_drive_file_hold_known
      CHECK (drive_file_hold IS NULL OR drive_file_hold IN ('no_drive', 'no_root', 'job_folder', 'open_link', 'link_outside', 'no_file', 'too_big', 'drive_refused'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_contracts.drive_file_id IS 'The Drive file that is this signed paper''s copy (#377): filed by job-contract-drive under Team only › Contracts in the job''s folder, or the office''s own file adopted where it sits. Null until then.';
COMMENT ON COLUMN public.job_contracts.drive_filed_at IS 'When the paper''s Drive copy was filed or adopted (#377).';
COMMENT ON COLUMN public.job_contracts.drive_file_origin IS 'How the Drive copy came to be (#377): filed (the app uploaded it, named and marked) or adopted (already in the jobs drive; never copied, moved or renamed).';
COMMENT ON COLUMN public.job_contracts.drive_file_hold IS 'Why the signed paper is not in Drive (#377), as a kind: no_drive, no_root, job_folder, open_link, link_outside, no_file, too_big, drive_refused. Null when it is filed or not yet tried.';
COMMENT ON COLUMN public.job_contracts.drive_file_hold_words IS 'The hold in the words a person reads (#377): the kind''s own, the job''s folder hold, or Drive''s refusal.';
COMMENT ON COLUMN public.job_contracts.drive_file_tried_at IS 'When job-contract-drive last tried to file this paper (#377). A held paper is taken again an hour on.';
COMMENT ON COLUMN public.job_contracts.drive_void_marked_at IS 'When a voided paper''s filed copy was renamed to start with VOIDED (#377). An adopted file is never renamed.';

-- The sweep's queue: signed papers in force with no Drive copy, the oldest try first.
CREATE INDEX IF NOT EXISTS job_contracts_drive_due_idx ON public.job_contracts (drive_file_tried_at NULLS FIRST)
  WHERE status = 'signed' AND voided_at IS NULL AND drive_file_id IS NULL;
-- The Drive pass and Find a file ask by Drive id.
CREATE INDEX IF NOT EXISTS job_contracts_drive_file_id_idx ON public.job_contracts (drive_file_id) WHERE drive_file_id IS NOT NULL;
