SET lock_timeout = '3s';

-- Messages → My email (punch list #230, v2.6290, a privacy fix): a record of every imitation. Imitate and View as (the
-- login-as-user edge function) hand a dev, a master or an assistant a real magic-link session as another account,
-- and that session's JWT is the person's own, so My email's gate (gc_office_team(), users.my_mail_on) let it read the
-- person's own mailbox. From this migration on, login-as-user writes one row here as the service role before it hands
-- out the link, and opens no imitation it cannot record; gmail-mine reads the rows back as the service role and refuses
-- a session whose magic-link sign-in (the JWT's amr) follows an imitation of the same person (src/lib/myMail/imitation.ts).
--
--   * user_imitations: who imitated (operator_id, kept null once that account is deleted), whom (target_id, the rows
--     going with the person) and when. Read by a dev alone; written by the service role alone, never by anyone signed in.
--
-- Idempotent and additive: a new table, its index and its one policy. The three fence calls close the file.

CREATE TABLE IF NOT EXISTS public.user_imitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_imitations IS
  'Imitate and View as (punch list #230, v2.6290): one row per imitation, written by the login-as-user edge function as the service role before it hands out the magic link (no row, no link). gmail-mine refuses a magic-link session that follows a row of the same person, so My email never reads a person''s mail in a session someone else opened. Read by a dev alone.';
COMMENT ON COLUMN public.user_imitations.operator_id IS
  'Imitate and View as: who imitated (the dev, master or assistant signed in to login-as-user). Null once that account is deleted.';
COMMENT ON COLUMN public.user_imitations.target_id IS
  'Imitate and View as: whose account the session was opened as. The rows go with the person.';
COMMENT ON COLUMN public.user_imitations.created_at IS
  'Imitate and View as: when the link was made, before it was used. gmail-mine reads back 24 hours from a magic-link sign-in, and 5 minutes past it.';

CREATE INDEX IF NOT EXISTS user_imitations_target_recent ON public.user_imitations (target_id, created_at DESC);

ALTER TABLE public.user_imitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_imitations_dev_reads ON public.user_imitations;
CREATE POLICY user_imitations_dev_reads ON public.user_imitations FOR SELECT TO authenticated
  USING (public.is_dev());

-- The project's default privileges hand every new table to anon and authenticated whole; take them back. A dev reads;
-- nobody signed in writes (no INSERT, UPDATE or DELETE policy either); login-as-user writes as the service role.
REVOKE ALL ON TABLE public.user_imitations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_imitations TO authenticated;
GRANT ALL ON TABLE public.user_imitations TO service_role;

-- House rules: read-only training mode and the twin write fence cover the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
