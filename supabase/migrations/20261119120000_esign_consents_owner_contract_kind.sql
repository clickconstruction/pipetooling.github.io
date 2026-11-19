SET lock_timeout = '3s';

-- The e-sign ledger takes our contract's consent again (v2.7924).
--
-- esign_consents keeps the consent words a signer agreed to, one row per signing, and its check
-- esign_consents_record_type_check lists the kinds of record a row may name. Each migration that added a kind
-- restated the whole list. 20261010090000_gc_owner_contract_sends added 'gc_owner_contract', for the customer who signs
-- our contract in their portal on a job we build as the GC. 20261030030000_hours_statements then restated the list
-- from the one before that, with 'hours_statement' and without 'gc_owner_contract'.
--
-- submit-portal-request writes a 'gc_owner_contract' row after that signing, best-effort like every signing function:
-- the check refused it, the function logged the refusal and the signing still went through. gc_owner_contract_sends
-- had no rows on 2026-11-19, so no consent was lost and nothing is backfilled.
--
-- The list below is every kind in use: the ten the check held, and 'gc_owner_contract'. It is the union
-- EsignConsentRecordType in supabase/functions/_shared/esignConsent.ts, and src/lib/esignConsentKinds.test.ts fails
-- when the newest restatement of this check and that union differ, or a function writes a kind outside both.
--
-- NOT VALID then VALIDATE, as the migrations before it: the ADD holds its lock for an instant, and the VALIDATE reads
-- the table's rows (26 on 2026-11-19) under a lock that blocks no read or write. Safe to run twice.
ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_record_type_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_record_type_check
  CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request', 'gc_sow', 'gc_draw', 'gc_trade_change', 'gc_owner_contract', 'hours_statement')) NOT VALID;
ALTER TABLE public.esign_consents VALIDATE CONSTRAINT esign_consents_record_type_check;
