SET lock_timeout = '3s';

-- Where an outside signer lives, the owner's fourth decision of 2026-11-22 (punch list #403): the open log outlives
-- its paper. Every open of a signed form's PDF is a line in contract_form_pdf_opens. That line was tied to its paper
-- with ON DELETE CASCADE, so deleting a paper deleted the record of who had opened its signed form. In order:
--   1. The link to the paper may be empty, and a deleted paper empties it (ON DELETE SET NULL) where it took the line.
--   2. The line keeps the paper's words on itself, so it still says which paper it was once the paper is gone: the
--      paper's name and who it was with. A trigger fills them when the line is written, so open-contract-form-pdf
--      needs no change, and the lines already kept are filled once here.
-- Who reads the log is unchanged: a dev and the controller. No table is made, so there is no fence to call. Every statement is safe to
-- run twice. Doc: docs/migrations/20261123030000_form_pdf_opens_outlive_paper.md.

-- ---------- 1. The line keeps the paper's words ----------

ALTER TABLE public.contract_form_pdf_opens
  ADD COLUMN IF NOT EXISTS paper_name text,
  ADD COLUMN IF NOT EXISTS paper_with text;

COMMENT ON COLUMN public.contract_form_pdf_opens.paper_name IS
  'Punch list #403: the opened paper''s document_name as it stood when the open was written, so the line still names its paper once the paper is deleted.';
COMMENT ON COLUMN public.contract_form_pdf_opens.paper_with IS
  'Punch list #403: who the opened paper was with when the open was written: the person it is filed under, a party''s frozen name, or a trade company''s name. Never a stored name (party:<id>, gc-company:<id>).';

-- Who a paper is with, in words: a trade company's name, a party's frozen name, else the person it is filed under.
-- A definer for the trigger below: the log is written by the service role, and nobody signed in
-- may call this.
CREATE OR REPLACE FUNCTION public.contract_paper_with_words(p_paper_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(left(btrim(CASE
    WHEN d.company_id IS NOT NULL THEN coalesce((SELECT c.name FROM public.gc_companies c WHERE c.id = d.company_id), '')
    WHEN d.party_contact_id IS NOT NULL THEN coalesce(d.party_name, d.signer_name, '')
    ELSE coalesce(d.person_name, '')
  END), 200), '')
  FROM public.person_contract_documents d
  WHERE d.id = p_paper_id;
$$;

COMMENT ON FUNCTION public.contract_paper_with_words(uuid) IS
  'Punch list #403: who a paper (person_contract_documents) is with, in words, for the open log to keep: a trade company''s name, a party''s frozen name, else the person it is filed under. Not granted to anyone signed in.';

REVOKE ALL ON FUNCTION public.contract_paper_with_words(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contract_paper_with_words(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.contract_form_pdf_open_keeps_words()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.person_contract_document_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.paper_name IS NULL THEN
    NEW.paper_name := (
      SELECT nullif(left(btrim(d.document_name), 300), '')
      FROM public.person_contract_documents d WHERE d.id = NEW.person_contract_document_id
    );
  END IF;
  IF NEW.paper_with IS NULL THEN
    NEW.paper_with := public.contract_paper_with_words(NEW.person_contract_document_id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contract_form_pdf_open_keeps_words() IS
  'Punch list #403: an open of a signed form keeps its paper''s name and who the paper was with on its own line, so the line outlives the paper.';

REVOKE ALL ON FUNCTION public.contract_form_pdf_open_keeps_words() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS keep_paper_words_on_open ON public.contract_form_pdf_opens;
CREATE TRIGGER keep_paper_words_on_open
  BEFORE INSERT ON public.contract_form_pdf_opens
  FOR EACH ROW EXECUTE FUNCTION public.contract_form_pdf_open_keeps_words();

-- The lines already kept, filled once. Each still has its paper, since a deleted paper took its lines until now.
UPDATE public.contract_form_pdf_opens o
SET paper_name = coalesce(o.paper_name, (SELECT nullif(left(btrim(d.document_name), 300), '') FROM public.person_contract_documents d WHERE d.id = o.person_contract_document_id)),
    paper_with = coalesce(o.paper_with, public.contract_paper_with_words(o.person_contract_document_id))
WHERE o.person_contract_document_id IS NOT NULL AND (o.paper_name IS NULL OR o.paper_with IS NULL);

-- ---------- 2. A deleted paper leaves its lines ----------

ALTER TABLE public.contract_form_pdf_opens ALTER COLUMN person_contract_document_id DROP NOT NULL;

-- The key is put back as SET NULL. NOT VALID, then validated, so the swap holds its strong lock for an instant only.
DO $$
DECLARE
  v_name text;
  v_action "char";
BEGIN
  SELECT c.conname, c.confdeltype INTO v_name, v_action
  FROM pg_constraint c
  WHERE c.conrelid = 'public.contract_form_pdf_opens'::regclass AND c.contype = 'f'
    AND c.confrelid = 'public.person_contract_documents'::regclass;
  IF v_name IS NOT NULL AND v_action = 'n' THEN
    RETURN;
  END IF;
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.contract_form_pdf_opens DROP CONSTRAINT %I', v_name);
  END IF;
  ALTER TABLE public.contract_form_pdf_opens
    ADD CONSTRAINT contract_form_pdf_opens_person_contract_document_id_fkey
    FOREIGN KEY (person_contract_document_id) REFERENCES public.person_contract_documents(id) ON DELETE SET NULL NOT VALID;
END $$;
ALTER TABLE public.contract_form_pdf_opens VALIDATE CONSTRAINT contract_form_pdf_opens_person_contract_document_id_fkey;

COMMENT ON TABLE public.contract_form_pdf_opens IS
  'Contract Forms: one row per time a staff member opened a signed form PDF (holds the sensitive answers). Written by the edge function; a dev and the controller read. Since punch list #403 a line outlives its paper: a deleted paper empties person_contract_document_id, and paper_name and paper_with still say which paper it was.';
