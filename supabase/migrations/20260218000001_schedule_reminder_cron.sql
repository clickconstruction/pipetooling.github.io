-- Schedule send-scheduled-reminders Edge Function every 15 minutes via pg_cron + pg_net.
-- Prerequisites:
--   1. Enable pg_cron and pg_net in Supabase Dashboard (Database > Extensions)
--   2. Add to Vault (Database > Vault): project_url, cron_secret
--   3. Set Edge Function secret: supabase secrets set CRON_SECRET=<same value as vault cron_secret>

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'send-scheduled-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
