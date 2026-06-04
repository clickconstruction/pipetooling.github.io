-- Schedule sync-salary-sessions Edge Function every 5 minutes via pg_cron + pg_net.
-- Prerequisites (same as send-scheduled-reminders):
--   1. pg_cron and pg_net enabled (Database > Extensions)
--   2. Vault: project_url, cron_secret
--   3. Edge Function secret CRON_SECRET matches Vault cron_secret
--   4. Edge Function sync-salary-sessions deployed

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-salary-sessions';

SELECT cron.schedule(
  'sync-salary-sessions',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-salary-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
