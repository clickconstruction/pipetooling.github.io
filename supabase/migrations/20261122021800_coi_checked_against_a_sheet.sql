SET lock_timeout = '3s';

-- Punch list #404, the Document builder, step 6: a trade's certificate held against a job's insurance sheet.
-- One certificate for each job (Taunya, 2026-11-21). A company's certificate row gains the job it was checked for, the
-- sheet's lines it was checked against, and the lines sent back as missing. Database only: no screen names any of it
-- until the PR after the push.
--
-- Additive and idempotent. It makes no table, so it does not call the four fences.

-- 1) The columns. All null on every row today, so nothing is rewritten.
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS sheet_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sheet_revision integer,
  ADD COLUMN IF NOT EXISTS sheet_asks text[],
  ADD COLUMN IF NOT EXISTS sheet_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS sheet_checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sheet_sent_back_at timestamptz,
  ADD COLUMN IF NOT EXISTS sheet_missing text[];

COMMENT ON COLUMN public.person_contract_documents.sheet_project_id IS
  'Document builder, step 6: the job (a GC project) this certificate was checked for. Null: not checked against a job''s sheet.';
COMMENT ON COLUMN public.person_contract_documents.sheet_revision IS
  'The revision of that job''s insurance sheet it was checked against.';
COMMENT ON COLUMN public.person_contract_documents.sheet_asks IS
  'The lines of the sheet it was marked good against: each name, the place, the certificate holder, each coverage with its amount. The certificate is outdated when the job''s published sheet no longer reads the same lines.';
COMMENT ON COLUMN public.person_contract_documents.sheet_checked_at IS
  'When it was marked good against the sheet.';
COMMENT ON COLUMN public.person_contract_documents.sheet_checked_by IS
  'Who marked it good or sent it back.';
COMMENT ON COLUMN public.person_contract_documents.sheet_sent_back_at IS
  'When it was sent back to the company. Cleared when it is marked good. A newer upload (sent_at) than this means a new certificate came in.';
COMMENT ON COLUMN public.person_contract_documents.sheet_missing IS
  'The sheet''s lines the certificate did not show when it was sent back, in words.';

-- 2) Only a company's certificate is held against a sheet.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_sheet_is_a_company_coi' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_sheet_is_a_company_coi
      CHECK (sheet_project_id IS NULL OR (company_id IS NOT NULL AND doc_type = 'coi')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_sheet_is_a_company_coi;

CREATE INDEX IF NOT EXISTS person_contract_documents_sheet_project_idx
  ON public.person_contract_documents (sheet_project_id) WHERE sheet_project_id IS NOT NULL;

-- 3) Mark it good. A dev alone, as the rest of the Document builder. The sheet must be published, the paper must be a
--    certificate a company sent or had filed, the company must be on a trade of that job, and a certificate checked
--    for one job is never moved to another. The lines are the ones the office ticked, which the page reads off the
--    published sheet.
CREATE OR REPLACE FUNCTION public.document_builder_coi_mark_good(p_paper_id uuid, p_sheet_id uuid, p_asks text[], p_good_until date)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sheet record;
  v_doc record;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev checks a certificate while the Document builder is built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT s.id, s.project_id, s.revision INTO v_sheet FROM public.document_builder_sheets s WHERE s.id = p_sheet_id;
  IF NOT FOUND OR v_sheet.revision < 1 THEN
    RAISE EXCEPTION 'Publish this job''s sheet first.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.id, d.status, d.doc_type, d.company_id, d.sheet_project_id INTO v_doc
  FROM public.person_contract_documents d WHERE d.id = p_paper_id FOR UPDATE;
  IF NOT FOUND OR v_doc.company_id IS NULL OR v_doc.doc_type <> 'coi' OR v_doc.status NOT IN ('received', 'signed') THEN
    RAISE EXCEPTION 'That is not a certificate a company sent.' USING ERRCODE = 'P0001';
  END IF;
  IF v_doc.sheet_project_id IS NOT NULL AND v_doc.sheet_project_id <> v_sheet.project_id THEN
    RAISE EXCEPTION 'That certificate was checked for another job.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gc_invites i JOIN public.gc_trade_packages k ON k.id = i.package_id
    WHERE k.project_id = v_sheet.project_id AND i.company_id = v_doc.company_id
  ) THEN
    RAISE EXCEPTION 'That company is not on a trade of this job.' USING ERRCODE = 'P0001';
  END IF;
  IF p_asks IS NULL OR cardinality(p_asks) = 0 THEN
    RAISE EXCEPTION 'Tick every line the sheet asks before marking it good.' USING ERRCODE = 'P0001';
  END IF;
  IF p_good_until IS NULL THEN
    RAISE EXCEPTION 'Say the day the certificate is good until.' USING ERRCODE = 'P0001';
  END IF;
  IF p_good_until <= public.app_today() THEN
    RAISE EXCEPTION 'That certificate has run out. Ask them for the current one.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.person_contract_documents
  SET status = 'signed',
      signed_at = CASE WHEN v_doc.status = 'received' THEN public.app_today() ELSE signed_at END,
      expires_at = p_good_until,
      sheet_project_id = v_sheet.project_id,
      sheet_revision = v_sheet.revision,
      sheet_asks = p_asks,
      sheet_checked_at = now(),
      sheet_checked_by = auth.uid(),
      sheet_sent_back_at = NULL,
      sheet_missing = NULL
  WHERE id = p_paper_id;
END;
$$;

COMMENT ON FUNCTION public.document_builder_coi_mark_good(uuid, uuid, text[], date) IS
  'Document builder, step 6: a dev marks a company''s certificate good against one job''s published insurance sheet. Keeps the job, the sheet''s revision and the lines it was checked against.';

REVOKE ALL ON FUNCTION public.document_builder_coi_mark_good(uuid, uuid, text[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_builder_coi_mark_good(uuid, uuid, text[], date) TO authenticated;

-- 4) Send it back. The same checks. It keeps the lines the certificate did not show, and the day. The paper's own
--    state is left as it is: a certificate that is good for the company stays good for the company.
CREATE OR REPLACE FUNCTION public.document_builder_coi_send_back(p_paper_id uuid, p_sheet_id uuid, p_missing text[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sheet record;
  v_doc record;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev checks a certificate while the Document builder is built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT s.id, s.project_id, s.revision INTO v_sheet FROM public.document_builder_sheets s WHERE s.id = p_sheet_id;
  IF NOT FOUND OR v_sheet.revision < 1 THEN
    RAISE EXCEPTION 'Publish this job''s sheet first.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.id, d.status, d.doc_type, d.company_id, d.sheet_project_id INTO v_doc
  FROM public.person_contract_documents d WHERE d.id = p_paper_id FOR UPDATE;
  IF NOT FOUND OR v_doc.company_id IS NULL OR v_doc.doc_type <> 'coi' OR v_doc.status NOT IN ('received', 'signed') THEN
    RAISE EXCEPTION 'That is not a certificate a company sent.' USING ERRCODE = 'P0001';
  END IF;
  IF v_doc.sheet_project_id IS NOT NULL AND v_doc.sheet_project_id <> v_sheet.project_id THEN
    RAISE EXCEPTION 'That certificate was checked for another job.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gc_invites i JOIN public.gc_trade_packages k ON k.id = i.package_id
    WHERE k.project_id = v_sheet.project_id AND i.company_id = v_doc.company_id
  ) THEN
    RAISE EXCEPTION 'That company is not on a trade of this job.' USING ERRCODE = 'P0001';
  END IF;
  IF p_missing IS NULL OR cardinality(p_missing) = 0 THEN
    RAISE EXCEPTION 'Say what the certificate is missing before sending it back.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.person_contract_documents
  SET sheet_project_id = v_sheet.project_id,
      sheet_revision = v_sheet.revision,
      sheet_sent_back_at = now(),
      sheet_missing = p_missing,
      sheet_checked_by = auth.uid()
  WHERE id = p_paper_id;
END;
$$;

COMMENT ON FUNCTION public.document_builder_coi_send_back(uuid, uuid, text[]) IS
  'Document builder, step 6: a dev sends a company''s certificate back for one job, keeping the sheet''s lines it did not show.';

REVOKE ALL ON FUNCTION public.document_builder_coi_send_back(uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_builder_coi_send_back(uuid, uuid, text[]) TO authenticated;
