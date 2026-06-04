-- Reconciliation safety net for missed Mercury webhook deliveries.
-- Webhooks handle the ~1s "swipe -> appears" path; this slow sweep re-syncs a
-- short window every 30 minutes to repair any dropped/missed webhook deliveries.
-- Prerequisites (same as sync-salary-sessions):
--   1. pg_cron + pg_net enabled
--   2. Vault: project_url, cron_secret
--   3. Edge Function secret CRON_SECRET matches Vault cron_secret
--   4. sync-mercury-transactions deployed WITH the X-Cron-Secret bypass branch

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-mercury-transactions';

SELECT cron.schedule(
  'sync-mercury-transactions',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-mercury-transactions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{"lookback_days": 2}'::jsonb
  ) AS request_id;
  $$
);
