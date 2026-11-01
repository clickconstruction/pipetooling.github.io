SET lock_timeout = '3s';

-- The Legal desk's Evidence door, From the job's messages… (punch list #230 PR 5, to-dos/messages-my-email/README.md,
-- section 4): the office ticks an email conversation on the account's jobs and the app puts each email of it on the
-- matter as an .eml, through the same addLegalMatterDocument the upload uses. The desk pulls; a tag in Messages never
-- writes to a matter. This column names the Messages line a document was made from, so
--   * the door reads an email already on the matter as on the matter and never puts it twice,
--   * the Evidence row's ⋯ opens the line in Messages (The line in Messages), and
--   * an untag on My email can say the matter keeps its own copy.
--
-- ON DELETE SET NULL: an untag deletes the person's lines; the matter's copy stays, its link to the line gone.
--
-- Additive and idempotent; no table is created, so no fence is owed. The office roles already insert and update the
-- table under legal_office_can_read() with table-wide grants, so the column needs no policy and no grant. The column
-- and its index go first, on the small table; the foreign key is added NOT VALID and validated last, so the hot
-- messages table is locked for the shortest stretch before the commit. Every row is null when it is validated.

ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS source_message_id uuid;

COMMENT ON COLUMN public.legal_matter_documents.source_message_id IS
  'Punch list #230 PR 5 (v2.6276): the Messages line (messages.id) an .eml on the Evidence tab was made from by the Legal desk''s From the job''s messages…; null on every other document. The door holds an email already on the matter by it, and the row''s ⋯ opens the line in Messages. Set null when the line is deleted (an untag): the matter keeps its copy.';

-- The door reads a matter's lines by it, and the foreign key's ON DELETE finds the documents of a deleted line by it.
CREATE INDEX IF NOT EXISTS legal_matter_documents_source_message_idx
  ON public.legal_matter_documents (source_message_id)
  WHERE source_message_id IS NOT NULL;

-- One live document per line on a matter: two people pressing at once put the email once, and the second press names
-- it as already on the matter. A removed document (voided_at) frees the line to go on again.
CREATE UNIQUE INDEX IF NOT EXISTS legal_matter_documents_one_per_line
  ON public.legal_matter_documents (matter_id, source_message_id)
  WHERE source_message_id IS NOT NULL AND voided_at IS NULL;

DO $$
BEGIN
  ALTER TABLE public.legal_matter_documents
    ADD CONSTRAINT legal_matter_documents_source_message_id_fkey
    FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.legal_matter_documents VALIDATE CONSTRAINT legal_matter_documents_source_message_id_fkey;
