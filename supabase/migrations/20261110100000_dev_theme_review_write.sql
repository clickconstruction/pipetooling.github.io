SET lock_timeout = '3s';
-- v2.6844: dev_theme_review_write — the dev MCP's dry-run wrapper for the review of marks already on the
-- record (plan_theme_review → apply_theme_review), beside dev_theme_marks_write, which makes them. A mark an
-- agent proposed is dashed in the app until a dev keeps it, and the only door that kept one was the Keep press,
-- one mark at a time; a mark that does not fit comes off with a reason and is made again. This is the same two
-- acts in one plan: keep the proposed marks named, take the named marks off with the reason given for each.
--
-- The dry run resolves every mark: ready, already (kept already, or off already) or held with its reason (no
-- mark with that id, a mark that was taken off cannot be kept). Apply stamps the ready ones AS THE DEV
-- (kept_at / kept_by, or removed_at / removed_by / removed_why) — the two changes the marks table's own trigger
-- lets through — and skips the rest; a mark is never deleted and never reworded.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

CREATE OR REPLACE FUNCTION public.dev_theme_review_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_keep jsonb := COALESCE(p->'keep', '[]'::jsonb);
  v_off jsonb := COALESCE(p->'take_off', '[]'::jsonb);
  v_item jsonb;
  v_act text;
  v_seq integer := 0;
  v_id uuid;
  v_off_why text;
  v_mark public.legal_theme_marks%ROWTYPE;
  v_theme text;
  v_words text;
  v_state text;
  v_reason text;
  v_seen uuid[] := '{}';
  v_rows jsonb := '[]'::jsonb;
  v_keep_ready integer := 0;
  v_keep_already integer := 0;
  v_keep_held integer := 0;
  v_off_ready integer := 0;
  v_off_already integer := 0;
  v_off_held integer := 0;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_theme_review_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_keep) <> 'array' OR jsonb_typeof(v_off) <> 'array' THEN
    RAISE EXCEPTION 'dev_theme_review_write: keep is a list of mark ids and take_off a list of { id, why }';
  END IF;
  IF jsonb_array_length(v_keep) + jsonb_array_length(v_off) = 0 OR jsonb_array_length(v_keep) + jsonb_array_length(v_off) > 200 THEN
    RAISE EXCEPTION 'dev_theme_review_write: name 1 to 200 marks across keep and take_off';
  END IF;

  -- The keeps in the order given, then the take offs in theirs: the plan's rows are numbered the same way every run.
  FOR v_item, v_act IN
    SELECT q.value, q.act FROM (
      SELECT k.value, 'keep'::text AS act, 1 AS part, k.n FROM jsonb_array_elements(v_keep) WITH ORDINALITY AS k(value, n)
      UNION ALL
      SELECT t.value, 'take_off'::text, 2, t.n FROM jsonb_array_elements(v_off) WITH ORDINALITY AS t(value, n)
    ) q ORDER BY q.part, q.n
  LOOP
    v_seq := v_seq + 1;
    v_state := 'ready'; v_reason := NULL; v_theme := NULL; v_words := NULL; v_off_why := NULL; v_mark := NULL;

    IF v_act = 'keep' THEN
      IF jsonb_typeof(v_item) <> 'string' OR (v_item #>> '{}') !~ '^[0-9a-fA-F-]{36}$' THEN
        RAISE EXCEPTION 'dev_theme_review_write: keep % must be a mark id (a uuid)', v_seq;
      END IF;
      v_id := (v_item #>> '{}')::uuid;
    ELSE
      IF jsonb_typeof(v_item) <> 'object' OR COALESCE(v_item->>'id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
        RAISE EXCEPTION 'dev_theme_review_write: take_off % needs id (a mark id) and why', v_seq;
      END IF;
      v_id := (v_item->>'id')::uuid;
      v_off_why := btrim(COALESCE(v_item->>'why', ''));
      IF v_off_why = '' OR length(v_off_why) > 200 THEN
        RAISE EXCEPTION 'dev_theme_review_write: take_off % needs why — the reason it comes off, up to 200 characters', v_seq;
      END IF;
    END IF;
    IF v_id = ANY (v_seen) THEN
      RAISE EXCEPTION 'dev_theme_review_write: mark % is named twice — one act a mark a plan', v_id;
    END IF;
    v_seen := v_seen || v_id;

    SELECT * INTO v_mark FROM public.legal_theme_marks m WHERE m.id = v_id;
    IF NOT FOUND THEN
      v_state := 'held'; v_reason := 'no mark with that id';
    ELSE
      SELECT t.name INTO v_theme FROM public.legal_themes t WHERE t.id = v_mark.theme_id;
      IF v_mark.target_kind = 'hr_entry' THEN
        SELECT left(e.content, 80) INTO v_words FROM public.person_file_entries e WHERE e.id = v_mark.target_id;
      ELSIF v_mark.target_kind = 'hr_evidence' THEN
        SELECT left(r.title, 80) INTO v_words FROM public.person_file_evidence r WHERE r.id = v_mark.target_id;
      ELSIF v_mark.target_kind = 'matter_document' THEN
        SELECT left(d.title, 80) INTO v_words FROM public.legal_matter_documents d WHERE d.id = v_mark.target_id;
      ELSE
        SELECT left(x.body, 80) INTO v_words FROM public.legal_matter_entries x WHERE x.id = v_mark.target_id;
      END IF;

      IF v_act = 'keep' THEN
        IF v_mark.removed_at IS NOT NULL THEN
          v_state := 'held'; v_reason := format('taken off on %s; a mark that came off is made again, not kept', to_char(v_mark.removed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'));
        ELSIF v_mark.kept_at IS NOT NULL OR NOT v_mark.proposed THEN
          v_state := 'already'; v_reason := 'kept already';
        END IF;
      ELSIF v_mark.removed_at IS NOT NULL THEN
        v_state := 'already'; v_reason := format('off already, since %s', to_char(v_mark.removed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'));
      END IF;
    END IF;

    IF v_act = 'keep' THEN
      IF v_state = 'ready' THEN v_keep_ready := v_keep_ready + 1; ELSIF v_state = 'already' THEN v_keep_already := v_keep_already + 1; ELSE v_keep_held := v_keep_held + 1; END IF;
    ELSE
      IF v_state = 'ready' THEN v_off_ready := v_off_ready + 1; ELSIF v_state = 'already' THEN v_off_already := v_off_already + 1; ELSE v_off_held := v_off_held + 1; END IF;
    END IF;

    IF NOT p_dry_run AND v_state = 'ready' THEN
      IF v_act = 'keep' THEN
        UPDATE public.legal_theme_marks SET kept_at = v_now, kept_by = auth.uid() WHERE id = v_id AND removed_at IS NULL AND kept_at IS NULL;
      ELSE
        UPDATE public.legal_theme_marks SET removed_at = v_now, removed_by = auth.uid(), removed_why = v_off_why WHERE id = v_id AND removed_at IS NULL;
      END IF;
    END IF;

    v_rows := v_rows || jsonb_build_object(
      'seq', v_seq, 'act', v_act, 'state', v_state, 'reason', v_reason, 'mark_id', v_id,
      'theme', v_theme, 'target_kind', v_mark.target_kind, 'target_id', v_mark.target_id, 'target_words', v_words,
      'person_id', v_mark.person_id, 'matter_id', v_mark.matter_id,
      'why', v_mark.why, 'proves_by', v_mark.proves_by, 'proposed', v_mark.proposed, 'take_off_why', v_off_why
    );
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'reviewed_by', (SELECT u.name FROM public.users u WHERE u.id = auth.uid()),
      'keep', jsonb_build_object('ready', v_keep_ready, 'already', v_keep_already, 'held', v_keep_held),
      'take_off', jsonb_build_object('ready', v_off_ready, 'already', v_off_already, 'held', v_off_held),
      'marks', v_rows
    );
  END IF;
  RETURN jsonb_build_object(
    'ok', true, 'kept', v_keep_ready, 'taken_off', v_off_ready,
    'already', v_keep_already + v_off_already, 'held', v_keep_held + v_off_held,
    'marks', v_rows
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_theme_review_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_theme_review_write(jsonb, boolean) TO authenticated;
COMMENT ON FUNCTION public.dev_theme_review_write(jsonb, boolean) IS
  'The dev MCP''s theme-review verbs (v2.6844): a dry-run wrapper that keeps proposed theme marks and takes marks off with a reason, as the dev, devs only. p = { keep?: [mark id], take_off?: [{ id, why }] }, 1 to 200 marks across the two; the dry run resolves each (ready | already | held with a reason), apply stamps the ready ones. A mark is never deleted or reworded.';
