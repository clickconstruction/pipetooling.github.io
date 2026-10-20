SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P5b-m (to-dos/gc-mode/mockups/portal-p5b.md on branch spike/gc-mode): a trade
-- partner company's own papers from its portal. Three verbs the service role calls (submit-gc-trade-portal), each
-- taking the link's company first, and the files ledger widened for a certificate, which is the company's and on no job:
--   - gc_trade_files: purpose 'coi', and a project only on a file that is not a certificate.
--   - gc_trade_coi: the company files its insurance certificate, a signed coi paper with its expiry and the link of its
--     own upload, as gc_record_company_coi files one for the office. gc_company_paper_kept keeps the insurance promise.
--   - gc_trade_vetting_form: a company new to us sends its form, until the office decides.
--   - gc_trade_paper_open: the company opens its master agreement or its W-9 to sign on /contract/accept. It stores the
--     hash of the signing token the function minted, as the sub portal's sign_link does. A W-9 with no paper yet is
--     copied from the Contract Book's W-9 form first, as gc_company_paper copies one for the office.
-- A refusal raises a key the page says in the company's language, as every trade verb does.
-- Doc: docs/migrations/20261010140000_gc_portal_p5b_papers.md.

-- 1) A certificate is the company's, on no job.
ALTER TABLE public.gc_trade_files DROP CONSTRAINT IF EXISTS gc_trade_files_purpose_known;
ALTER TABLE public.gc_trade_files ADD CONSTRAINT gc_trade_files_purpose_known
  CHECK (purpose IN ('submittal', 'change', 'quote', 'waiver', 'coi')) NOT VALID;
ALTER TABLE public.gc_trade_files VALIDATE CONSTRAINT gc_trade_files_purpose_known;
ALTER TABLE public.gc_trade_files ALTER COLUMN project_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_files_job_or_company' AND conrelid = 'public.gc_trade_files'::regclass) THEN
    ALTER TABLE public.gc_trade_files ADD CONSTRAINT gc_trade_files_job_or_company
      CHECK ((purpose = 'coi') = (project_id IS NULL)) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.gc_trade_files VALIDATE CONSTRAINT gc_trade_files_job_or_company;

-- 2) The company files its insurance certificate.
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
  INSERT INTO public.person_contract_documents (
    person_name, company_id, document_name, doc_type, expires_at, url, status, signed_at, contract_lineage_id, lineage_version
  ) VALUES (
    'gc-company:' || p_company_id::text, p_company_id, 'COI (from their portal)', 'coi', p_expires_on, v_url, 'signed', public.app_today(), gen_random_uuid(), 1
  )
  RETURNING id INTO v_id;
  PERFORM public.gc_trade_file_tie(p_company_id, 'coi', v_url, v_id);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_coi(uuid, date, text) IS
  'GC mode (P5b): a trade partner company files its insurance certificate from its portal, a signed coi paper with its expiry and the link of its own upload (gc_trade_files, purpose coi), tied to the paper. gc_company_paper_kept keeps the insurance promise. Service role only (submit-gc-trade-portal, kind coi). SECURITY INVOKER.';

-- 3) A company new to us sends its vetting form, until the office decides.
CREATE OR REPLACE FUNCTION public.gc_trade_vetting_form(p_company_id uuid, p_license text, p_insurance text, p_years integer, p_references text, p_past_jobs text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_license text := btrim(coalesce(p_license, ''));
  v_insurance text := btrim(coalesce(p_insurance, ''));
  v_references text := btrim(coalesce(p_references, ''));
  v_past_jobs text := btrim(coalesce(p_past_jobs, ''));
BEGIN
  SELECT c.vetting_status INTO v_status FROM public.gc_companies c WHERE c.id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  -- Null is a company we know (approved); only a company still new sends the form.
  IF v_status IS DISTINCT FROM 'new' THEN
    RAISE EXCEPTION 'vetDecided' USING ERRCODE = 'P0001', DETAIL = 'The office has decided on this company.';
  END IF;
  IF v_license = '' OR v_insurance = '' OR v_references = '' OR v_past_jobs = '' OR p_years IS NULL OR p_years < 0 THEN
    RAISE EXCEPTION 'formIncomplete' USING ERRCODE = 'P0001', DETAIL = 'Every line of the form is needed.';
  END IF;
  IF greatest(char_length(v_license), char_length(v_insurance), char_length(v_references), char_length(v_past_jobs)) > 2000 OR p_years > 200 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'A line is over 2,000 characters, or the years over 200.';
  END IF;
  INSERT INTO public.gc_company_vetting_forms (company_id, license, insurance, years_in_business, reference_list, past_jobs, sent_on)
  VALUES (p_company_id, v_license, v_insurance, p_years, v_references, v_past_jobs, public.app_today())
  ON CONFLICT (company_id) DO UPDATE SET
    license = EXCLUDED.license,
    insurance = EXCLUDED.insurance,
    years_in_business = EXCLUDED.years_in_business,
    reference_list = EXCLUDED.reference_list,
    past_jobs = EXCLUDED.past_jobs,
    sent_on = EXCLUDED.sent_on;
  RETURN public.app_today();
END;
$$;

COMMENT ON FUNCTION public.gc_trade_vetting_form(uuid, text, text, integer, text, text) IS
  'GC mode (P5b): a trade partner company new to us (vetting_status new) sends its vetting form from its portal, written to gc_company_vetting_forms, a second send replacing the first. Refused once the office decides. Service role only (submit-gc-trade-portal, kind vetting_form). SECURITY INVOKER.';

-- 4) The company opens its master agreement or its W-9 to sign.
CREATE OR REPLACE FUNCTION public.gc_trade_paper_open(p_company_id uuid, p_paper text, p_token_hash text, p_expires_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_entry public.contract_template_documents%ROWTYPE;
  v_id uuid;
BEGIN
  IF coalesce(p_paper, '') NOT IN ('msa', 'w9') OR coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' OR p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'A paper is msa or w9, with a token hash and a later expiry.';
  END IF;
  -- One press at a time a company, so two presses never copy two W-9s.
  PERFORM 1 FROM public.gc_companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  v_type := CASE p_paper WHEN 'msa' THEN 'agreement' ELSE 'w9' END;
  -- The newest of its papers of that kind still to sign: a master agreement the office sent, a W-9 sent or not.
  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.company_id = p_company_id AND d.doc_type = v_type
    AND (d.status = 'sent' OR (p_paper = 'w9' AND d.status = 'unsent'))
  ORDER BY d.created_at DESC, d.id
  LIMIT 1
  FOR UPDATE;
  IF v_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.person_contract_documents d WHERE d.company_id = p_company_id AND d.doc_type = v_type AND d.status = 'signed') THEN
      RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'The company has signed this paper.';
    END IF;
    IF p_paper = 'msa' THEN
      RAISE EXCEPTION 'msaNotSent' USING ERRCODE = 'P0001', DETAIL = 'The office has not sent the master agreement.';
    END IF;
    -- The Contract Book's W-9, as loadCompanyPaperEntries finds it: the first sub entry whose form is a W-9.
    SELECT e.* INTO v_entry FROM public.contract_template_documents e
    JOIN public.contract_form_templates f ON f.id = e.form_template_id
    WHERE e.audience = 'sub' AND f.doc_type = 'w9'
    ORDER BY e.sequence_order
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'noW9Form' USING ERRCODE = 'P0001', DETAIL = 'The Contract Book has no W-9 form for subs.';
    END IF;
    -- gc_company_paper's insert; the form trigger stamps the W-9's doc_type.
    INSERT INTO public.person_contract_documents (
      person_name, company_id, document_name, contract_lineage_id, lineage_version, supersedes_person_contract_document_id,
      status, canonical_document_url, signing_body_html, signing_body_format, applied_contract_template_document_id
    ) VALUES (
      'gc-company:' || p_company_id::text, p_company_id, v_entry.document_name, gen_random_uuid(), 1, NULL,
      'unsent', nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''), v_entry.book_body_html, v_entry.book_body_format, v_entry.id
    )
    RETURNING id INTO v_id;
  END IF;
  UPDATE public.person_contract_documents
  SET status = 'sent',
      sent_at = coalesce(sent_at, now()),
      public_token_hash = p_token_hash,
      public_token_expires_at = p_expires_at
  WHERE id = v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_paper_open(uuid, text, text, timestamptz) IS
  'GC mode (P5b): a trade partner company opens its master agreement (one the office sent) or its W-9 (copied from the Contract Book''s W-9 form when it has none) to sign on /contract/accept: the paper is sent, with the hash of the token the function minted, the newest link winning. Service role only (submit-gc-trade-portal, kind paper_link). SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_trade_coi(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gc_trade_vetting_form(uuid, text, text, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gc_trade_paper_open(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_coi(uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gc_trade_vetting_form(uuid, text, text, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gc_trade_paper_open(uuid, text, text, timestamptz) TO service_role;
