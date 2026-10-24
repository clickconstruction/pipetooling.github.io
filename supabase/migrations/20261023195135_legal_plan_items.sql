SET lock_timeout = '3s';

-- The Legal desk's Timeline tab (v2.5800): planned steps on a legal matter.
--
-- The office runs a case itself while counsel is away, and every party — the office, the firm
-- through its portal, a dev's agent through the dev MCP — needs one dated line of what has
-- happened and what is planned next, with notes. A PLANNED STEP is one more kind of
-- legal_matter_entries row, 'plan': occurred_on is the day it is planned for, body is what,
-- and meta carries { notes, done_at, done_by, source }. Reusing the stream means a planned step
-- inherits the office read policy (legal_office_can_read), the portal's service-role read,
-- hold-back from counsel (held_overrides, key plan:<id>), undo with a reason (legal_void_entry,
-- widened here) and the shaper that cuts what travels to the firm.
--
--   1. The kind CHECK gains 'plan'.
--   2. legal_plan_add / legal_plan_update / legal_plan_mark_done — office writes, gated like legal_add_entry.
--      Marking done stamps meta.done_at (the day) and meta.done_by; the row keeps the day it was planned for.
--   3. legal_void_entry lets the office undo a planned step it wrote (the firm undoes its own through the portal).
--   4. dev_legal_plan_write — the dev MCP's dry-run wrapper (plan_matter_plan_item → apply_matter_plan_item),
--      modeled on dev_legal_narrative_write: the dry run names the matter, the item and what changes; apply
--      writes through the three RPCs above with source 'mcp'.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

-- 1. The kind CHECK (the inline one from 20260911195745 is legal_matter_entries_kind_check; drop whatever holds kind).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_matter_entries'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%'
      AND conname <> 'legal_matter_entries_kind_check_v2'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_matter_entries DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_matter_entries ADD CONSTRAINT legal_matter_entries_kind_check_v2 CHECK (kind IN (
    'fee', 'cost', 'step', 'question', 'answer', 'payment_received', 'recovery_applied', 'note', 'plan'
  )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matter_entries VALIDATE CONSTRAINT legal_matter_entries_kind_check_v2;

COMMENT ON TABLE public.legal_matter_entries IS 'Append-only stream on a legal matter (v2.3313): the firm''s fees and costs, steps (demand · suit · judgment · settled), questions and the office''s answers, payments the firm reports and the office applies, notes — and since v2.5800 planned steps (kind ''plan'': occurred_on = the day planned for, body = what, meta = { notes, done_at, done_by, source office | firm | mcp }; held from counsel under held_overrides key plan:<id>). via_portal marks the firm''s own entries (PR 4); acknowledged_at clears them from the office''s Needs You.';

-- 2. Office: plan a step. p_source is 'office' unless the dev MCP's wrapper says 'mcp'.
CREATE OR REPLACE FUNCTION public.legal_plan_add(
  p_matter_id uuid, p_on date, p_body text, p_notes text DEFAULT '', p_source text DEFAULT 'office'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_body text := COALESCE(NULLIF(TRIM(p_body), ''), '');
  v_notes text := COALESCE(TRIM(p_notes), '');
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_matters WHERE id = p_matter_id) THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  IF p_on IS NULL THEN RETURN jsonb_build_object('error', 'Pick the day it is planned for'); END IF;
  IF v_body = '' THEN RETURN jsonb_build_object('error', 'Say what is planned'); END IF;
  IF length(v_body) > 500 THEN RETURN jsonb_build_object('error', 'Keep what is planned under 500 characters; the notes take the rest'); END IF;
  IF length(v_notes) > 4000 THEN RETURN jsonb_build_object('error', 'Keep the notes under 4,000 characters'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, occurred_on, meta, created_by)
  VALUES (p_matter_id, 'plan', v_body, p_on,
    jsonb_build_object('notes', v_notes, 'done_at', NULL, 'done_by', NULL, 'source', v_source), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_plan_add(uuid, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_plan_add(uuid, date, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_plan_add(uuid, date, text, text, text) IS 'Plan a step on a legal matter (v2.5800): a legal_matter_entries row of kind plan, dated the day it is planned for, with notes in meta. Office roles (legal_office_can_read). p_source: office, or mcp from dev_legal_plan_write.';

-- Office: change a planned step — the day, what, the notes. NULL leaves a field as it is; the firm's own planned
-- steps may be changed too (the office runs the matter), and the change is stamped in meta.
CREATE OR REPLACE FUNCTION public.legal_plan_update(
  p_entry_id uuid, p_on date DEFAULT NULL, p_body text DEFAULT NULL, p_notes text DEFAULT NULL, p_source text DEFAULT 'office'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_body text;
  v_notes text;
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Planned step not found'); END IF;
  IF v_entry.kind <> 'plan' THEN RETURN jsonb_build_object('error', 'Only a planned step can be changed here'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That planned step was undone'); END IF;
  v_body := COALESCE(NULLIF(TRIM(p_body), ''), v_entry.body);
  v_notes := CASE WHEN p_notes IS NULL THEN COALESCE(v_entry.meta->>'notes', '') ELSE TRIM(p_notes) END;
  IF length(v_body) > 500 THEN RETURN jsonb_build_object('error', 'Keep what is planned under 500 characters; the notes take the rest'); END IF;
  IF length(v_notes) > 4000 THEN RETURN jsonb_build_object('error', 'Keep the notes under 4,000 characters'); END IF;
  UPDATE public.legal_matter_entries
    SET occurred_on = COALESCE(p_on, occurred_on),
        body = v_body,
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('notes', v_notes, 'edited_at', now(), 'edited_by', auth.uid(), 'edited_source', v_source)
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_plan_update(uuid, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_plan_update(uuid, date, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_plan_update(uuid, date, text, text, text) IS 'Change a planned step (v2.5800): the day, what, the notes; NULL leaves a field as it is. Office roles. Refused on an undone step or any other kind.';

-- Office: a planned step happened. meta.done_at is the day (never ahead of today), meta.done_by the person; the row
-- keeps the day it was planned for, so the timeline can say "planned for the 13th, done the 10th".
CREATE OR REPLACE FUNCTION public.legal_plan_mark_done(
  p_entry_id uuid, p_done_on date DEFAULT NULL, p_note text DEFAULT NULL, p_source text DEFAULT 'office'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_on date := COALESCE(p_done_on, public.app_today());
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Planned step not found'); END IF;
  IF v_entry.kind <> 'plan' THEN RETURN jsonb_build_object('error', 'Only a planned step can be marked done'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That planned step was undone'); END IF;
  IF COALESCE(v_entry.meta->>'done_at', '') <> '' THEN RETURN jsonb_build_object('error', 'Already marked done on ' || (v_entry.meta->>'done_at')); END IF;
  IF v_on > public.app_today() THEN RETURN jsonb_build_object('error', 'The day it was done cannot be ahead of today'); END IF;
  UPDATE public.legal_matter_entries
    SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('done_at', to_char(v_on, 'YYYY-MM-DD'), 'done_by', auth.uid(), 'done_note', COALESCE(TRIM(p_note), ''), 'done_source', v_source)
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id, 'done_on', to_char(v_on, 'YYYY-MM-DD'));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_plan_mark_done(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_plan_mark_done(uuid, date, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_plan_mark_done(uuid, date, text, text) IS 'A planned step happened (v2.5800): stamps meta.done_at (a day, not ahead of today), meta.done_by and an optional note; the row keeps the day it was planned for. Office roles. Refused when already done or undone.';

-- 3. Undo: the office undoes a fee, cost, note or planned step it wrote (20261006160000's body, 'plan' added).
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
  IF v_entry.kind NOT IN ('fee', 'cost', 'note', 'plan') THEN RETURN jsonb_build_object('error', 'Only a fee, a cost, a note or a planned step can be undone here. Reverse an applied payment on the job.'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Already undone'); END IF;
  UPDATE public.legal_matter_entries
    SET voided_at = now(), voided_by = auth.uid(), voided_via_portal = false, void_reason = v_reason
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) TO authenticated;

-- 4. The dev MCP's wrapper: plan_matter_plan_item / apply_matter_plan_item. A dev only. The dry run names the matter,
-- the action, the item before (on update / mark_done) and what it becomes, and whether the firm reads it now; apply
-- writes through the three office RPCs with source 'mcp'. p = { matter_id | entry_id, action: add | update | mark_done,
-- on?, body?, notes?, done_on?, note? }.
CREATE OR REPLACE FUNCTION public.dev_legal_plan_write(p jsonb, p_dry_run boolean DEFAULT true)
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
  v_body text;
  v_notes text;
  v_done_on date;
  v_note text;
  v_before jsonb := NULL;
  v_after jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_plan_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('add', 'update', 'mark_done') THEN
    RAISE EXCEPTION 'dev_legal_plan_write: action must be add, update or mark_done';
  END IF;
  IF p ? 'on' AND COALESCE(p->>'on', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'dev_legal_plan_write: on must be a day, YYYY-MM-DD';
  END IF;
  IF p ? 'done_on' AND COALESCE(p->>'done_on', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'dev_legal_plan_write: done_on must be a day, YYYY-MM-DD';
  END IF;

  IF v_action = 'add' THEN
    IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_legal_plan_write: matter_id is required (a legal_matters.id)';
    END IF;
    SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_legal_plan_write: matter % not found', p->>'matter_id'; END IF;
    IF NOT (p ? 'on') THEN RAISE EXCEPTION 'dev_legal_plan_write: on is required — the day the step is planned for'; END IF;
    v_on := (p->>'on')::date;
    v_body := btrim(COALESCE(p->>'body', ''));
    IF v_body = '' THEN RAISE EXCEPTION 'dev_legal_plan_write: body is required — what is planned'; END IF;
    v_notes := btrim(COALESCE(p->>'notes', ''));
    v_after := jsonb_build_object('kind', 'plan', 'occurred_on', to_char(v_on, 'YYYY-MM-DD'), 'body', v_body, 'notes', v_notes, 'source', 'mcp');
  ELSE
    IF COALESCE(p->>'entry_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_legal_plan_write: entry_id is required (a legal_matter_entries.id of kind plan)';
    END IF;
    SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = (p->>'entry_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_legal_plan_write: entry % not found', p->>'entry_id'; END IF;
    IF v_entry.kind <> 'plan' THEN RAISE EXCEPTION 'dev_legal_plan_write: entry % is a %, not a planned step', v_entry.id, v_entry.kind; END IF;
    IF v_entry.voided_at IS NOT NULL THEN RAISE EXCEPTION 'dev_legal_plan_write: that planned step was undone (%)', v_entry.void_reason; END IF;
    SELECT * INTO v_matter FROM public.legal_matters WHERE id = v_entry.matter_id;
    v_before := jsonb_build_object(
      'id', v_entry.id, 'occurred_on', to_char(v_entry.occurred_on, 'YYYY-MM-DD'), 'body', v_entry.body,
      'notes', COALESCE(v_entry.meta->>'notes', ''), 'done_at', v_entry.meta->>'done_at',
      'via_portal', v_entry.via_portal, 'source', COALESCE(v_entry.meta->>'source', CASE WHEN v_entry.via_portal THEN 'firm' ELSE 'office' END)
    );
    IF v_action = 'update' THEN
      v_on := COALESCE((p->>'on')::date, v_entry.occurred_on);
      v_body := COALESCE(NULLIF(btrim(p->>'body'), ''), v_entry.body);
      v_notes := CASE WHEN p ? 'notes' THEN btrim(COALESCE(p->>'notes', '')) ELSE COALESCE(v_entry.meta->>'notes', '') END;
      v_after := jsonb_build_object('occurred_on', to_char(v_on, 'YYYY-MM-DD'), 'body', v_body, 'notes', v_notes);
    ELSE
      IF COALESCE(v_entry.meta->>'done_at', '') <> '' THEN
        RAISE EXCEPTION 'dev_legal_plan_write: already marked done on %', v_entry.meta->>'done_at';
      END IF;
      v_done_on := COALESCE((p->>'done_on')::date, public.app_today());
      IF v_done_on > public.app_today() THEN RAISE EXCEPTION 'dev_legal_plan_write: done_on cannot be ahead of today'; END IF;
      v_note := btrim(COALESCE(p->>'note', ''));
      v_after := jsonb_build_object('done_at', to_char(v_done_on, 'YYYY-MM-DD'), 'done_note', v_note);
    END IF;
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'action', v_action,
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'before', v_before,
      'after', v_after,
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  IF v_action = 'add' THEN
    v_result := public.legal_plan_add(v_matter.id, v_on, v_body, v_notes, 'mcp');
  ELSIF v_action = 'update' THEN
    v_result := public.legal_plan_update(v_entry.id, v_on, v_body, v_notes, 'mcp');
  ELSE
    v_result := public.legal_plan_mark_done(v_entry.id, v_done_on, v_note, 'mcp');
  END IF;
  IF v_result ? 'error' THEN
    RAISE EXCEPTION 'dev_legal_plan_write: %', v_result->>'error';
  END IF;
  RETURN jsonb_build_object('ok', true, 'action', v_action, 'matter_id', v_matter.id, 'entry_id', COALESCE(v_result->>'entry_id', v_entry.id::text));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_plan_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_plan_write(jsonb, boolean) TO authenticated;
COMMENT ON FUNCTION public.dev_legal_plan_write(jsonb, boolean) IS 'The dev MCP''s planned-step verbs (v2.5800): a dry-run wrapper over legal_plan_add / legal_plan_update / legal_plan_mark_done, devs only; the dry run names the matter, the item before and after, and whether the firm reads it; apply writes with source mcp.';
