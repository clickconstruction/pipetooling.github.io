SET lock_timeout = '3s';

-- A mail conversation onto an HR file (punch list #289, v2.6715): the dev seat's mail tag (plan_mail_tag →
-- apply_mail_tag, v2.6568) takes a person as its target, and each mail of the conversation lands as a dated entry on
-- that person's file. Two things the database learns:
--
--   * person_file_entries.gmail_message_id / gmail_thread_id: which mail an entry came from, in which login's box, so a
--     thread tagged twice adds only the mails it has not seen (the partial unique index is the dedupe key, per person),
--     the follow finds what is already on the file by the Gmail id alone, and a dev with the seat can read the mail
--     back (read_mail account, id). Null on every entry written any other way. Gmail's ids are per mailbox, so the same
--     mail tagged out of two logins' boxes is two entries; the plan says which box it reads.
--   * email_tag_threads.person_id: the follow's row for a person-tagged conversation, beside the job columns, exactly
--     one of the four set (the check email_tag_threads_one_target takes the place of _one_job). user_id stays whose box
--     the conversation is in; tagged_by is the dev who applied, and the entries name them (created_by, author_label).
--     The office team reads the job rows as before and never a person row: an HR file's existence is the devs' alone
--     (docs/HR_FILES.md), so the read policy closes the person rows to everyone but a dev.
--
-- The cron gmail-mine-follow already posts while any row's greatest(last_mail_at, tagged_at) is inside 60 days, so a
-- person row is followed by the same schedule. No table is created, so no fence is owed. Idempotent: columns and
-- indexes only when missing, the checks dropped by name and added again, the policy dropped and made again.

ALTER TABLE public.person_file_entries ADD COLUMN IF NOT EXISTS gmail_message_id text;
ALTER TABLE public.person_file_entries ADD COLUMN IF NOT EXISTS gmail_thread_id text;

COMMENT ON COLUMN public.person_file_entries.gmail_message_id IS
  'HR files (punch list #289): Gmail''s id of the mail this entry was made from by the dev seat''s mail tag, in the box email_tag_threads.user_id names; null on an entry written any other way. One entry per person and Gmail id (person_file_entries_gmail_once).';
COMMENT ON COLUMN public.person_file_entries.gmail_thread_id IS
  'HR files (punch list #289): Gmail''s id of the conversation the mail belongs to, the one email_tag_threads follows for later mail.';

CREATE UNIQUE INDEX IF NOT EXISTS person_file_entries_gmail_once
  ON public.person_file_entries (person_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

ALTER TABLE public.email_tag_threads ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.email_tag_threads.person_id IS
  'HR files (punch list #289): the person whose file a conversation is tagged onto by the dev seat (plan_mail_tag with person), in place of a job; its mail lands as person_file_entries rows and later mail follows as the job tag''s does. Read by devs alone.';

ALTER TABLE public.email_tag_threads DROP CONSTRAINT IF EXISTS email_tag_threads_one_job;
ALTER TABLE public.email_tag_threads DROP CONSTRAINT IF EXISTS email_tag_threads_one_target;
ALTER TABLE public.email_tag_threads ADD CONSTRAINT email_tag_threads_one_target
  CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id, person_id) = 1);

CREATE INDEX IF NOT EXISTS email_tag_threads_person ON public.email_tag_threads (person_id) WHERE person_id IS NOT NULL;

-- The office team reads the job rows as before; a person row is a dev's to read.
DROP POLICY IF EXISTS email_tag_threads_team_reads ON public.email_tag_threads;
CREATE POLICY email_tag_threads_team_reads ON public.email_tag_threads FOR SELECT TO authenticated
  USING ((person_id IS NULL AND (SELECT public.gc_office_team())) OR (SELECT public.is_dev()));

COMMENT ON TABLE public.email_tag_threads IS
  'Messages → My email (punch list #230): a Gmail conversation a person tagged from their own box onto one job (bid_id, project_id or jobs_ledger_id), or, since punch list #289, one the dev seat tagged onto a person''s HR file (person_id) — exactly one of the four set; who tagged it and when. Its mail lands as lines (messages.mailbox mine, mail_user_id the person) or as person_file_entries rows; later mail follows by itself (last_read_at, last_error). The office team reads the job rows, devs the person rows; written by the gmail-mine edge function as the service role.';
