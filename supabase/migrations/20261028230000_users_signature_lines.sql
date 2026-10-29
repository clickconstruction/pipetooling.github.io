SET lock_timeout = '3s';

-- Messages: the two lines a person keeps under their email signature (punch list #207 PR 1, v2.6038;
-- to-dos/messages-estimator-mailbox/README.md → Finding 2, the owner's call 4). An email from the reply box signs
-- with the account's name, title (users.title, 20261012190000) and cell (users.phone), then these lines: the
-- company's email, a licence number, or nothing. The app writes nothing after them; the owner's "Email back, text,
-- or call." left the generated signature with this PR, and he types it into his own lines if he wants it.
--
--   * users.signature_lines: text[], two at most (users_signature_lines_two, added by name when missing). Null or
--     empty: no lines. Each line is held to 80 characters by the app (SIGNATURE_LINE_MAX in
--     src/lib/messages/signature.ts), as the title is by users_title_short.
--   * The column is granted on its own, as title was: prod grants UPDATE on users column by column, and the
--     own-profile policy ("Users can update own profile") keeps the write to each person's own row.
--     users_guard_privileged_columns does not name it, so it is a plain profile field.
--   * No table is made, so no fence call. The client reads the column fail-soft (src/lib/messages/signatureIo.ts:
--     without it the card saves the title alone and says the lines arrive with the next update, and an email signs
--     without them), so the client deploys first and this is pushed after the merge.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signature_lines text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_signature_lines_two' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_signature_lines_two CHECK (signature_lines IS NULL OR cardinality(signature_lines) <= 2);
  END IF;
END $$;

GRANT UPDATE (signature_lines) ON public.users TO authenticated;

COMMENT ON COLUMN public.users.signature_lines IS
  'Messages (punch list #207): the two lines under the person''s email signature, after the name, the title and the cell. Null or empty: none. Two at most; the app holds each to 80 characters.';
