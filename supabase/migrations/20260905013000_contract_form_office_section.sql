SET lock_timeout = '3s';

-- Contract Forms PR 7 (v2.2802): two-party forms. A form template's boxes carry
-- a party (signer | office); the signer fills theirs on the signing page and
-- the office completes its section from the record afterwards (the I-9's
-- Section 2). These columns hold the office's half. Idempotent and additive.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS office_values jsonb;

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS office_completed_at timestamptz;

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS office_completed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS office_signer_printed_name text;

COMMENT ON COLUMN public.person_contract_documents.office_values IS
  'Two-party forms: the office''s answers (party = office boxes), non-sensitive only, keyed by box key. NULL until the office completes its section.';
COMMENT ON COLUMN public.person_contract_documents.office_completed_at IS
  'Two-party forms: when the office completed its section; the PDF is flattened at that moment.';
COMMENT ON COLUMN public.person_contract_documents.office_completed_by_user_id IS
  'Two-party forms: the staff member who completed the office section (and whose typed name signs it).';
COMMENT ON COLUMN public.person_contract_documents.office_signer_printed_name IS
  'Two-party forms: the name typed as the office signature (e.g. "Robert Douglas, Owner").';
