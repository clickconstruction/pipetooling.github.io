SET lock_timeout = '3s';

-- GC mode, Owner Billing's O10b (v2.5148): gc-office-notices hourly at :13, its own lane (the precedent of
-- bid-followup-reminders, 20261002160000). The function waits for 8 AM office time and does nothing while
-- app_settings gc_office_notices_on_v1 is off. Vault PROJECT_URL and CRON_SECRET, uppercase.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gc-office-notices';

SELECT cron.schedule(
  'gc-office-notices',
  '13 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gc-office-notices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
