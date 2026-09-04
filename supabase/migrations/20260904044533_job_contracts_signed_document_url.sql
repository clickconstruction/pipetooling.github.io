SET lock_timeout = '3s';

-- File a signed contract (v2.2744): the office mostly keeps signed contracts
-- in Google Docs, so a filed record can point at the doc instead of (or as
-- well as) an uploaded scan. Additive; idempotent.

ALTER TABLE public.job_contracts
  ADD COLUMN IF NOT EXISTS signed_document_url text;

COMMENT ON COLUMN public.job_contracts.signed_document_url IS
  'Link to the signed document the office filed (Google Docs / Drive expected; any https link accepted). Set with signer_mode = ''paper''; paper_upload_path may also be set.';
