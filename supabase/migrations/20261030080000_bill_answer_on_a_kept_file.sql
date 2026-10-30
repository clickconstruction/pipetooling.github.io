SET lock_timeout = '3s';

-- Supply-house bill capture (punch list #179, v2.6141): an answer on a bill. `message_attachments.paper_answer` was
-- born for the trade partner's W-9 and certificate offers (20261013080000_messages_email_in.sql), so a check let it be
-- set only on a file the reader guessed was one (`paper`). A bill on a supply house's thread carries no guess, so both of
-- its answers were refused with 23514: *Not a bill* ('not_it') failed in words, and *Record this bill*'s 'filed', written
-- after Save, failed quietly, leaving the offer under a bill already on a row.
--
-- The answer is now allowed on a guessed paper, or on a file we keep a copy of: the thread offers a bill only on a kept
-- PDF or picture. A link, or a file left in Gmail, still takes none (a link never has a copy, by
-- message_attachments_link_or_file).
--
-- NOT VALID, then VALIDATE: the add holds its lock for a moment only, and the read of the rows takes a lock that lets
-- reads and writes go on. Every row passes, since the old check was the stricter one.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_attachments_answer_to_an_offer' AND conrelid = 'public.message_attachments'::regclass
  ) THEN
    ALTER TABLE public.message_attachments
      ADD CONSTRAINT message_attachments_answer_to_an_offer
      CHECK (paper_answer IS NULL OR paper IS NOT NULL OR bucket_path IS NOT NULL) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.message_attachments DROP CONSTRAINT IF EXISTS message_attachments_answer_to_a_guess;

ALTER TABLE public.message_attachments VALIDATE CONSTRAINT message_attachments_answer_to_an_offer;
