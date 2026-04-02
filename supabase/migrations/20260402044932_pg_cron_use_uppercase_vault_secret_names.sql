-- Vault stores names CRON_SECRET and PROJECT_URL (Dashboard default casing).
-- Prior cron definitions used lowercase cron_secret / project_url; those subqueries
-- returned NULL, so X-Cron-Secret and URL were wrong. Reschedule both jobs.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('send-scheduled-reminders', 'sync-salary-sessions');

SELECT cron.schedule(
  'send-scheduled-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/send-scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'sync-salary-sessions',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/sync-salary-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
