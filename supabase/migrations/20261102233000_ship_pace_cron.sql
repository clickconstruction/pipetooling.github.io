SET lock_timeout = '3s';

-- How fast a change ships (v2.6399): the cron that keeps Settings → How fast a change ships current. Every
-- 15 minutes it POSTs /functions/v1/ship-pace with the cron secret (Vault PROJECT_URL and CRON_SECRET, as the
-- file-index-sweep is scheduled); the function reads the repository's pull requests and the merge queue from
-- GitHub with its own token and writes one app_settings row (ship_pace_v1), which every office screen reads in
-- place of GitHub. The minute slot (9, 24, 39, 54) shares no minute with the five-minute, ten-minute or
-- quarter-hour crons already scheduled. Unscheduled first if it exists, so a second run leaves one row. No table,
-- so no fence calls. See docs/migrations/20261102233000_ship_pace_cron.md.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ship-pace';

SELECT cron.schedule(
  'ship-pace',
  '9,24,39,54 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/ship-pace',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
