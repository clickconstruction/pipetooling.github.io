SET lock_timeout = '3s';

-- The dev MCP records what happened on a legal matter (punch list #169, v2.6682): plan_matter_event → apply_matter_event.
--
-- #167 (v2.5836) gave the office a kind of its own for something that already happened — a notice arriving, a
-- supplier paid, a statement signed — as legal_event_add. The dev seat could plan a step and file a document but not
-- record an event, so on job 891 the five past events went in as planned steps marked done. This is the seat's
-- dry-run wrapper, modeled on dev_legal_plan_write (20261023195135): devs only; the dry run names the matter, the
-- event as it would be written, the documents it names by title, how many events the matter holds (so an event
-- recorded since the plan changes the hash) and whether the firm reads it now; apply writes through legal_event_add
-- with source 'mcp'. p = { matter_id, on (YYYY-MM-DD, the day it happened, never ahead of today), body (what),
-- notes?, document_ids? (live legal_matter_documents of the same matter) }.
--
-- Additive and idempotent; no table is created, so no fence is owed.
CREATE OR REPLACE FUNCTION public.dev_legal_event_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_matter public.legal_matters%ROWTYPE;
  v_on date;
  v_body text;
  v_notes text;
  v_docs uuid[] := '{}'::uuid[];
  v_doc_rows jsonb := '[]'::jsonb;
  v_missing text[];
  v_count int;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_event_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_legal_event_write: matter_id is required (a legal_matters.id)';
  END IF;
  SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev_legal_event_write: matter % not found', p->>'matter_id'; END IF;
  IF COALESCE(p->>'on', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'dev_legal_event_write: on is required — the day it happened, YYYY-MM-DD';
  END IF;
  v_on := (p->>'on')::date;
  IF v_on > public.app_today() THEN
    RAISE EXCEPTION 'dev_legal_event_write: on cannot be ahead of today — plan a step instead (plan_matter_plan_item)';
  END IF;
  v_body := btrim(COALESCE(p->>'body', ''));
  IF v_body = '' THEN RAISE EXCEPTION 'dev_legal_event_write: body is required — what happened'; END IF;
  IF length(v_body) > 500 THEN RAISE EXCEPTION 'dev_legal_event_write: keep body under 500 characters; the notes take the rest'; END IF;
  v_notes := btrim(COALESCE(p->>'notes', ''));
  IF length(v_notes) > 4000 THEN RAISE EXCEPTION 'dev_legal_event_write: keep notes under 4,000 characters'; END IF;
  IF p ? 'document_ids' THEN
    IF jsonb_typeof(p->'document_ids') <> 'array' THEN
      RAISE EXCEPTION 'dev_legal_event_write: document_ids must be a list of legal_matter_documents ids';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p->'document_ids') AS d(id) WHERE d.id !~ '^[0-9a-fA-F-]{36}$') THEN
      RAISE EXCEPTION 'dev_legal_event_write: every document_id must be a uuid';
    END IF;
    SELECT COALESCE(array_agg(DISTINCT d.id::uuid), '{}'::uuid[]) INTO v_docs FROM jsonb_array_elements_text(p->'document_ids') AS d(id);
    SELECT array_agg(x::text) INTO v_missing
      FROM unnest(v_docs) AS x
      WHERE NOT EXISTS (SELECT 1 FROM public.legal_matter_documents d WHERE d.id = x AND d.matter_id = v_matter.id AND d.voided_at IS NULL);
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'dev_legal_event_write: not on this matter''s Evidence (live): %', array_to_string(v_missing, ', ');
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'held', d.held_reason <> '') ORDER BY d.added_at), '[]'::jsonb)
      INTO v_doc_rows FROM public.legal_matter_documents d WHERE d.id = ANY(v_docs);
  END IF;
  SELECT count(*) INTO v_count FROM public.legal_matter_entries e WHERE e.matter_id = v_matter.id AND e.kind = 'event' AND e.voided_at IS NULL;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'action', 'add',
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'after', jsonb_build_object('kind', 'event', 'occurred_on', to_char(v_on, 'YYYY-MM-DD'), 'body', v_body, 'notes', v_notes, 'document_ids', to_jsonb(v_docs), 'documents', v_doc_rows, 'source', 'mcp'),
      'events_on_matter', v_count,
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  v_result := public.legal_event_add(v_matter.id, v_on, v_body, v_notes, v_docs, 'mcp');
  IF v_result ? 'error' THEN
    RAISE EXCEPTION 'dev_legal_event_write: %', v_result->>'error';
  END IF;
  RETURN jsonb_build_object('ok', true, 'action', 'add', 'matter_id', v_matter.id, 'entry_id', v_result->>'entry_id', 'occurred_on', to_char(v_on, 'YYYY-MM-DD'));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_event_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_event_write(jsonb, boolean) TO authenticated;
COMMENT ON FUNCTION public.dev_legal_event_write(jsonb, boolean) IS 'The dev MCP''s event verbs (v2.6682, punch list #169): a dry-run wrapper over legal_event_add, devs only; the dry run names the matter, the event as it would be written with its documents by title, the matter''s live event count and whether the firm reads it; apply writes with source mcp.';
