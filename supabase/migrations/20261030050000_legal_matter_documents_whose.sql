SET lock_timeout = '3s';

-- Punch list #214 (v2.6106, PR 3a): whose paper a Legal desk document is.
--
-- The Evidence tab lists a matter's documents in the order they were added, each a title and one
-- line on what it shows. A live account on 2026-10-29 held 39 of them, and the firm's first three
-- asks — the contract, the notice, the reply — sat scattered among supplier invoices and screenshots.
-- A lawyer reads a file by whose paper it is: theirs, ours, the public record, the supplier's, and
-- the rest. One nullable column carries that, picked when a paper is added and settable later; null
-- is the rest, "our record". The next PR groups the Evidence tab by it and guesses a group from the
-- title for the rows already there, without writing the guess back.
--
--   whose   theirs · ours · public · supplier · null (our record)
--
-- Additive and idempotent; no table is created, so no fence is owed. The office roles already update
-- the table; no policy change. The column goes first, on its own, so the client that reads it never
-- meets a database without it.

ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS whose text;

DO $$
BEGIN
  ALTER TABLE public.legal_matter_documents ADD CONSTRAINT legal_matter_documents_whose_check CHECK (whose IS NULL OR whose IN ('theirs', 'ours', 'public', 'supplier')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matter_documents VALIDATE CONSTRAINT legal_matter_documents_whose_check;

COMMENT ON COLUMN public.legal_matter_documents.whose IS 'Whose paper it is, for the Evidence tab''s grouping (v2.6106): theirs (the payer''s), ours, public (the City''s, the county''s, a board''s), supplier (a supply house''s); null is our own record (proposals, affidavits, captures).';
