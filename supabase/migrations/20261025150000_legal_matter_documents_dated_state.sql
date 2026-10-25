SET lock_timeout = '3s';

-- Punch list #168 (v2.5846): a Legal desk document carries the day the paper is from, and whether it
-- is a draft, final, sent or received.
--
-- A document on the desk carried a title, one line on what it shows, and the day it was uploaded; the
-- Timeline put it on the upload day, and nothing said whether a letter was a draft, went out, or came
-- in. On job 891 the subcontract signed in May sat on Oct 24, and three drafted letters read like
-- evidence in hand. Seven nullable or defaulted columns on legal_matter_documents, no rewrite:
--
--   dated_on          the paper's own day (the Timeline places it there; null = the day it was added)
--   state             draft · final · sent · received (final by default)
--   sent_on, sent_how, sent_to, proof_document_id   the send record (the proof is another document on the matter)
--   received_on       the day a received paper came in
--
-- The owner's call of 2026-10-25: a draft is shared with the firm by default (the firm sees the Draft chip).
-- Additive and idempotent; no table is created, so no fence is owed. The office roles already update the
-- table; no policy change.

ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS dated_on date;
ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'final';
ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS sent_on date;
ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS sent_how text NOT NULL DEFAULT '';
ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS sent_to text NOT NULL DEFAULT '';
ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS proof_document_id uuid REFERENCES public.legal_matter_documents(id) ON DELETE SET NULL;
ALTER TABLE public.legal_matter_documents ADD COLUMN IF NOT EXISTS received_on date;

DO $$
BEGIN
  ALTER TABLE public.legal_matter_documents ADD CONSTRAINT legal_matter_documents_state_check CHECK (state IN ('draft', 'final', 'sent', 'received')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matter_documents VALIDATE CONSTRAINT legal_matter_documents_state_check;

DO $$
BEGIN
  ALTER TABLE public.legal_matter_documents ADD CONSTRAINT legal_matter_documents_sent_how_check CHECK (sent_how IN ('', 'email', 'certified_mail', 'mail', 'hand', 'other')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matter_documents VALIDATE CONSTRAINT legal_matter_documents_sent_how_check;

COMMENT ON COLUMN public.legal_matter_documents.dated_on IS 'v2.5846 (punch list #168): the day the paper is from; the Timeline places the document here, else on added_at. Null on rows from before.';
COMMENT ON COLUMN public.legal_matter_documents.state IS 'v2.5846: draft · final · sent · received. A draft is shared with the firm by default and wears a Draft chip.';
COMMENT ON COLUMN public.legal_matter_documents.sent_on IS 'v2.5846: the day a sent paper went out (never ahead of today).';
COMMENT ON COLUMN public.legal_matter_documents.sent_how IS 'v2.5846: how it went out — email · certified_mail · mail · hand · other; '''' when not sent.';
COMMENT ON COLUMN public.legal_matter_documents.sent_to IS 'v2.5846: who it went to, in the office''s words.';
COMMENT ON COLUMN public.legal_matter_documents.proof_document_id IS 'v2.5846: another document on the same matter that proves the send (the mailing receipt).';
COMMENT ON COLUMN public.legal_matter_documents.received_on IS 'v2.5846: the day a received paper came in.';
