SET lock_timeout = '3s';

-- Electronic-signature consent ledger (v2.3100). Every signature made on a
-- public signing page (estimate accept, job contract, contract / form accept,
-- sub-portal work order, Bid Room) stores the exact consent words the signer
-- saw — the one-line sentence, the two "How electronic signing works"
-- paragraphs, the disclosure link and the checkbox label — with the version and
-- language of that text and the attribution facts (name, method, time, IP,
-- device). One table for every record type, so "what did this person agree
-- to" is one query; the signed rows keep their own consented_at / ip / ua.
-- Written only by the signing Edge Functions (service role); read by office
-- roles. Statutes: 15 U.S.C. § 7001 (ESIGN); Tex. Bus. & Com. Code ch. 322 (UETA).
CREATE TABLE IF NOT EXISTS public.esign_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'estimate' (estimates.id — also Bid Room proposals and change orders, which are estimate rows)
  -- 'job_contract' (job_contracts.id) · 'person_contract_document' (person_contract_documents.id)
  -- 'step_commitment' (step_commitments.id — sub-portal work orders) · 'bid_proposal_room' (bid_proposal_rooms.id)
  record_type text NOT NULL CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room')),
  record_id uuid NOT NULL,
  consent_version integer NOT NULL CHECK (consent_version >= 1),
  lang text NOT NULL CHECK (lang IN ('en', 'es')),
  audience text NOT NULL CHECK (audience IN ('customer', 'sub', 'gc')),
  document_noun text NOT NULL,
  -- The words as shown, verbatim (the client renders them from src/lib/esignConsent.ts and sends them back).
  clause_text text NOT NULL CHECK (char_length(clause_text) <= 4000),
  printed_name text,
  method text CHECK (method IN ('type', 'draw', 'in_person')),
  consented_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS esign_consents_record_idx ON public.esign_consents (record_type, record_id, consented_at DESC);

ALTER TABLE public.esign_consents ENABLE ROW LEVEL SECURITY;
-- Office reads (dev / leaders / assistant / controller / estimator). No client write path: the
-- signing functions insert with the service role after the signature row commits.
DROP POLICY IF EXISTS esign_consents_read ON public.esign_consents;
CREATE POLICY esign_consents_read ON public.esign_consents
  FOR SELECT USING (public.is_master_or_dev() OR public.is_office_or_estimator());

COMMENT ON TABLE public.esign_consents IS
  'v2.3100: the exact ESIGN / Texas UETA consent text a signer saw, by version + language, with attribution facts. One row per signature from the public signing functions (service role). Read: office roles.';
COMMENT ON COLUMN public.esign_consents.clause_text IS 'The consent line, the two "How electronic signing works" paragraphs, the disclosure link and the checkbox label, verbatim as rendered.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
