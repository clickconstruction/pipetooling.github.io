SET lock_timeout = '3s';

-- State roll, the weekly pull (punch list #411, step one). The edge function license-roll-pull reads one of the
-- plumbing board's free licensee files a call. Four jobs post it once a file every Monday, five minutes apart, so
-- the board gets one request at a time: 12:30 UTC is 6:30 AM Central in winter and 7:30 in summer, before the
-- office opens. Weekly is enough: the board refreshes its two largest files about weekly.
--
-- The apprentice file is not pulled. It is read only for our own people's numbers, which is step two.
--
-- No table, so no fence call. Safe to run twice: each job is unscheduled before it is scheduled.

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT * FROM (VALUES
      ('license-roll-pull-rmp', '30 12 * * 1', 'RMP'),
      ('license-roll-pull-mp',  '35 12 * * 1', 'MP'),
      ('license-roll-pull-jp',  '40 12 * * 1', 'JP'),
      ('license-roll-pull-tp',  '45 12 * * 1', 'TP')
    ) AS j(name, schedule, file)
  LOOP
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = v_job.name;
    PERFORM cron.schedule(v_job.name, v_job.schedule, format($job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/license-roll-pull',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')),
        body := jsonb_build_object('file', %L)) AS request_id;
    $job$, v_job.file));
  END LOOP;
END $$;
