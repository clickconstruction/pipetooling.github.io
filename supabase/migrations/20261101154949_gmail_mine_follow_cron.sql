SET lock_timeout = '3s';

-- Messages → My email (punch list #230 PR 4, to-dos/messages-my-email/README.md, "3 · Who tags" → The conversation
-- follows): later mail in a tagged conversation lands on the job by itself. Every five minutes the cron posts
-- { "action": "follow" } to the gmail-mine edge function with the vault's CRON_SECRET, as the gmail-sync row posts. The
-- function reads, as each person whose switch is on, the conversations they tagged that were read (or tagged and not
-- yet read) in the last 60 days, 100 a run, and lands each mail no line holds yet as a tag lands it.
--
-- The post goes out only while some tagged conversation is in that window, so nothing posts while nothing is tagged.
-- No table is created, so no fence is owed. Idempotent: unschedule by name, then schedule.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gmail-mine-follow';

SELECT cron.schedule(
  'gmail-mine-follow',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gmail-mine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"action":"follow"}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.email_tag_threads WHERE coalesce(last_read_at, tagged_at) > now() - interval '60 days');
  $$
);
