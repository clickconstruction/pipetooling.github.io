SET lock_timeout = '3s';

-- Messages, cut 5, PR D: the cron of the morning run of the reminders the app sends itself (messages-nudge-dispatch,
-- docs/EDGE_FUNCTIONS.md → messages-nudge-dispatch, v2.5442). Pushed only after the function is deployed (2026-10-14),
-- so the cron never posts to a function that is not there.
--
-- It fires at 14:00 and 15:00 UTC. One of the two is 9 AM Central in summer and the other in winter, and the function
-- runs only the tick that is 9 AM (runHourNow); the other answers { ran: false }. It posts every morning, switched on
-- or not, so the summary in app_settings messages_nudge_last_run_v1 says what was kept back and why. A text goes only
-- for a step the owner turned on (messages_nudge_app_sends_v1, {} as it shipped) and only while Send texts is on
-- (messages_texts_on_v1).

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'messages-nudge-dispatch';

SELECT cron.schedule(
  'messages-nudge-dispatch',
  '0 14,15 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/messages-nudge-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
