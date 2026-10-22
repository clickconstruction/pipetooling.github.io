SET lock_timeout = '3s';

-- v2.5719: the inbox reader (gmail-sync, bids@ and the team box) runs every minute instead of every 3. The owner,
-- 2026-10-21: an email that comes just before a call should be in the thread by the time the phone rings. The job's
-- statement is the one 20261013080000_messages_email_in.sql wrote (it posts only while gmail_sync_on_v1 is 'true');
-- only the schedule changes. A run takes at most 40 emails and two runs at once write one line, so a faster beat is
-- safe. Idempotent: unschedule by name, then schedule.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gmail-sync';

SELECT cron.schedule(
  'gmail-sync',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'gmail_sync_on_v1' AND value_text = 'true');
  $$
);
