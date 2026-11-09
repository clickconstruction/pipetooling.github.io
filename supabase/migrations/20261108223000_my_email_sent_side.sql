SET lock_timeout = '3s';

-- Messages → My email, the Sent side with no press (punch list #263 PR B, call 2, v2.6751; to-dos/messages-my-email-doors/README.md).
-- gmail-mine's follow (the cron gmail-mine-follow, every five minutes) gains a second read: for each person whose switch
-- is on, the mail they sent from their own box since the last run. A mail to an address that is on exactly one open job,
-- or whose domain is one customer's with one open job (the guess's own steps 3 and 4), lands on that job as ours under
-- the person, marked as put there by the app, and later mail in the conversation follows as a tag's does. A mail to
-- nobody the app knows lands nowhere; the Inbox keeps its press.
--
--   * users.my_mail_sent_read_at: the per-person cursor, the newest sent mail the follow has read. Null until the first
--     run, which sets it to now and reads nothing (no backfill, as gmail-sync's first run reads nothing old).
--   * email_tag_threads.placed_by_app: the row the follow made from a sent mail, with no press. The thread line says so,
--     and an untag of such a row leaves a tombstone.
--   * messages.placed_by_app: the lines the follow wrote from a sent mail, set by an UPDATE after email_write_line
--     answers written (as body_html_path is set after the write). The thread line draws the grey mark and Untag on it.
--   * email_tag_threads_off: the tombstone. A conversation the person untagged after the app placed it is never placed
--     by the app again; a tag of it by hand deletes the tombstone. Read and written by gmail-mine as the service role
--     alone; nobody signed in reads or writes it.
--
-- Idempotent and additive. The hot tables are altered last, messages and then users, each lock held for the shortest
-- stretch before the commit; the four fence calls close the file, as every CREATE TABLE migration's do.

-- ---------- the tombstone ----------

CREATE TABLE IF NOT EXISTS public.email_tag_threads_off (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gmail_thread_id text NOT NULL
    CONSTRAINT email_tag_threads_off_thread_named CHECK (btrim(gmail_thread_id) <> ''),
  untagged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, gmail_thread_id)
);

COMMENT ON TABLE public.email_tag_threads_off IS
  'Messages → My email (punch list #263, v2.6751): a Gmail conversation the person untagged after the app placed it from their Sent. The follow never places it by itself again; a tag by hand deletes the row. Written and read by the gmail-mine edge function as the service role alone.';

ALTER TABLE public.email_tag_threads_off ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_tag_threads_off FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.email_tag_threads_off TO service_role;

-- ---------- the row the app placed ----------

ALTER TABLE public.email_tag_threads ADD COLUMN IF NOT EXISTS placed_by_app boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.email_tag_threads.placed_by_app IS
  'Messages → My email (punch list #263, v2.6751): true when the follow made the row from a mail the person sent, with no press; false on a tag by hand. An untag of a placed row leaves a tombstone (email_tag_threads_off).';

-- ---------- the lines the app placed ----------

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS placed_by_app boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.messages.placed_by_app IS
  'Messages → My email (punch list #263, v2.6751): true on a line gmail-mine''s follow wrote from a mail the person sent, with no press (mailbox mine, mail_user_id the person). The thread line reads from <name>''s mail · put here by the app, with Untag for that person.';

-- ---------- the per-person cursor ----------

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS my_mail_sent_read_at timestamptz;

COMMENT ON COLUMN public.users.my_mail_sent_read_at IS
  'Messages → My email (punch list #263, v2.6751): the newest mail of the person''s Sent the follow has read for a job to land it on. Null until the first run, which sets it to now and reads nothing older. Written by gmail-mine as the service role.';

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
