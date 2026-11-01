SET lock_timeout = '3s';

-- Messages → My email (punch list #230, a follow-up to PR 4's 20261101154949_gmail_mine_follow_cron.sql): the follow's
-- 60-day window keys on the conversation's newest mail, not on its last read. PR 4 followed a tagged conversation while
-- coalesce(last_read_at, tagged_at) was within 60 days, and every good read moved last_read_at, so a conversation that
-- still read was followed for good: the cron posted every five minutes for as long as anything was ever tagged.
--
--   * email_tag_threads.last_mail_at: the newest mail in the conversation when gmail-mine last tagged it or read it
--     well (Gmail's internalDate; a draft, Spam, Trash and a chat left out). The tag sets it, and a good read of the
--     follow moves it forward, never back. Null on a row tagged before this push until the follow first reads it.
--   * The window: a conversation is followed while its newest mail, or its tag when that is later, is younger than 60
--     days, greatest(last_mail_at, tagged_at). A tag holds its conversation for the whole window even when its newest
--     mail is older, since the tag's grey line says later mail lands by itself; after that, while mail keeps coming.
--   * gmail-mine-follow is scheduled again with that gate, the same post as PR 4's, so nothing posts once every tagged
--     conversation has gone quiet.
--   * email_tag_threads.last_read_at's comment: since this change a failed read sets it too, beside last_error, and the
--     follow reads the least recently read first, so every row takes its turn. Ordered failed-last, as PR 4 read them,
--     a run's worth of healthy rows kept a row that failed once out of every later run for good.
--
-- No table is created, so no fence is owed. Idempotent: the column and its index only when missing; the cron row
-- unscheduled by name, then scheduled.
ALTER TABLE public.email_tag_threads ADD COLUMN IF NOT EXISTS last_mail_at timestamptz;

COMMENT ON COLUMN public.email_tag_threads.last_mail_at IS
  'Messages → My email (punch list #230): the newest mail in the conversation when gmail-mine last tagged it or read it well (Gmail''s internalDate; drafts, Spam, Trash and chats left out; the tag''s own time when no mail has one). The follow stops 60 days after it, or after tagged_at when that is later. Moved forward by a good read, never back.';

COMMENT ON COLUMN public.email_tag_threads.last_read_at IS
  'Messages → My email (PR 4): when gmail-mine''s follow last read the conversation for mail not yet a line, a failed read too (last_error says why), so every row takes its turn. A tag clears it, so the next run reads the conversation first.';

CREATE INDEX IF NOT EXISTS email_tag_threads_last_mail ON public.email_tag_threads (last_mail_at);

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
  WHERE EXISTS (SELECT 1 FROM public.email_tag_threads WHERE greatest(last_mail_at, tagged_at) > now() - interval '60 days');
  $$
);
