SET lock_timeout = '3s';

-- One Drive folder per job, under its customer (v2.6284, the owner's rule of 2026-11-01): the folder sweep's stamps and
-- its cron. `job-drive-folders` → `sweep` places each live job's folder in the tree (root › customer › job), moving and
-- renaming what Drive lets it, and writes when it last looked and why a job is held, so the office reads the hold on the
-- row without running anything.
--
--   * jobs_ledger.drive_folder_tidied_at — when the sweep (or the press) last placed this job's folder.
--   * jobs_ledger.drive_folder_hold      — why the folder could not be placed (outside the Shared Drive, not a folder,
--                                          not shared with the app); null once it sits in the tree.
--   * A cron row, job-drive-folders-sweep, every 10 minutes: POST /functions/v1/job-drive-folders { sweep: {} } with the
--     cron secret (Vault PROJECT_URL and CRON_SECRET, as photo-save's cron is scheduled). It calls only while some live
--     job has never been placed or was placed more than seven days ago, so a tidy tree makes no call at all.
--   * Unscheduled first if it exists, so a second run leaves one row.

ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS drive_folder_tidied_at timestamptz;
ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS drive_folder_hold text;

COMMENT ON COLUMN public.jobs_ledger.drive_folder_tidied_at IS 'When the folder sweep or the press last placed this job''s Drive folder in the tree (root › customer › job); null = never looked at.';
COMMENT ON COLUMN public.jobs_ledger.drive_folder_hold IS 'Why the job''s Drive folder could not be placed in the tree, in the office''s words; null once it sits where it should.';

CREATE INDEX IF NOT EXISTS jobs_ledger_drive_folder_tidied_at_idx ON public.jobs_ledger (drive_folder_tidied_at NULLS FIRST) WHERE status IS NULL OR status <> 'paid';

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'job-drive-folders-sweep';

SELECT cron.schedule(
  'job-drive-folders-sweep',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/job-drive-folders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"sweep":{}}'::jsonb
  ) AS request_id
  WHERE EXISTS (
    SELECT 1 FROM public.jobs_ledger
    WHERE (status IS NULL OR status <> 'paid')
      AND (drive_folder_tidied_at IS NULL OR drive_folder_tidied_at < now() - interval '7 days')
  );
  $$
);
