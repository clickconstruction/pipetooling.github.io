SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P2c-i (to-dos/gc-mode/mockups/portal-p2c.md on branch spike/gc-mode): the trade
-- signs its statement of work in its portal. The submit function (P2c-ii) has already turned the link into its company,
-- stored a drawn signature and read the signer's IP and browser; it calls this with the company first, and after it
-- writes the e-sign ledger row (recordEsignConsent, record type gc_sow) with the consent time this returns, so the two
-- match as accept-contract's one timestamp does. Only a statement of work the office sent, the
-- company's own, and only once the company signed our master agreement (the prototype's rule, B6-b-i's papers). A
-- refusal raises a key the page says in the company's language (decision 11), with the reason in plain words as its
-- DETAIL. No table changes. Doc: docs/migrations/.

CREATE OR REPLACE FUNCTION public.gc_trade_sign_sow(p_company_id uuid, p_sow_id uuid, p_printed_name text, p_signature_path text, p_ip text, p_user_agent text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_sows%ROWTYPE;
  v_project_id uuid;
  v_name text := btrim(coalesce(p_printed_name, ''));
  v_today date := public.app_today();
  v_at timestamptz := now();
BEGIN
  SELECT * INTO v FROM public.gc_sows WHERE id = p_sow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work with that id.';
  END IF;
  IF v.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That statement of work is another company''s.';
  END IF;
  IF v.status = 'signed' THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'That statement of work is signed already.';
  END IF;
  IF v.status <> 'sent' THEN
    RAISE EXCEPTION 'sowNotSent' USING ERRCODE = 'P0001', DETAIL = 'That statement of work is not sent to sign.';
  END IF;
  -- Our master agreement comes first: a signed agreement paper of the company's own (person_contract_documents, B6-b-i).
  IF NOT EXISTS (
    SELECT 1 FROM public.person_contract_documents d
    WHERE d.company_id = p_company_id AND d.doc_type = 'agreement' AND d.status = 'signed'
  ) THEN
    RAISE EXCEPTION 'msaFirst' USING ERRCODE = 'P0001', DETAIL = 'Sign our master agreement first.';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type your name to sign.';
  END IF;
  IF char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the name under 200 characters.';
  END IF;
  UPDATE public.gc_sows
  SET status = 'signed',
      signed_on = v_today,
      signer_printed_name = v_name,
      signer_signature_storage_path = nullif(btrim(coalesce(p_signature_path, '')), ''),
      signer_consented_at = v_at,
      signer_ip = nullif(btrim(coalesce(p_ip, '')), ''),
      signer_user_agent = nullif(btrim(coalesce(p_user_agent, '')), '')
  WHERE id = v.id;
  -- The statement of work it promised is kept (gc_keep_promises, B1), as the prototype's promisesKeptBy did.
  SELECT k.project_id INTO v_project_id FROM public.gc_trade_packages k WHERE k.id = v.package_id;
  PERFORM public.gc_keep_promises(p_company_id, 'sow', v_project_id, v.package_id, v_today);
  RETURN v_at;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text) IS 'GC mode (P2c-i): the trade signs its own statement of work from its portal, once it is sent and once the company signed our master agreement (msaFirst); writes the status, the day and the signer''s fields, and keeps the sow promise. Returns the consent time it wrote, for the e-sign ledger row the submit function writes after it; the submit function also stores the signature. Service role only.';

-- Only the service role: the submit function, after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text) TO service_role;
