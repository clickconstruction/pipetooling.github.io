SET lock_timeout = '3s';
-- v2.6244: dev_legal_statement_write — the dev MCP's dry-run wrapper for a sworn statement or an unsworn
-- declaration on a legal matter (plan_matter_statement → apply_matter_statement), punch list #220's robot
-- path, modeled on dev_legal_plan_write. A robot DRAFTS; the office prints, signs and files. The dry run
-- names the matter, the statement before (on update) and the row as it would be written (a draft, with the
-- state words the Said lane gives it), the matter's live statement count (so a statement added since changes
-- the plan hash) and whether the firm reads it; apply writes through legal_statement_add /
-- legal_statement_update (20261031040000) with p_source = 'mcp', so the Timeline tags the chip as the
-- robot's (statementByWords: "<name> · team · dev MCP"). An update is refused once the signed copy is
-- filed: the sworn text is sworn. The office RPCs' own checks run here first, so the plan refuses in
-- words instead of apply.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

CREATE OR REPLACE FUNCTION public.dev_legal_statement_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_matter public.legal_matters%ROWTYPE;
  v_entry public.legal_matter_entries%ROWTYPE;
  v_action text := lower(btrim(COALESCE(p->>'action', 'add')));
  v_on date;
  v_to date;
  v_title text;
  v_body text;
  v_affiant jsonb;
  v_form text;
  v_county text;
  v_problem text;
  v_state text := 'draft';
  v_prints integer := 0;
  v_before jsonb := NULL;
  v_after jsonb;
  v_count integer;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_statement_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('add', 'update') THEN
    RAISE EXCEPTION 'dev_legal_statement_write: action must be add or update — the office prints, signs and files';
  END IF;
  IF p ? 'on' AND COALESCE(p->>'on', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'dev_legal_statement_write: on must be a day, YYYY-MM-DD — the day the statement is about';
  END IF;
  -- incident_to may be JSON null on an update: that clears the span.
  IF p ? 'incident_to' AND p->'incident_to' <> 'null'::jsonb AND COALESCE(p->>'incident_to', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'dev_legal_statement_write: incident_to must be a day, YYYY-MM-DD — the last day of the span';
  END IF;
  IF p ? 'form' AND COALESCE(p->>'form', '') NOT IN ('notary', 'declaration') THEN
    RAISE EXCEPTION 'dev_legal_statement_write: form must be notary (sworn before a notary) or declaration (unsworn, under penalty of perjury)';
  END IF;

  IF v_action = 'add' THEN
    IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_legal_statement_write: matter_id is required (a legal_matters.id)';
    END IF;
    SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_legal_statement_write: matter % not found', p->>'matter_id'; END IF;
    IF NOT (p ? 'on') THEN RAISE EXCEPTION 'dev_legal_statement_write: on is required — the day the statement is about'; END IF;
    v_on := (p->>'on')::date;
    v_to := CASE WHEN p ? 'incident_to' THEN NULLIF(p->>'incident_to', '')::date ELSE NULL END;
    v_title := btrim(COALESCE(p->>'title', ''));
    v_body := btrim(COALESCE(p->>'body', ''));
    v_affiant := p->'affiant';
    v_form := COALESCE(p->>'form', 'notary');
    v_county := NULLIF(btrim(COALESCE(p->>'venue_county', '')), '');
  ELSE
    IF COALESCE(p->>'entry_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_legal_statement_write: entry_id is required (a legal_matter_entries.id of kind statement)';
    END IF;
    SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = (p->>'entry_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_legal_statement_write: statement % not found', p->>'entry_id'; END IF;
    IF v_entry.kind <> 'statement' THEN RAISE EXCEPTION 'dev_legal_statement_write: entry % is a %, not a statement', v_entry.id, v_entry.kind; END IF;
    IF v_entry.voided_at IS NOT NULL THEN RAISE EXCEPTION 'dev_legal_statement_write: that statement was dropped (%)', v_entry.void_reason; END IF;
    v_state := COALESCE(v_entry.meta->>'state', 'draft');
    IF v_state = 'signed' THEN
      RAISE EXCEPTION 'dev_legal_statement_write: the signed copy is filed; the sworn text cannot change. Plan a new statement instead.';
    END IF;
    v_prints := CASE WHEN jsonb_typeof(v_entry.meta->'prints') = 'array' THEN jsonb_array_length(v_entry.meta->'prints') ELSE 0 END;
    SELECT * INTO v_matter FROM public.legal_matters WHERE id = v_entry.matter_id;
    v_before := jsonb_build_object(
      'id', v_entry.id, 'occurred_on', to_char(v_entry.occurred_on, 'YYYY-MM-DD'), 'title', v_entry.meta->>'title', 'body', v_entry.body,
      'affiant', v_entry.meta->'affiant', 'form', COALESCE(v_entry.meta->>'form', 'notary'), 'incident_to', v_entry.meta->>'incident_to',
      'venue_county', v_entry.meta->>'venue_county', 'state', v_state, 'prints', v_prints,
      'source', COALESCE(v_entry.meta->>'source', 'office'), 'edited_at', v_entry.meta->>'edited_at'
    );
    v_on := COALESCE((p->>'on')::date, v_entry.occurred_on);
    v_to := CASE WHEN p ? 'incident_to' THEN NULLIF(p->>'incident_to', '')::date ELSE NULLIF(v_entry.meta->>'incident_to', '')::date END;
    v_title := COALESCE(NULLIF(btrim(p->>'title'), ''), v_entry.meta->>'title', '');
    v_body := COALESCE(NULLIF(btrim(p->>'body'), ''), v_entry.body);
    v_affiant := COALESCE(p->'affiant', v_entry.meta->'affiant');
    v_form := COALESCE(p->>'form', v_entry.meta->>'form', 'notary');
    v_county := CASE WHEN p ? 'venue_county' THEN NULLIF(btrim(COALESCE(p->>'venue_county', '')), '') ELSE NULLIF(v_entry.meta->>'venue_county', '') END;
  END IF;

  -- The office RPCs' own checks (legal_statement_add / _update), run here so the plan refuses in words.
  v_problem := public.legal_statement_affiant_problem(v_affiant);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION 'dev_legal_statement_write: %', v_problem; END IF;
  IF v_affiant->>'kind' = 'team' AND COALESCE(v_affiant->>'user_id', '') <> '' THEN
    IF v_affiant->>'user_id' !~ '^[0-9a-fA-F-]{36}$' OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = (v_affiant->>'user_id')::uuid) THEN
      RAISE EXCEPTION 'dev_legal_statement_write: affiant.user_id must be a users.id (find_person); leave it out for a witness';
    END IF;
  END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'dev_legal_statement_write: title is required — the paper''s heading'; END IF;
  IF length(v_title) > 200 THEN RAISE EXCEPTION 'dev_legal_statement_write: keep the title under 200 characters'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'dev_legal_statement_write: body is required — the statement''s paragraphs'; END IF;
  IF length(v_body) > 20000 THEN RAISE EXCEPTION 'dev_legal_statement_write: keep the statement under 20,000 characters'; END IF;
  IF v_on > public.app_today() THEN RAISE EXCEPTION 'dev_legal_statement_write: the day it is about cannot be ahead of today'; END IF;
  IF v_to IS NOT NULL AND v_to < v_on THEN RAISE EXCEPTION 'dev_legal_statement_write: incident_to comes before on — the span runs forward'; END IF;
  IF v_to IS NOT NULL AND v_to > public.app_today() THEN RAISE EXCEPTION 'dev_legal_statement_write: the span cannot run past today'; END IF;
  IF v_county IS NOT NULL AND length(v_county) > 60 THEN RAISE EXCEPTION 'dev_legal_statement_write: keep venue_county under 60 characters'; END IF;

  -- The row as it would be written: a draft with the state words the Said lane gives it. No timestamps, no ids.
  v_after := jsonb_build_object(
    'kind', 'statement',
    'occurred_on', to_char(v_on, 'YYYY-MM-DD'),
    'title', v_title,
    'body', v_body,
    'affiant', public.legal_statement_affiant_clean(v_affiant),
    'form', v_form,
    'incident_to', CASE WHEN v_to IS NULL OR v_to = v_on THEN NULL ELSE to_char(v_to, 'YYYY-MM-DD') END,
    'venue_county', v_county,
    'state', v_state,
    'state_words', CASE WHEN v_state = 'draft' THEN 'Draft · not signed.' ELSE format('Printed %s× · no signed copy. The office prints it again after the change.', v_prints) END,
    'source', CASE WHEN v_action = 'add' THEN 'mcp' ELSE COALESCE(v_entry.meta->>'source', 'office') END,
    'edited_source', CASE WHEN v_action = 'update' THEN 'mcp' ELSE NULL END
  );
  -- The live statements on the matter: a statement added or dropped since the plan changes the hash.
  SELECT count(*) INTO v_count FROM public.legal_matter_entries WHERE matter_id = v_matter.id AND kind = 'statement' AND voided_at IS NULL;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'action', v_action,
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'before', v_before,
      'after', v_after,
      'statements_on_matter', v_count,
      'then', 'The office opens it on the Legal desk''s Timeline (the Said lane), prints a face, signs it before a notary or under penalty of perjury, and files the scan. The robot never prints, signs or files.',
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  -- The write, through the office's own RPCs as the caller, with source mcp.
  IF v_action = 'add' THEN
    v_result := public.legal_statement_add(v_matter.id, v_on, v_body, v_title, v_affiant, v_form, v_to, v_county, 'mcp');
  ELSE
    v_result := public.legal_statement_update(v_entry.id, v_on, v_body, v_title, v_affiant, v_form, v_to, v_to IS NULL, v_county, v_county IS NULL, 'mcp');
  END IF;
  IF v_result ? 'error' THEN
    RAISE EXCEPTION 'dev_legal_statement_write: %', v_result->>'error';
  END IF;
  RETURN jsonb_build_object('ok', true, 'action', v_action, 'matter_id', v_matter.id, 'entry_id', COALESCE(v_result->>'entry_id', v_entry.id::text), 'state', v_state);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_statement_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_statement_write(jsonb, boolean) TO authenticated;
COMMENT ON FUNCTION public.dev_legal_statement_write(jsonb, boolean) IS
  'The dev MCP''s statement verbs (v2.6244, punch list #220): a dry-run wrapper over legal_statement_add / legal_statement_update, devs only. p = { action: add | update, matter_id | entry_id, on, title, body, affiant { kind team | witness, user_id?, name, role }, form? (notary | declaration), incident_to?, venue_county? }. p_dry_run true names the matter, the statement before and the draft as it would be written, the matter''s live statement count and whether the firm reads it; false writes with source mcp. A robot drafts; the office prints, signs and files. Refused once the signed copy is filed.';
