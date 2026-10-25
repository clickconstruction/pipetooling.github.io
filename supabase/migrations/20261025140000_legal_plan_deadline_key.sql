SET lock_timeout = '3s';

-- Punch list #170 (v2.5842): a planned step on the Legal desk's Timeline names the lien deadline it serves.
--
-- The Timeline now draws the lien clock's deadlines (each § 53.056 month, § 53.057, the affidavit, suit)
-- as read-only items beside the planned steps, so the typed steps and the statute's days sit on one
-- line. A planned step may name the deadline it serves: meta.deadline_key, the clock's own key for
-- the step on that job (`deadline:<job id>:<step key>`), set by the office when it plans or changes the
-- step. The line then draws the two together and says in red when the step falls after its deadline.
--
--   legal_plan_add / legal_plan_update gain p_deadline_key (NULL = leave it; '' = clear it on update).
--   The five-argument signatures are dropped first so PostgREST sees one function of each name;
--   dev_legal_plan_write calls them positionally and keeps working with the default.
--
-- Additive and idempotent; no table is created, so no fence is owed.

DROP FUNCTION IF EXISTS public.legal_plan_add(uuid, date, text, text, text);
CREATE OR REPLACE FUNCTION public.legal_plan_add(
  p_matter_id uuid, p_on date, p_body text, p_notes text DEFAULT '', p_source text DEFAULT 'office', p_deadline_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_body text := COALESCE(NULLIF(TRIM(p_body), ''), '');
  v_notes text := COALESCE(TRIM(p_notes), '');
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
  v_deadline text := NULLIF(TRIM(COALESCE(p_deadline_key, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_matters WHERE id = p_matter_id) THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  IF p_on IS NULL THEN RETURN jsonb_build_object('error', 'Pick the day it is planned for'); END IF;
  IF v_body = '' THEN RETURN jsonb_build_object('error', 'Say what is planned'); END IF;
  IF length(v_body) > 500 THEN RETURN jsonb_build_object('error', 'Keep what is planned under 500 characters; the notes take the rest'); END IF;
  IF length(v_notes) > 4000 THEN RETURN jsonb_build_object('error', 'Keep the notes under 4,000 characters'); END IF;
  IF v_deadline IS NOT NULL AND length(v_deadline) > 200 THEN RETURN jsonb_build_object('error', 'That deadline key is too long'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, occurred_on, meta, created_by)
  VALUES (p_matter_id, 'plan', v_body, p_on,
    jsonb_build_object('notes', v_notes, 'done_at', NULL, 'done_by', NULL, 'source', v_source, 'deadline_key', v_deadline), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_plan_add(uuid, date, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_plan_add(uuid, date, text, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_plan_add(uuid, date, text, text, text, text) IS 'Plan a step on a legal matter (v2.5800): a legal_matter_entries row of kind plan, dated the day it is planned for, with notes in meta. Office roles (legal_office_can_read). p_source: office, or mcp from dev_legal_plan_write. p_deadline_key (v2.5842): the lien clock deadline the step serves, deadline:<job id>:<step key>, or NULL.';

DROP FUNCTION IF EXISTS public.legal_plan_update(uuid, date, text, text, text);
CREATE OR REPLACE FUNCTION public.legal_plan_update(
  p_entry_id uuid, p_on date DEFAULT NULL, p_body text DEFAULT NULL, p_notes text DEFAULT NULL, p_source text DEFAULT 'office', p_deadline_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_body text;
  v_notes text;
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
  v_meta jsonb;
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
  IF p_deadline_key IS NOT NULL AND length(p_deadline_key) > 200 THEN RETURN jsonb_build_object('error', 'That deadline key is too long'); END IF;
  v_meta := COALESCE(v_entry.meta, '{}'::jsonb) || jsonb_build_object('notes', v_notes, 'edited_at', now(), 'edited_by', auth.uid(), 'edited_source', v_source);
  -- NULL leaves the tie as it is; '' clears it; anything else names a deadline.
  IF p_deadline_key IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('deadline_key', NULLIF(TRIM(p_deadline_key), ''));
  END IF;
  UPDATE public.legal_matter_entries
    SET occurred_on = COALESCE(p_on, occurred_on),
        body = v_body,
        meta = v_meta
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_plan_update(uuid, date, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_plan_update(uuid, date, text, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_plan_update(uuid, date, text, text, text, text) IS 'Change a planned step (v2.5800): the day, what, the notes; NULL leaves a field as it is. p_deadline_key (v2.5842): NULL leaves the tie, '''' clears it. Office roles. Refused on an undone step or any other kind.';
