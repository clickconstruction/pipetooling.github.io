SET lock_timeout = '3s';

-- Records for an owner, signed on their portal (punch list #86, PR 1): the e-sign ledger takes
-- the owner's acknowledgment of a records request. `lien_owner_record_requests.id` is the record.
ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_record_type_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_record_type_check
  CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request'));
