SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P5b-2m (to-dos/gc-mode/mockups/portal-p5b.md, amendment 3, on branch spike/gc-mode):
-- the owner's call 3, "Office looks first." A certificate the trade sends from its portal lands as received and counts
-- for nothing (the start gate, Follow up, the insurance promise) until the office marks it good from the company's
-- Documents tab:
--   - person_contract_documents.status gains 'received', held to a company's certificate;
--   - gc_trade_coi files the trade's certificate as received, with the time it came in (sent_at), one waiting at a time:
--     a second send replaces the first; it keeps no promise (gc_company_paper_kept fires only on 'signed');
--   - gc_mark_company_coi_good, the office's one press: a received certificate signed with today's day, which the keep
--     trigger turns into the insurance promise kept.
-- Doc: docs/migrations/20261010170000_gc_portal_p5b_coi_received.md.

-- 1) A received certificate: a status only a company's certificate takes.
ALTER TABLE public.person_contract_documents DROP CONSTRAINT IF EXISTS person_contract_documents_status_check;
ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_status_check
  CHECK (status IN ('unsent', 'sent', 'signed', 'received')) NOT VALID;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_status_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_received_is_a_company_coi' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_received_is_a_company_coi
      CHECK (status <> 'received' OR (company_id IS NOT NULL AND doc_type = 'coi')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_received_is_a_company_coi;

-- 2) The trade's certificate lands as received. Its refusals are P5b-m's, word for word.
CREATE OR REPLACE FUNCTION public.gc_trade_coi(p_company_id uuid, p_expires_on date, p_file_url text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_url text := public.gc_trade_file_link(p_file_url);
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  IF p_expires_on IS NULL THEN
    RAISE EXCEPTION 'coiDayNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say the day the policy runs out.';
  END IF;
  IF p_expires_on <= public.app_today() THEN
    RAISE EXCEPTION 'coiPast' USING ERRCODE = 'P0001', DETAIL = 'The day the policy runs out has passed.';
  END IF;
  IF p_expires_on > public.app_today() + 1096 THEN
    RAISE EXCEPTION 'coiTooFar' USING ERRCODE = 'P0001', DETAIL = 'The day the policy runs out is more than three years away.';
  END IF;
  -- The link is the company's own upload of a certificate, not yet filed: never a typed link, never another company's.
  IF v_url IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.gc_trade_files f
    WHERE f.company_id = p_company_id AND f.purpose = 'coi' AND f.drive_url = v_url AND f.record_id IS NULL
  ) THEN
    RAISE EXCEPTION 'certNeeded' USING ERRCODE = 'P0001', DETAIL = 'A certificate is a file the company uploaded from its portal.';
  END IF;
  -- One waiting at a time: a second send replaces the first, which the office has not looked at.
  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.company_id = p_company_id AND d.doc_type = 'coi' AND d.status = 'received'
  ORDER BY d.created_at DESC, d.id
  LIMIT 1
  FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.person_contract_documents (
      person_name, company_id, document_name, doc_type, expires_at, url, status, sent_at, contract_lineage_id, lineage_version
    ) VALUES (
      'gc-company:' || p_company_id::text, p_company_id, 'COI (from their portal)', 'coi', p_expires_on, v_url, 'received', now(), gen_random_uuid(), 1
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.person_contract_documents SET expires_at = p_expires_on, url = v_url, sent_at = now() WHERE id = v_id;
  END IF;
  PERFORM public.gc_trade_file_tie(p_company_id, 'coi', v_url, v_id);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_coi(uuid, date, text) IS
  'GC mode (P5b-m, received since P5b-2m): a trade partner company sends its insurance certificate from its portal, a coi paper received with its expiry, the link of its own upload (gc_trade_files, purpose coi) and the time it came in, one waiting at a time. It counts for nothing until the office marks it good (gc_mark_company_coi_good). Service role only (submit-gc-trade-portal, kind coi). SECURITY INVOKER.';

-- 3) The office marks it good: signed with today's day, which keeps the insurance promise (gc_company_paper_kept).
CREATE OR REPLACE FUNCTION public.gc_mark_company_coi_good(p_paper_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_doc record;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev sends a trade its papers while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.id, d.status, d.doc_type, d.company_id, d.expires_at INTO v_doc
  FROM public.person_contract_documents d WHERE d.id = p_paper_id FOR UPDATE;
  IF NOT FOUND OR v_doc.company_id IS NULL OR v_doc.doc_type <> 'coi' OR v_doc.status <> 'received' THEN
    RAISE EXCEPTION 'That certificate is not waiting for a look.' USING ERRCODE = 'P0001';
  END IF;
  IF v_doc.expires_at IS NULL OR v_doc.expires_at <= public.app_today() THEN
    RAISE EXCEPTION 'That certificate has run out. Ask them for the current one.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE id = p_paper_id;
END;
$$;

COMMENT ON FUNCTION public.gc_mark_company_coi_good(uuid) IS
  'GC mode (P5b-2m): the office marks a certificate a trade partner sent from its portal good, from the company''s Documents tab: received to signed with today''s day; gc_company_paper_kept keeps the insurance promise. Dev only until the papers'' door. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_mark_company_coi_good(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_mark_company_coi_good(uuid) TO authenticated;
