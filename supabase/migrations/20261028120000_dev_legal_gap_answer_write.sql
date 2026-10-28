SET lock_timeout = '3s';
-- v2.6005: dev_legal_gap_answer_write — the dev MCP's dry-run wrapper for an answer on a packet gap
-- (plan_gap_answer → apply_gap_answer), modeled on dev_legal_plan_write. The Legal desk's "Before
-- this goes to an attorney" list recomputes its gaps on every open and stores none of them; an
-- answer is one line per (matter, gap key) the attorney reads instead of the hole (v2.5920), with
-- an optional Evidence document that shows it. The dry run names the matter, the gap, the answer
-- before (when one is on record) and after, how many answers the matter holds and whether the firm
-- reads it; apply writes through legal_answer_gap AS THE DEV (the row's answered_by), or takes an
-- answer back through legal_clear_gap_answer. The matter must exist: the seat answers gaps on
-- matters the office opened and never makes one, so p_job_ids goes in NULL and the matter's jobs
-- stay as they are.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

CREATE OR REPLACE FUNCTION public.dev_legal_gap_answer_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_matter public.legal_matters%ROWTYPE;
  v_existing public.legal_matter_gap_answers%ROWTYPE;
  v_action text := lower(btrim(COALESCE(p->>'action', 'answer')));
  v_gap_key text := btrim(COALESCE(p->>'gap_key', ''));
  v_answer text := btrim(COALESCE(p->>'answer', ''));
  v_label text := btrim(COALESCE(p->>'label', ''));
  v_document_id uuid := NULL;
  v_document_title text := NULL;
  v_doc_matter uuid;
  v_before jsonb := NULL;
  v_after jsonb := NULL;
  v_count integer;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_gap_answer_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('answer', 'clear') THEN
    RAISE EXCEPTION 'dev_legal_gap_answer_write: action must be answer or clear';
  END IF;
  IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_legal_gap_answer_write: matter_id is required (a legal_matters.id)';
  END IF;
  SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev_legal_gap_answer_write: matter % not found', p->>'matter_id'; END IF;
  IF v_matter.closed_at IS NOT NULL THEN RAISE EXCEPTION 'dev_legal_gap_answer_write: this matter is closed'; END IF;
  IF v_gap_key = '' OR length(v_gap_key) > 120 THEN
    RAISE EXCEPTION 'dev_legal_gap_answer_write: gap_key is required — the gap''s own key as the desk computes it (never_asked, demand, contract:<jobId>, subjob:<jobId>, lienfile:<jobId>, …), under 120 characters';
  END IF;

  -- The answer on record for this gap, if any: what the plan commits to.
  SELECT * INTO v_existing FROM public.legal_matter_gap_answers WHERE matter_id = v_matter.id AND gap_key = v_gap_key;
  IF FOUND THEN
    v_before := jsonb_build_object(
      'answer', v_existing.answer, 'label', v_existing.label, 'document_id', v_existing.document_id,
      'answered_by', (SELECT u.name FROM public.users u WHERE u.id = v_existing.answered_by),
      'answered_at', v_existing.answered_at, 'updated_at', v_existing.updated_at
    );
  END IF;

  IF v_action = 'answer' THEN
    IF v_answer = '' THEN RAISE EXCEPTION 'dev_legal_gap_answer_write: answer is required — the one line the attorney reads instead of the gap'; END IF;
    IF length(v_answer) > 500 THEN RAISE EXCEPTION 'dev_legal_gap_answer_write: keep the answer under 500 characters'; END IF;
    IF length(v_label) > 300 THEN RAISE EXCEPTION 'dev_legal_gap_answer_write: keep the label under 300 characters — it is the gap''s words as shown'; END IF;
    IF COALESCE(p->>'document_id', '') <> '' THEN
      IF p->>'document_id' !~ '^[0-9a-fA-F-]{36}$' THEN
        RAISE EXCEPTION 'dev_legal_gap_answer_write: document_id must be a legal_matter_documents.id on this matter';
      END IF;
      v_document_id := (p->>'document_id')::uuid;
      SELECT matter_id, title INTO v_doc_matter, v_document_title FROM public.legal_matter_documents WHERE id = v_document_id AND voided_at IS NULL;
      IF v_doc_matter IS NULL OR v_doc_matter <> v_matter.id THEN
        RAISE EXCEPTION 'dev_legal_gap_answer_write: document % is not on this matter', v_document_id;
      END IF;
    END IF;
    v_after := jsonb_build_object(
      'gap_key', v_gap_key, 'answer', v_answer, 'label', v_label,
      'document_id', v_document_id, 'document_title', v_document_title,
      'answered_by', (SELECT u.name FROM public.users u WHERE u.id = auth.uid())
    );
  ELSE
    IF v_before IS NULL THEN
      RAISE EXCEPTION 'dev_legal_gap_answer_write: no answer is on record for % on this matter — nothing to clear', v_gap_key;
    END IF;
  END IF;
  SELECT count(*) INTO v_count FROM public.legal_matter_gap_answers WHERE matter_id = v_matter.id;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'action', v_action,
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'gap_key', v_gap_key,
      'before', v_before,
      'after', v_after,
      'answers_on_matter', v_count,
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  -- The write, through the office's own RPCs as the caller. p_job_ids NULL: the matter's jobs stay as they are.
  IF v_action = 'answer' THEN
    v_result := public.legal_answer_gap(v_matter.payer_key, v_matter.customer_id, v_matter.payer_name, NULL, v_gap_key, v_answer, v_document_id, v_label);
  ELSE
    v_result := public.legal_clear_gap_answer(v_matter.id, v_gap_key);
  END IF;
  IF v_result ? 'error' THEN
    RAISE EXCEPTION 'dev_legal_gap_answer_write: %', v_result->>'error';
  END IF;
  RETURN jsonb_build_object('ok', true, 'action', v_action, 'matter_id', v_matter.id, 'gap_key', v_gap_key);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_gap_answer_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_gap_answer_write(jsonb, boolean) TO authenticated;
COMMENT ON FUNCTION public.dev_legal_gap_answer_write(jsonb, boolean) IS
  'The dev MCP''s gap-answer verbs (v2.6005): a dry-run wrapper over legal_answer_gap / legal_clear_gap_answer, devs only. p = { matter_id, gap_key, action? (answer | clear), answer?, label?, document_id? }. p_dry_run true names the matter, the gap, the answer before and after, how many answers the matter holds and whether the firm reads it; false writes the legal_matter_gap_answers row as the caller (or deletes it on clear). The matter must exist; its jobs are never changed.';
