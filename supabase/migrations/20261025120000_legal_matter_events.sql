SET lock_timeout = '3s';

-- The Legal desk's Timeline tab records what happened (punch list #167, v2.5836).
--
-- The Timeline (v2.5800) plans what is next and the firm's portal records the firm's acts, but the
-- office could not record something that already happened: a notice arriving, a supplier paid, a
-- sworn statement signed. On job 891 five such events went in as planned steps marked done after the
-- fact. An EVENT is one more kind of legal_matter_entries row, 'event' (the owner's call of
-- 2026-10-25: a kind of its own, not the firm's 'step' and not 'note'): occurred_on is the day it
-- happened (never ahead of today; it may be before the matter existed, since a case's story starts
-- months before its matter), body is what, and meta carries { notes, document_ids, source }. It
-- inherits the stream's office read policy, the portal's read, hold-back from counsel (held_overrides
-- key event:<id>) and undo with a reason.
--
--   1. The kind CHECK gains 'event'.
--   2. legal_event_add — the office's write, gated like legal_plan_add; the documents named must be
--      live documents of the same matter.
--   3. legal_void_entry lets the office undo an event it wrote.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

-- 1. The kind CHECK (v2 from 20261023195135; drop whatever holds kind, add v3).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_matter_entries'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%'
      AND conname <> 'legal_matter_entries_kind_check_v3'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_matter_entries DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_matter_entries ADD CONSTRAINT legal_matter_entries_kind_check_v3 CHECK (kind IN (
    'fee', 'cost', 'step', 'question', 'answer', 'payment_received', 'recovery_applied', 'note', 'plan', 'event'
  )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matter_entries VALIDATE CONSTRAINT legal_matter_entries_kind_check_v3;

COMMENT ON TABLE public.legal_matter_entries IS 'Append-only stream on a legal matter (v2.3313): the firm''s fees and costs, steps (demand · suit · judgment · settled), questions and the office''s answers, payments the firm reports and the office applies, notes — since v2.5800 planned steps (kind ''plan'': occurred_on = the day planned for, body = what, meta = { notes, done_at, done_by, source office | firm | mcp }; held from counsel under held_overrides key plan:<id>) and since v2.5836 events the office records (kind ''event'': occurred_on = the day it happened, never ahead of today, body = what, meta = { notes, document_ids, source }; held under event:<id>). via_portal marks the firm''s own entries (PR 4); acknowledged_at clears them from the office''s Needs You.';

-- 2. Office: record what happened. p_document_ids names the matter's Evidence documents that prove it.
CREATE OR REPLACE FUNCTION public.legal_event_add(
  p_matter_id uuid, p_on date, p_body text, p_notes text DEFAULT '', p_document_ids uuid[] DEFAULT '{}'::uuid[], p_source text DEFAULT 'office'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_body text := COALESCE(NULLIF(TRIM(p_body), ''), '');
  v_notes text := COALESCE(TRIM(p_notes), '');
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
  v_docs uuid[] := COALESCE(p_document_ids, '{}'::uuid[]);
  v_live int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_matters WHERE id = p_matter_id) THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  IF p_on IS NULL THEN RETURN jsonb_build_object('error', 'Pick the day it happened'); END IF;
  IF p_on > public.app_today() THEN RETURN jsonb_build_object('error', 'The day it happened cannot be ahead of today. Plan a step instead.'); END IF;
  IF v_body = '' THEN RETURN jsonb_build_object('error', 'Say what happened'); END IF;
  IF length(v_body) > 500 THEN RETURN jsonb_build_object('error', 'Keep what happened under 500 characters; the notes take the rest'); END IF;
  IF length(v_notes) > 4000 THEN RETURN jsonb_build_object('error', 'Keep the notes under 4,000 characters'); END IF;
  IF cardinality(v_docs) > 0 THEN
    SELECT count(*) INTO v_live FROM public.legal_matter_documents d
      WHERE d.id = ANY(v_docs) AND d.matter_id = p_matter_id AND d.voided_at IS NULL;
    IF v_live <> cardinality(v_docs) THEN RETURN jsonb_build_object('error', 'A document named is not on this matter''s Evidence'); END IF;
  END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, occurred_on, meta, created_by)
  VALUES (p_matter_id, 'event', v_body, p_on,
    jsonb_build_object('notes', v_notes, 'document_ids', to_jsonb(v_docs), 'source', v_source), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_event_add(uuid, date, text, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_event_add(uuid, date, text, text, uuid[], text) TO authenticated;
COMMENT ON FUNCTION public.legal_event_add(uuid, date, text, text, uuid[], text) IS 'Record what happened on a legal matter (v2.5836, punch list #167): a legal_matter_entries row of kind event, dated the day it happened (not ahead of today), with notes and the matter''s Evidence documents that prove it in meta. Office roles (legal_office_can_read). p_source: office, or mcp.';

-- 3. Undo: the office undoes a fee, cost, note, planned step or event it wrote (20261023195135's body, 'event' added).
CREATE OR REPLACE FUNCTION public.legal_void_entry(p_entry_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_reason text := COALESCE(NULLIF(TRIM(p_reason), ''), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF v_reason = '' THEN RETURN jsonb_build_object('error', 'Say why: the firm reads the reason'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Entry not found'); END IF;
  IF v_entry.via_portal THEN RETURN jsonb_build_object('error', 'The firm undoes its own entries; ask them in the conversation'); END IF;
  IF v_entry.kind NOT IN ('fee', 'cost', 'note', 'plan', 'event') THEN RETURN jsonb_build_object('error', 'Only a fee, a cost, a note, a planned step or an event can be undone here. Reverse an applied payment on the job.'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Already undone'); END IF;
  UPDATE public.legal_matter_entries
    SET voided_at = now(), voided_by = auth.uid(), voided_via_portal = false, void_reason = v_reason
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) TO authenticated;
