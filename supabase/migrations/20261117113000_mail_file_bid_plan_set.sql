SET lock_timeout = '3s';

-- v2.7531 (punch list #368, PR 1): a mail's file kept as a set of plans on a bid.
--
-- An addendum or a revised spec reaches a bid by mail. The mail is tied to the bid and reads on its history, but its
-- files stay on the line in Messages while the estimators and the robot read the bid's plans in Drive. The press on
-- the mail (bid-plan-set-files) files what the mail carries into the bid's project folder, under Plans, and adds a
-- bid_plan_sets row. This column is the record of that, kept on the file's own row:
--
--   * message_attachments.bid_plan_set_id: the set of plans this file was filed into. The function writes it as the
--     service role, and only once the file is in the set's Drive folder, so a mail never reads as kept on a file that
--     is not there. The office holds UPDATE on paper_answer alone, so no signed-in client can set or clear it.
--   * It is per file, not per mail: a mail with three files may have two kept, and a later mail may add a sheet to a
--     set an earlier mail made. A mail reads as kept from its files, and a set reads as from a mail from the files
--     that point at it.
--   * ON DELETE SET NULL: a set removed from the bid takes the mark off, and the mail offers the press again.
--
-- The constraint is added NOT VALID and validated after, so the wait for message_attachments is the column's own
-- (a catalog change) and the check of the rows runs under the lighter lock. Every row's value is null today.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, a constraint added only when it is missing, CREATE INDEX IF NOT EXISTS.
-- No table is created, so no fence is owed.

ALTER TABLE public.message_attachments ADD COLUMN IF NOT EXISTS bid_plan_set_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_attachments_bid_plan_set_fk' AND conrelid = 'public.message_attachments'::regclass
  ) THEN
    ALTER TABLE public.message_attachments
      ADD CONSTRAINT message_attachments_bid_plan_set_fk
      FOREIGN KEY (bid_plan_set_id) REFERENCES public.bid_plan_sets(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.message_attachments VALIDATE CONSTRAINT message_attachments_bid_plan_set_fk;

COMMENT ON COLUMN public.message_attachments.bid_plan_set_id IS
  'The set of plans on a bid this file was filed into (v2.7531, punch list #368): written by bid-plan-set-files as the service role once the file is in the set''s Drive folder. A mail reads as kept from it and a set as from a mail. Null on every other file; a removed set clears it.';

-- The set's files, for the chip on the bid's Plan sets and the set's door back to its mail.
CREATE INDEX IF NOT EXISTS message_attachments_bid_plan_set ON public.message_attachments (bid_plan_set_id) WHERE bid_plan_set_id IS NOT NULL;
