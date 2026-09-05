SET lock_timeout = '3s';

-- Contract Forms PR 8: the office attests when completing its section of a
-- two-party form (the I-9's Section 2 certification is under penalty of
-- perjury). One timestamp, set by complete-contract-form-office. Idempotent.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS office_attested_at timestamptz;

COMMENT ON COLUMN public.person_contract_documents.office_attested_at IS
  'Two-party forms: when the office ticked the attestation before completing its section (same moment as office_completed_at in practice; kept separately so the record can say "attested").';
