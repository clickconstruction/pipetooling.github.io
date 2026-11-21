SET lock_timeout = '3s';

-- Documents → Agreements, a copy to the signer and a PDF of a plain paper (punch list #376, What is left, row 2).
--
-- A form has made a PDF since the forms train (form_pdf_storage_path, in the contract-form-pdfs bucket). A paper of
-- plain words or clauses made none, and nobody was emailed once a person signed. Two columns on the paper's own row:
--
--   signed_pdf_storage_path  where the PDF of a signed plain or clause paper is kept, beside the forms' in the same
--                            bucket (<paper id>/signed-paper.pdf). Written by the service role when the paper is
--                            signed, or the first time someone opens an older signed paper's PDF.
--   signed_copy_sent_at      when the signer was emailed their copy. Null for a paper signed before this, for one
--                            signed with no address on it, and for a kind that is never emailed.
--
-- No table is created, so there are no fence calls. No bucket and no policy changes: the bucket is read through
-- signed links the functions make as the service role. Existing rows get nulls, and nobody is emailed about an old
-- paper. Idempotent.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS signed_pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS signed_copy_sent_at timestamptz;

COMMENT ON COLUMN public.person_contract_documents.signed_pdf_storage_path IS 'The PDF of a signed paper of plain words or clauses, in the contract-form-pdfs bucket. A form keeps its own in form_pdf_storage_path.';
COMMENT ON COLUMN public.person_contract_documents.signed_copy_sent_at IS 'When the signer was emailed their signed copy. Null when nobody was.';
