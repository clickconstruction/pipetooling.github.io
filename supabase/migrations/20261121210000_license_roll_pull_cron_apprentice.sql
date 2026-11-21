SET lock_timeout = '3s';

-- State roll, the apprentice file for our own people (punch list #411, step two). license-roll-pull now reads the
-- plumbing board's apprentice file, PA, for one thing: the numbers of our own apprentices, so their licenses can be
-- checked against the state's. It keeps no other apprentice. A fifth Monday job posts it, five minutes after the
-- tradesman file, so the board still gets one request at a time: 12:50 UTC.
--
-- No table, so no fence call. Safe to run twice: the job is unscheduled before it is scheduled.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'license-roll-pull-pa';
SELECT cron.schedule('license-roll-pull-pa', '50 12 * * 1', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/license-roll-pull',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')),
    body := jsonb_build_object('file', 'PA')) AS request_id;
$job$);
