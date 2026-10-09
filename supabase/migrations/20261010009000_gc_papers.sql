SET lock_timeout = '3s';

-- GC mode, the Board's B6-b-i (to-dos/gc-mode/mockups/board-b6b.md on spike/gc-mode): a trade partner company's papers
-- (the master agreement, the W-9, the insurance certificate) are rows of person_contract_documents keyed to the company,
-- under a name no person can have, and every send of a paper is a gc_paper_sends row. Call 5, with the reader audit's
-- additions: the CHECK both ways, the person trigger deriving the company and firing on it, and no
-- person_contract_assignments row for a company.

-- 1) A paper's company.
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.gc_companies(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_person_contract_documents_company
  ON public.person_contract_documents (company_id) WHERE company_id IS NOT NULL;

COMMENT ON COLUMN public.person_contract_documents.company_id IS
  'GC mode (B6-b-i): the trade partner company this paper is for. Its person_name is then ''gc-company:'' || company_id, which no person can have, and person_id is null.';

-- 2) Both ways: a company's paper carries its company's name and no person, and that name never stands without its company.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_company_paper' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_company_paper
      CHECK (
        (company_id IS NULL AND person_name NOT LIKE 'gc-company:%')
        OR (company_id IS NOT NULL AND person_id IS NULL AND person_name = 'gc-company:' || company_id::text)
      ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_company_paper;

-- 3) The person trigger: a company's paper keeps no person, and a copy that lost its company (the Book's new versions
-- copy person_name only) takes it back from the name. It fires on company_id too.
CREATE OR REPLACE FUNCTION public.contract_docs_set_person_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.person_name ~ '^gc-company:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    NEW.company_id := substr(NEW.person_name, 12)::uuid;
  END IF;
  IF NEW.company_id IS NOT NULL THEN
    NEW.person_id := NULL;
    RETURN NEW;
  END IF;
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

CREATE OR REPLACE TRIGGER set_person_id_on_write
  BEFORE INSERT OR UPDATE OF person_name, company_id ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_docs_set_person_id();

-- 4) Every send of a paper (PaperSend): the day it went, the day we asked for it by, our line, and whether it was the
-- first send of a master agreement or a statement of work. A waiver's ask names the draws it covers.
CREATE TABLE IF NOT EXISTS public.gc_paper_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  paper text NOT NULL
    CONSTRAINT gc_paper_sends_paper_known CHECK (paper IN ('msa', 'sow', 'insurance', 'w9', 'waiver')),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  -- PaperSend.on and PaperSend.by ("on" is a reserved word).
  sent_on date NOT NULL DEFAULT public.app_today(),
  due_on date NOT NULL,
  note text NOT NULL DEFAULT '',
  first boolean NOT NULL DEFAULT false,
  draws integer[],
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A statement of work and a waiver are one trade's on one job; the company's own papers are not.
  CONSTRAINT gc_paper_sends_job_paper CHECK ((paper IN ('sow', 'waiver')) = (package_id IS NOT NULL)),
  CONSTRAINT gc_paper_sends_trade_on_a_job CHECK (package_id IS NULL OR project_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_gc_paper_sends_company ON public.gc_paper_sends (company_id, sent_on);

COMMENT ON TABLE public.gc_paper_sends IS
  'GC mode (B6-b-i): every send of a paper to a trade partner company (PaperSend), written by gc_send_paper with its promise.';

ALTER TABLE public.gc_paper_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_paper_sends_dev ON public.gc_paper_sends;
CREATE POLICY gc_paper_sends_dev ON public.gc_paper_sends FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
REVOKE ALL ON public.gc_paper_sends FROM anon;

-- 5) A send and its promise, in one transaction: the prototype's sendPaper. The promise moves if one is open, as
-- gc_record_promise does. The first master agreement's own row is gc_company_paper's, before this.
CREATE OR REPLACE FUNCTION public.gc_send_paper(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company uuid := nullif(btrim(coalesce(p->>'companyId', '')), '')::uuid;
  v_paper text := btrim(coalesce(p->>'paper', ''));
  v_project uuid := nullif(btrim(coalesce(p->>'projectId', '')), '')::uuid;
  v_pkg uuid := nullif(btrim(coalesce(p->>'packageId', '')), '')::uuid;
  v_due date := nullif(btrim(coalesce(p->>'dueOn', '')), '')::date;
  v_draws integer[];
  v_id uuid;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev sends a trade its papers while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  IF v_company IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = v_company) THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_paper NOT IN ('msa', 'sow', 'insurance', 'w9', 'waiver') THEN
    RAISE EXCEPTION 'That is not a paper we send.' USING ERRCODE = 'P0001';
  END IF;
  IF (v_paper IN ('sow', 'waiver')) <> (v_pkg IS NOT NULL) THEN
    RAISE EXCEPTION 'A statement of work or a waiver is for one trade on a job.' USING ERRCODE = 'P0001';
  END IF;
  IF v_due IS NULL THEN
    RAISE EXCEPTION 'Pick the day to ask for it by.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p->'draws') = 'array' THEN
    v_draws := ARRAY(SELECT jsonb_array_elements_text(p->'draws')::integer);
  END IF;

  INSERT INTO public.gc_paper_sends (company_id, paper, project_id, package_id, due_on, note, first, draws)
  VALUES (v_company, v_paper, v_project, v_pkg, v_due, btrim(coalesce(p->>'note', '')), coalesce((p->>'first')::boolean, false), v_draws)
  RETURNING id INTO v_id;

  -- Its promise (paperStep's promiseKind: a waiver's is closeout), moved if one is open.
  PERFORM public.gc_record_promise(jsonb_build_object(
    'companyId', v_company,
    'kind', CASE v_paper WHEN 'waiver' THEN 'closeout' ELSE v_paper END,
    'projectId', v_project,
    'packageId', v_pkg,
    'dueOn', v_due,
    'source', 'office',
    'what', coalesce(p->>'what', '')
  ));
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_send_paper(jsonb) IS
  'GC mode (B6-b-i): one send of a paper to a company, {companyId, paper, projectId?, packageId?, dueOn, note?, first?, draws?, what}, with its promise through gc_record_promise. Dev only until the papers'' door. SECURITY INVOKER.';

-- 6) A company's copy of one Contract Book entry, as materializePacket makes a person's: a new row the first time,
-- else the Book's link and an empty signing body refreshed on the latest copy. No assignment row: the Book's cascade
-- never sees a company.
CREATE OR REPLACE FUNCTION public.gc_company_paper(p_company_id uuid, p_book_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_entry public.contract_template_documents%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev sends a trade its papers while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_entry FROM public.contract_template_documents WHERE id = p_book_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That paper is not in the Contract Book.' USING ERRCODE = 'P0001';
  END IF;

  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.company_id = p_company_id AND d.document_name = v_entry.document_name
  ORDER BY d.lineage_version DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.person_contract_documents
    SET canonical_document_url = nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''),
        applied_contract_template_document_id = v_entry.id,
        signing_body_html = CASE WHEN btrim(coalesce(signing_body_html, '')) = '' THEN v_entry.book_body_html ELSE signing_body_html END,
        signing_body_format = CASE WHEN btrim(coalesce(signing_body_html, '')) = '' THEN v_entry.book_body_format ELSE signing_body_format END
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.person_contract_documents (
    person_name, company_id, document_name, contract_lineage_id, lineage_version, supersedes_person_contract_document_id,
    status, canonical_document_url, signing_body_html, signing_body_format, applied_contract_template_document_id
  ) VALUES (
    'gc-company:' || p_company_id::text, p_company_id, v_entry.document_name, gen_random_uuid(), 1, NULL,
    'unsent', nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''), v_entry.book_body_html, v_entry.book_body_format, v_entry.id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_company_paper(uuid, uuid) IS
  'GC mode (B6-b-i): a trade partner company''s copy of one Contract Book entry (the master agreement, the W-9 form), named ''gc-company:'' || its id, the form trigger stamping a W-9''s doc_type. Returns the paper''s id. Dev only until the papers'' door. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_send_paper(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_company_paper(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_send_paper(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_company_paper(uuid, uuid) TO authenticated;

-- 7) Training mode and digital twins: gc_paper_sends gets its blocks; the three create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
