SET lock_timeout = '3s';

-- Test reports dial B (v2.3316): pg_cron calls auto-send-test-reports every
-- ten minutes with the vault CRON_SECRET (the billed-report-email pattern,
-- 20260803100000). The function itself decides whether to send anything —
-- Settings → Test reports → "Send PASS reports automatically" is the switch,
-- off by default — so scheduling it is safe on its own.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-send-test-reports';

SELECT cron.schedule(
  'auto-send-test-reports',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/auto-send-test-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
