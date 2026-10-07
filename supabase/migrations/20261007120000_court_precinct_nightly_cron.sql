SET lock_timeout = '3s';

-- Which court, step 4 (v2.4770): every night, put each property record in its justice
-- precinct from the office's own court map (court_areas, migration 20261007110000).
-- Same shape as lien-pay-offer-nightly (20261007020000): vault PROJECT_URL + CRON_SECRET.
-- 06:20 UTC, after owner-confirm-nightly has filled the geocode cache for the night's
-- new addresses. The Map page's "Classify now" calls the same function by hand.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'court-precinct-nightly';

SELECT cron.schedule(
  'court-precinct-nightly',
  '20 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/court-precinct-nightly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
