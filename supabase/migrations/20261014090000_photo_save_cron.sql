SET lock_timeout = '3s';

-- Messages, cut 10 (photos saved on arrival, v2.5464): the photo-save sweep's cron, after the function is deployed.
--
--   * A cron row, photo-save, every 5 minutes: POST /functions/v1/photo-save with the cron secret (Vault PROJECT_URL and
--     CRON_SECRET, uppercase, as gmail-sync's and mail-poll's crons are scheduled). It calls only while some job's tick
--     is on (photo_saves.on_since, 20261014070000), so an office with no tick on makes no call at all.
--   * Unscheduled first if it exists, so a second run leaves one row.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'photo-save';

SELECT cron.schedule(
  'photo-save',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/photo-save',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.photo_saves WHERE on_since IS NOT NULL);
  $$
);
