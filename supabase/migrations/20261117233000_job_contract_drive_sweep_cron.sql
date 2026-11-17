SET lock_timeout = '3s';

-- Signed contracts in Google Drive (punch list #377, PR 4): the sweep, switched on. job-contract-drive files each signed
-- job contract in its job's Drive folder (20261117213000 gave the row its Drive columns); until now only a press ran it.
-- This cron row, job-contract-drive-sweep, calls it every 10 minutes with the cron secret (Vault PROJECT_URL and
-- CRON_SECRET, as job-drive-folders-sweep is scheduled), six minutes past the folder sweep's slot, so a job's folder is
-- usually placed before its contract looks for it.
--
-- It calls only while a paper is due, so a quiet office makes no call at all:
--   * a signed paper in force with no Drive copy that was never tried, or was left with no reason, or was held and last
--     tried over an hour ago (the function's own rule, CONTRACT_HOLD_RETRY_MINUTES in _shared/jobContractDrive.ts);
--   * a voided paper whose filed copy has not been renamed to start with VOIDED.
-- The backfill is the same call: every signed paper already on file is due the first time it runs.
-- Unscheduled first if it exists, so a second run leaves one row. No table and no column: nothing to fence.
-- See docs/migrations/20261117233000_job_contract_drive_sweep_cron.md.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'job-contract-drive-sweep';

SELECT cron.schedule(
  'job-contract-drive-sweep',
  '6,16,26,36,46,56 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/job-contract-drive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"sweep":{}}'::jsonb
  ) AS request_id
  WHERE EXISTS (
    SELECT 1 FROM public.job_contracts
    WHERE (
        status = 'signed' AND voided_at IS NULL AND drive_file_id IS NULL
        AND (drive_file_tried_at IS NULL OR drive_file_hold IS NULL OR drive_file_tried_at < now() - interval '60 minutes')
      )
      OR (
        voided_at IS NOT NULL AND drive_file_id IS NOT NULL AND drive_file_origin = 'filed' AND drive_void_marked_at IS NULL
      )
  );
  $$
);
