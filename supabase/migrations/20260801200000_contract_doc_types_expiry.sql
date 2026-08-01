SET lock_timeout = '3s';

-- RUN_SUBS_PLAN Phase 3, PR 3.3: compliance shape for contract documents.
--
-- person_contract_documents tracked signature documents only — no notion of
-- WHAT a document is (agreement vs COI vs W-9 vs license) or WHEN it lapses,
-- and identity was name-text only (contract tables were absent from the
-- Phase-B identity backfill). This adds:
--   doc_type   — what the document is (default 'agreement' matches every
--                existing row: they all came from the send-for-signature flow)
--   expires_at — compliance lapse date (COI/license); NULL = never expires
--   person_id  — the roster identity, backfilled + trigger-maintained with
--                the standard resolver pattern (names stay display+fallback)
-- The Subs HQ tab (next PR) reads these for compliance badges; nothing
-- gates on them — warn, never block, per plan.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'agreement'
    CHECK (doc_type IN ('agreement','coi','w9','license','other'));

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS expires_at date;

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.person_contract_documents.doc_type IS
  'What this document is: agreement (signable), coi, w9, license, other. Compliance badges group by this.';
COMMENT ON COLUMN public.person_contract_documents.expires_at IS
  'Compliance lapse date (COI/license). NULL = does not expire.';
COMMENT ON COLUMN public.person_contract_documents.person_id IS
  'Roster identity (people.id), resolver-backfilled; person_name remains display + fallback.';

CREATE INDEX IF NOT EXISTS idx_person_contract_documents_person_id
  ON public.person_contract_documents (person_id)
  WHERE person_id IS NOT NULL;

-- Standard identity plumbing (20260722268000 / 20260730164728 pattern).
CREATE OR REPLACE FUNCTION public.contract_docs_set_person_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.person_id IS NULL THEN
      NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
    END IF;
  ELSE
    IF NEW.person_id IS NOT DISTINCT FROM OLD.person_id THEN
      NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_person_id_on_write ON public.person_contract_documents;
CREATE TRIGGER set_person_id_on_write
  BEFORE INSERT OR UPDATE OF person_name ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_docs_set_person_id();

UPDATE public.person_contract_documents
SET person_id = public.resolve_pay_person_id(person_name)
WHERE person_id IS NULL
  AND btrim(COALESCE(person_name, '')) <> '';
