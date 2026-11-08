SET lock_timeout = '3s';

-- Messages: an email as rich text (punch list #259, PR 1, v2.6675). The bids@ reader (gmail-sync) keeps each inbound
-- email's words as text and its links as message_attachments rows; from this version it also keeps the mail's HTML
-- part, as it came, at <line id>/body.html in the private message-attachments bucket, after the line is written. One
-- nullable column on the line names that path, so the message window knows an HTML body exists without a bucket
-- list, and draws Rich text · Plain (PR 2) only on a line that has one. Older lines stay null and plain: no back-fill.
--
-- Not a column of HTML: a thread's read brings every line's row, and the part most lines never open would make each
-- read 20 to 200 KB heavier a line. The bucket's office SELECT policy (20261013080000) covers the new path as it covers
-- the files; the service role writes it.
--
-- Additive, idempotent. No table created, so no fence is owed. docs/migrations/20261108020000_messages_body_html_path.md.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS body_html_path text;

COMMENT ON COLUMN public.messages.body_html_path IS
  'Punch list #259 (v2.6675): where the bids@ reader kept this email''s HTML part in the message-attachments bucket, <line id>/body.html. Null on a line with no HTML part, one read before this version, a text, a call, a note. The message window draws Rich text when it is set.';
