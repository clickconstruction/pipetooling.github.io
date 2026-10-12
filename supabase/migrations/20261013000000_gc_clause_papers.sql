SET lock_timeout = '3s';

-- Messages, cut 4c's next piece (v2.5309): a statement of work and our contract can be papers built from clauses. Each
-- gets the library document it is built from, and its sign path freezes the clauses the way accept-contract freezes a
-- person's (v2.5294): only at the revision the signer's page showed. That rule waits for the pages. Until a page shows a
-- paper's clauses, no screen sets its paper, so every signing reads as today.
--
--   1) gc_sows.paper_id and gc_owner_contract_sends.paper_id: the Contract library document the copy is built from.
--      Null is today's paper, the statement of work's lines or our uploaded contract.
--   2) contract_clause_freeze(): what a signed copy keeps, contract_paper_clauses() with the heading and the between
--      line, or null when the document has no live clause. The office and the service role only.
--   3) gc_set_sow_paper (a dev, the board-write team until award's door) and gc_set_owner_contract_paper (the money
--      team) set a copy's paper, refused once it is signed.
--   4) gc_trade_sign_sow and gc_customer_sign_owner_contract gain p_paper_revision and p_paper_lang, dropped and created
--      again in this one transaction with their service_role grants, so the named-argument callers resolve to one
--      function. A copy built from clauses signs only at the revision its page showed, else paperChanged, and its own
--      update writes paper_revision and clause_versions (the freeze trigger keeps them).
--   5) gc_sign_owner_contract, the office's Mark it signed: the office attests what was signed, so the newest send built
--      from clauses keeps its clauses with no revision check (gc_owner_contract_freeze_newest).
-- No new table, so no house calls. Additive apart from the two drops, which are re-created at once. See
-- docs/migrations/20261013000000_gc_clause_papers.md.

-- 1) The paper each copy is built from.
ALTER TABLE public.gc_sows ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.contract_template_documents(id) ON DELETE SET NULL;
ALTER TABLE public.gc_owner_contract_sends ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.contract_template_documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS gc_sows_paper_idx ON public.gc_sows (paper_id) WHERE paper_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_owner_contract_sends_paper_idx ON public.gc_owner_contract_sends (paper_id) WHERE paper_id IS NOT NULL;

COMMENT ON COLUMN public.gc_sows.paper_id IS
  'Messages, cut 4c (v2.5309): the Contract library document this statement of work is built from, its clauses then this trade''s exhibit. Null: the statement of work is its lines, as before. Set by gc_set_sow_paper; signing freezes the clauses as clause_versions.';
COMMENT ON COLUMN public.gc_owner_contract_sends.paper_id IS
  'Messages, cut 4c (v2.5309): the Contract library document this send of our contract is built from. Null: our uploaded contract, as before. Set by gc_set_owner_contract_paper; signing freezes the clauses as clause_versions.';

-- 2) What a signed copy keeps.
CREATE OR REPLACE FUNCTION public.contract_clause_freeze(p_paper_id uuid, p_trades text[], p_lang text, p_title text, p_between text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  -- The service role (the portals) has no user; anyone signed in must be in the office, who read the clauses already.
  IF auth.uid() IS NOT NULL AND NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office reads a paper''s clauses.' USING ERRCODE = '42501';
  END IF;
  IF p_paper_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_clauses c WHERE c.paper_id = p_paper_id AND c.retired_at IS NULL) THEN
    RETURN NULL;
  END IF;
  v := public.contract_paper_clauses(p_paper_id, coalesce(p_trades, '{}'::text[]), CASE WHEN p_lang = 'es' THEN 'es' ELSE 'en' END);
  IF coalesce((v ->> 'revision')::integer, 0) < 1 OR jsonb_array_length(v -> 'clauses') + jsonb_array_length(v -> 'exhibit') = 0 THEN
    RETURN NULL;
  END IF;
  RETURN v || jsonb_build_object('title', p_title, 'between', nullif(btrim(coalesce(p_between, '')), ''));
END;
$$;

COMMENT ON FUNCTION public.contract_clause_freeze(uuid, text[], text, text, text) IS
  'Messages, cut 4c (v2.5309): what a signed copy of a paper built from clauses keeps (clause_versions): contract_paper_clauses() for these trades and language, with the heading and the between line; null when the document has no live clause or nothing published. The office team or the service role.';

REVOKE ALL ON FUNCTION public.contract_clause_freeze(uuid, text[], text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_clause_freeze(uuid, text[], text, text, text) TO authenticated, service_role;

-- The between line on a paper, the GC frame's, in the paper's language.
CREATE OR REPLACE FUNCTION public.contract_clause_between(p_name text, p_lang text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN btrim(coalesce(p_name, '')) = '' THEN NULL ELSE 'Click Construction ' || CASE WHEN p_lang = 'es' THEN 'y ' ELSE 'and ' END || btrim(p_name) END;
$$;

-- 3) The setters.
CREATE OR REPLACE FUNCTION public.gc_set_sow_paper(p_sow_id uuid, p_paper_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_form uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to pick a paper.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev picks the paper for a statement of work while GC mode is built.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot pick a paper.' USING ERRCODE = '42501';
  END IF;
  SELECT s.status INTO v_status FROM public.gc_sows s WHERE s.id = p_sow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That statement of work is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_status = 'signed' THEN
    RAISE EXCEPTION 'That statement of work is signed already.' USING ERRCODE = 'P0001';
  END IF;
  IF p_paper_id IS NOT NULL THEN
    SELECT d.form_template_id INTO v_form FROM public.contract_template_documents d WHERE d.id = p_paper_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That paper is not in the Contract library.' USING ERRCODE = 'P0001';
    END IF;
    IF v_form IS NOT NULL THEN
      RAISE EXCEPTION 'A fillable form is not a paper built from clauses.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.gc_sows SET paper_id = p_paper_id WHERE id = p_sow_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_set_owner_contract_paper(p_send_id uuid, p_paper_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.gc_owner_contract_sends%ROWTYPE;
  v_form uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to pick a paper.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team picks the paper for our contract.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot pick a paper.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_owner_contract_sends s WHERE s.id = p_send_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That contract is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.signed_on IS NOT NULL OR v.clause_versions IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.gc_projects g WHERE g.project_id = v.project_id AND g.owner_contract_signed_on IS NOT NULL) THEN
    RAISE EXCEPTION 'That contract is signed already.' USING ERRCODE = 'P0001';
  END IF;
  IF p_paper_id IS NOT NULL THEN
    SELECT d.form_template_id INTO v_form FROM public.contract_template_documents d WHERE d.id = p_paper_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That paper is not in the Contract library.' USING ERRCODE = 'P0001';
    END IF;
    IF v_form IS NOT NULL THEN
      RAISE EXCEPTION 'A fillable form is not a paper built from clauses.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.gc_owner_contract_sends SET paper_id = p_paper_id WHERE id = p_send_id;
END;
$$;

COMMENT ON FUNCTION public.gc_set_sow_paper(uuid, uuid) IS
  'Messages, cut 4c (v2.5309): a dev (the board-write team until award''s door) picks the Contract library document a statement of work is built from, or clears it with null; refused for a twin, a form, a paper not in the library and a statement of work already signed. SECURITY DEFINER: gc_sows grants no update of its own.';
COMMENT ON FUNCTION public.gc_set_owner_contract_paper(uuid, uuid) IS
  'Messages, cut 4c (v2.5309): the money team picks the Contract library document a send of our contract is built from, or clears it with null; refused for a twin, a form, a paper not in the library and a contract already signed. SECURITY DEFINER: the sends grant no update.';

REVOKE ALL ON FUNCTION public.gc_set_sow_paper(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_set_owner_contract_paper(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_set_sow_paper(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_set_owner_contract_paper(uuid, uuid) TO authenticated;

-- 4) The trade signs its statement of work in its portal (P2c-i), now also as its clauses when it is built from them.
DROP FUNCTION IF EXISTS public.gc_trade_sign_sow(uuid, uuid, text, text, text, text);
CREATE OR REPLACE FUNCTION public.gc_trade_sign_sow(
  p_company_id uuid, p_sow_id uuid, p_printed_name text, p_signature_path text, p_ip text, p_user_agent text,
  p_paper_revision integer DEFAULT NULL, p_paper_lang text DEFAULT 'en')
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
  v_lang text := CASE WHEN p_paper_lang = 'es' THEN 'es' ELSE 'en' END;
  v_trade text;
  v_company text;
  v_title text;
  v_frozen jsonb;
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
  -- Messages, cut 4c (v2.5309): a statement of work built from clauses signs only at the revision its page showed, and
  -- keeps them: the job's clauses, then this trade's exhibit.
  IF v.paper_id IS NOT NULL THEN
    SELECT k.trade, c.name INTO v_trade, v_company
    FROM public.gc_trade_packages k JOIN public.gc_companies c ON c.id = v.company_id
    WHERE k.id = v.package_id;
    SELECT d.document_name INTO v_title FROM public.contract_template_documents d WHERE d.id = v.paper_id;
    v_frozen := public.contract_clause_freeze(v.paper_id, ARRAY[v_trade], v_lang, v_title, public.contract_clause_between(v_company, v_lang));
    IF v_frozen IS NOT NULL AND p_paper_revision IS DISTINCT FROM (v_frozen ->> 'revision')::integer THEN
      RAISE EXCEPTION 'paperChanged' USING ERRCODE = 'P0001', DETAIL = 'The paper changed since you opened it. Reload to read the new version.';
    END IF;
  END IF;
  UPDATE public.gc_sows
  SET status = 'signed',
      signed_on = v_today,
      signer_printed_name = v_name,
      signer_signature_storage_path = nullif(btrim(coalesce(p_signature_path, '')), ''),
      signer_consented_at = v_at,
      signer_ip = nullif(btrim(coalesce(p_ip, '')), ''),
      signer_user_agent = nullif(btrim(coalesce(p_user_agent, '')), ''),
      paper_revision = CASE WHEN v_frozen IS NULL THEN paper_revision ELSE (v_frozen ->> 'revision')::integer END,
      clause_versions = coalesce(v_frozen, clause_versions)
  WHERE id = v.id;
  -- The statement of work it promised is kept (gc_keep_promises, B1), as the prototype's promisesKeptBy did.
  SELECT k.project_id INTO v_project_id FROM public.gc_trade_packages k WHERE k.id = v.package_id;
  PERFORM public.gc_keep_promises(p_company_id, 'sow', v_project_id, v.package_id, v_today);
  RETURN v_at;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text, integer, text) IS 'GC mode (P2c-i): the trade signs its own statement of work from its portal, once it is sent and once the company signed our master agreement (msaFirst); writes the status, the day and the signer''s fields, and keeps the sow promise. Since v2.5309 a statement of work built from clauses (paper_id) signs only at the revision its page showed (paperChanged) and keeps the clauses as clause_versions. Returns the consent time, for the e-sign ledger row the submit function writes after it; the submit function also stores the signature. Service role only.';

REVOKE ALL ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_sign_sow(uuid, uuid, text, text, text, text, integer, text) TO service_role;

-- The customer signs our contract in their portal (B6-d-i), now also as its clauses when it is built from them.
DROP FUNCTION IF EXISTS public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text);
CREATE OR REPLACE FUNCTION public.gc_customer_sign_owner_contract(
  p_customer_id uuid, p_send_id uuid, p_printed_name text, p_signature_path text, p_ip text, p_user_agent text,
  p_paper_revision integer DEFAULT NULL, p_paper_lang text DEFAULT 'en')
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_owner_contract_sends%ROWTYPE;
  v_job record;
  v_name text := btrim(coalesce(p_printed_name, ''));
  v_today date := public.app_today();
  v_at timestamptz := now();
  v_lang text := CASE WHEN p_paper_lang = 'es' THEN 'es' ELSE 'en' END;
  v_customer text;
  v_title text;
  v_frozen jsonb;
BEGIN
  SELECT * INTO v FROM public.gc_owner_contract_sends WHERE id = p_send_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No contract with that id.';
  END IF;
  SELECT g.lost_on, g.owner_contract_signed_on, p.customer_id INTO v_job
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  WHERE g.project_id = v.project_id
  FOR UPDATE OF g;
  IF v.customer_id IS DISTINCT FROM p_customer_id OR v_job.customer_id IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That contract is another customer''s.';
  END IF;
  IF v_job.lost_on IS NOT NULL THEN
    RAISE EXCEPTION 'lost' USING ERRCODE = 'P0001', DETAIL = 'That job is not going ahead.';
  END IF;
  IF v.signed_on IS NOT NULL OR v_job.owner_contract_signed_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'That contract is signed already.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.gc_owner_contract_sends s
    WHERE s.project_id = v.project_id AND (s.created_at, s.id) > (v.created_at, v.id)
  ) THEN
    RAISE EXCEPTION 'notNewest' USING ERRCODE = 'P0001', DETAIL = 'We sent you a newer one. Sign that one.';
  END IF;
  IF NOT public.gc_owner_contract_worth_ok(v.project_id, v.worth) THEN
    RAISE EXCEPTION 'priceChanged' USING ERRCODE = 'P0001', DETAIL = 'Our price changed after we sent this. We will send you the new one.';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type your name to sign.';
  END IF;
  IF char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the name under 200 characters.';
  END IF;
  -- Messages, cut 4c (v2.5309): our contract built from clauses signs only at the revision its page showed, and keeps
  -- them. A customer has no trade, so it is the clauses for everyone.
  IF v.paper_id IS NOT NULL AND v.clause_versions IS NULL THEN
    SELECT c.name INTO v_customer FROM public.customers c WHERE c.id = v.customer_id;
    SELECT d.document_name INTO v_title FROM public.contract_template_documents d WHERE d.id = v.paper_id;
    v_frozen := public.contract_clause_freeze(v.paper_id, '{}'::text[], v_lang, v_title, public.contract_clause_between(v_customer, v_lang));
    IF v_frozen IS NOT NULL AND p_paper_revision IS DISTINCT FROM (v_frozen ->> 'revision')::integer THEN
      RAISE EXCEPTION 'paperChanged' USING ERRCODE = 'P0001', DETAIL = 'The paper changed since you opened it. Reload to read the new version.';
    END IF;
  END IF;

  UPDATE public.gc_owner_contract_sends
  SET signed_on = v_today,
      signer_printed_name = v_name,
      signer_signature_storage_path = nullif(btrim(coalesce(p_signature_path, '')), ''),
      signer_consented_at = v_at,
      signer_ip = nullif(btrim(coalesce(p_ip, '')), ''),
      signer_user_agent = nullif(btrim(coalesce(p_user_agent, '')), ''),
      paper_revision = CASE WHEN v_frozen IS NULL THEN paper_revision ELSE (v_frozen ->> 'revision')::integer END,
      clause_versions = coalesce(v_frozen, clause_versions)
  WHERE id = v.id;
  -- The price kept is the one they read: the send's, not the project's today.
  PERFORM public.gc_owner_contract_keep(v.project_id, v_today, v.worth);
  RETURN v_at;
END;
$$;

COMMENT ON FUNCTION public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text, integer, text) IS
  'GC mode (B6-d-i): the customer signs our contract in their portal: the newest send, their own, on a job still going, not signed, its price still whole; writes the send''s signer fields and keeps its price by line through gc_owner_contract_keep. Since v2.5309 a send built from clauses (paper_id) signs only at the revision its page showed (paperChanged) and keeps the clauses as clause_versions. Returns the consent time, for the e-sign ledger row (gc_owner_contract) the submit function writes after it; the submit function also stores the signature. Service role only.';

REVOKE ALL ON FUNCTION public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text, integer, text) TO service_role;

-- 5) The office marks our contract signed: the newest send built from clauses keeps its clauses, as the office attests.
-- Only once the project is signed, so a call on its own freezes nothing early.
CREATE OR REPLACE FUNCTION public.gc_owner_contract_freeze_newest(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.gc_owner_contract_sends%ROWTYPE;
  v_customer text;
  v_title text;
  v_frozen jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team marks our contract signed.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_projects g WHERE g.project_id = p_project_id AND g.owner_contract_signed_on IS NOT NULL) THEN
    RETURN;
  END IF;
  SELECT * INTO v FROM public.gc_owner_contract_sends s WHERE s.project_id = p_project_id ORDER BY s.created_at DESC, s.id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v.paper_id IS NULL OR v.clause_versions IS NOT NULL THEN
    RETURN;
  END IF;
  SELECT c.name INTO v_customer FROM public.customers c WHERE c.id = v.customer_id;
  SELECT d.document_name INTO v_title FROM public.contract_template_documents d WHERE d.id = v.paper_id;
  v_frozen := public.contract_clause_freeze(v.paper_id, '{}'::text[], 'en', v_title, public.contract_clause_between(v_customer, 'en'));
  IF v_frozen IS NOT NULL THEN
    UPDATE public.gc_owner_contract_sends SET paper_revision = (v_frozen ->> 'revision')::integer, clause_versions = v_frozen WHERE id = v.id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.gc_owner_contract_freeze_newest(uuid) IS
  'Messages, cut 4c (v2.5309): Mark it signed''s freeze. Once the project is signed, the newest send built from clauses keeps them (clause_versions) with no revision check, as the office attests; a send already frozen stays. The money team or the service role. SECURITY DEFINER: the sends grant no update.';

REVOKE ALL ON FUNCTION public.gc_owner_contract_freeze_newest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_freeze_newest(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gc_sign_owner_contract(p_project_id uuid, p_signed_on date, p_worth jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_portal date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to mark the contract signed.';
  END IF;
  PERFORM 1 FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  v_portal := public.gc_owner_contract_portal_signed_on(p_project_id);

  -- Marked not signed: the day and the price go together.
  IF p_signed_on IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.gc_owner_pay_apps WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'A pay application went out on this price, so the contract stays signed.';
    END IF;
    IF v_portal IS NOT NULL THEN
      RAISE EXCEPTION 'They signed it in their portal, so it stays signed.';
    END IF;
    DELETE FROM public.gc_owner_contract_lines WHERE project_id = p_project_id;
    UPDATE public.gc_projects SET owner_contract_signed_on = NULL WHERE project_id = p_project_id;
    RETURN;
  END IF;

  -- Signed already: the price stays as it was signed, and only the day moves, unless they signed it in their portal.
  IF EXISTS (SELECT 1 FROM public.gc_owner_contract_lines WHERE project_id = p_project_id) THEN
    IF v_portal IS NOT NULL THEN
      RAISE EXCEPTION 'They signed it in their portal on %, so its day stays.', to_char(v_portal, 'Mon FMDD');
    END IF;
    UPDATE public.gc_projects SET owner_contract_signed_on = p_signed_on WHERE project_id = p_project_id;
    RETURN;
  END IF;

  PERFORM public.gc_owner_contract_keep(p_project_id, p_signed_on, p_worth);
  -- Messages, cut 4c (v2.5309): the office attests what was signed, so the newest send built from clauses keeps them.
  PERFORM public.gc_owner_contract_freeze_newest(p_project_id);
END;
$$;

COMMENT ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) IS
  'GC mode (v2.4831): our contract with the customer is signed on a day, with the price by line (ownerContractWorth: each trade''s package id, then gc, contingency and fee); a null day marks it not signed, which a sent pay application refuses. Signed already: only the day moves. The Board''s Get started calls it. Since B6-d-i its first sign is gc_owner_contract_keep, shared with the customer''s signing in their portal, and a contract they signed there is neither undone nor moved. Since v2.5309 the first sign also freezes the newest send''s clauses when it is built from them (gc_owner_contract_freeze_newest), as the office attests. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) TO authenticated;
