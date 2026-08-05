SET lock_timeout = '3s';

-- Agreements compliance panel (v2.1407): records when a signer last opened
-- their signing page. Stamped by the get-contract-for-signer edge function on
-- every successful fetch of a 'sent' document (both the emailed link and the
-- Dashboard sign-now flow land there). NULL = never opened since this shipped;
-- views before this migration are unknowable.
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS signer_last_viewed_at timestamptz;

COMMENT ON COLUMN public.person_contract_documents.signer_last_viewed_at IS
  'Last time the signer opened the signing page (stamped by get-contract-for-signer); NULL = never opened since 2026-08-05.';
