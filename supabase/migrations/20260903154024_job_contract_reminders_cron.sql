SET lock_timeout = '3s';

-- Contract Desk PR 5 (v2.2690): automatic reminders for contracts out for
-- signature. pg_cron calls the remind-job-contracts edge function hourly
-- (the crew-day-email-dispatch precedent: PROJECT_URL + CRON_SECRET from
-- vault); the function drains job_contracts rows whose next_reminder_at is
-- due, emails the durable link, and advances reminder_count (3 days apart,
-- up to 3). Kill switch without unscheduling: app_settings key
-- job_contract_reminders_disabled_v1 = '1'. Idempotent.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'job-contract-reminders';

SELECT cron.schedule(
  'job-contract-reminders',
  '23 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/remind-job-contracts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
