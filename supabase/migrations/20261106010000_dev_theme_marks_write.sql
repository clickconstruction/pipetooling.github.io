SET lock_timeout = '3s';
-- v2.6552: dev_theme_marks_write — the dev MCP's dry-run wrapper for themes marked on the record
-- (plan_theme_marks → apply_theme_marks), modeled on dev_legal_gap_answer_write. A mark hangs a theme
-- (legal_themes, v2.6545) on something that already exists — an HR entry, a piece of evidence, a matter's
-- document or event — with why it fits and how it proves the theme. The dry run resolves every mark: the
-- theme must stand, the thing must exist (and names the person or the matter it is on), and a live mark
-- of that theme on that thing reads as already; apply inserts the ready ones AS THE DEV (marked_by), kept
-- (the default: the owner said Apply it) or proposed (dashed in the app until a dev keeps it).
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

CREATE OR REPLACE FUNCTION public.dev_theme_marks_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_stand text := lower(btrim(COALESCE(p->>'stand', 'kept')));
  v_marks jsonb := p->'marks';
  v_mark jsonb;
  v_seq integer := 0;
  v_theme public.legal_themes%ROWTYPE;
  v_kind text;
  v_target uuid;
  v_person uuid;
  v_matter uuid;
  v_words text;
  v_why text;
  v_proves text;
  v_state text;
  v_reason text;
  v_rows jsonb := '[]'::jsonb;
  v_ready integer := 0;
  v_already integer := 0;
  v_held integer := 0;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_theme_marks_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF v_stand NOT IN ('kept', 'proposed') THEN
    RAISE EXCEPTION 'dev_theme_marks_write: stand must be kept or proposed';
  END IF;
  IF v_marks IS NULL OR jsonb_typeof(v_marks) <> 'array' OR jsonb_array_length(v_marks) = 0 OR jsonb_array_length(v_marks) > 100 THEN
    RAISE EXCEPTION 'dev_theme_marks_write: marks is required — 1 to 100 of { theme_id, target_kind, target_id, why?, proves_by? }';
  END IF;

  FOR v_mark IN SELECT * FROM jsonb_array_elements(v_marks) LOOP
    v_seq := v_seq + 1;
    v_state := 'ready'; v_reason := NULL; v_person := NULL; v_matter := NULL; v_words := NULL; v_theme := NULL;
    v_kind := lower(btrim(COALESCE(v_mark->>'target_kind', '')));
    v_why := btrim(COALESCE(v_mark->>'why', ''));
    v_proves := NULLIF(lower(btrim(COALESCE(v_mark->>'proves_by', ''))), '');
    IF COALESCE(v_mark->>'theme_id', '') !~ '^[0-9a-fA-F-]{36}$' OR COALESCE(v_mark->>'target_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_theme_marks_write: mark % needs theme_id and target_id (uuids)', v_seq;
    END IF;
    IF v_kind NOT IN ('hr_entry', 'hr_evidence', 'matter_document', 'matter_entry') THEN
      RAISE EXCEPTION 'dev_theme_marks_write: mark % target_kind must be hr_entry, hr_evidence, matter_document or matter_entry', v_seq;
    END IF;
    IF length(v_why) > 200 THEN RAISE EXCEPTION 'dev_theme_marks_write: mark % — keep why under 200 characters', v_seq; END IF;
    IF v_proves IS NOT NULL AND v_proves NOT IN ('document', 'own_words', 'firsthand', 'relayed') THEN
      RAISE EXCEPTION 'dev_theme_marks_write: mark % proves_by must be document, own_words, firsthand or relayed', v_seq;
    END IF;
    v_target := (v_mark->>'target_id')::uuid;

    SELECT * INTO v_theme FROM public.legal_themes WHERE id = (v_mark->>'theme_id')::uuid;
    IF NOT FOUND THEN
      v_state := 'held'; v_reason := 'no theme with that id';
    ELSIF v_theme.retired_at IS NOT NULL THEN
      v_state := 'held'; v_reason := format('%s is retired', v_theme.name);
    END IF;

    IF v_state = 'ready' THEN
      IF v_kind = 'hr_entry' THEN
        SELECT e.person_id, left(e.content, 80) INTO v_person, v_words FROM public.person_file_entries e WHERE e.id = v_target;
      ELSIF v_kind = 'hr_evidence' THEN
        SELECT r.person_id, left(r.title, 80) INTO v_person, v_words FROM public.person_file_evidence r WHERE r.id = v_target;
      ELSIF v_kind = 'matter_document' THEN
        SELECT d.matter_id, left(d.title, 80) INTO v_matter, v_words FROM public.legal_matter_documents d WHERE d.id = v_target AND d.voided_at IS NULL;
      ELSE
        SELECT x.matter_id, left(x.body, 80) INTO v_matter, v_words FROM public.legal_matter_entries x WHERE x.id = v_target AND x.voided_at IS NULL;
      END IF;
      IF v_person IS NULL AND v_matter IS NULL THEN
        v_state := 'held'; v_reason := format('no live %s with that id', replace(v_kind, '_', ' '));
      ELSIF EXISTS (SELECT 1 FROM public.legal_theme_marks m WHERE m.theme_id = v_theme.id AND m.target_kind = v_kind AND m.target_id = v_target AND m.removed_at IS NULL) THEN
        v_state := 'already'; v_reason := format('%s is on it already', v_theme.name);
      END IF;
    END IF;

    IF v_state = 'ready' THEN v_ready := v_ready + 1; ELSIF v_state = 'already' THEN v_already := v_already + 1; ELSE v_held := v_held + 1; END IF;

    IF NOT p_dry_run AND v_state = 'ready' THEN
      INSERT INTO public.legal_theme_marks (theme_id, target_kind, target_id, person_id, matter_id, why, proves_by, marked_by, marked_at, author_label, proposed, kept_at, kept_by)
      VALUES (v_theme.id, v_kind, v_target, v_person, v_matter, v_why, v_proves, auth.uid(), v_now, 'dev seat', v_stand = 'proposed',
              CASE WHEN v_stand = 'kept' THEN v_now ELSE NULL END, CASE WHEN v_stand = 'kept' THEN auth.uid() ELSE NULL END)
      RETURNING id INTO v_id;
      v_ids := v_ids || v_id;
    END IF;

    v_rows := v_rows || jsonb_build_object(
      'seq', v_seq, 'state', v_state, 'reason', v_reason,
      'theme', CASE WHEN v_theme.id IS NULL THEN NULL ELSE v_theme.name END,
      'target_kind', v_kind, 'target_id', v_target, 'target_words', v_words,
      'person_id', v_person, 'matter_id', v_matter, 'why', v_why, 'proves_by', v_proves
    );
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'stand', v_stand,
      'marked_by', (SELECT u.name FROM public.users u WHERE u.id = auth.uid()),
      'ready', v_ready, 'already', v_already, 'held', v_held,
      'marks', v_rows
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'stand', v_stand, 'made', v_ready, 'already', v_already, 'held', v_held, 'mark_ids', to_jsonb(v_ids), 'marks', v_rows);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_theme_marks_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_theme_marks_write(jsonb, boolean) TO authenticated;
COMMENT ON FUNCTION public.dev_theme_marks_write(jsonb, boolean) IS
  'The dev MCP''s theme-mark verbs (v2.6552): a dry-run wrapper that puts themes on HR entries, evidence records, matter documents and matter events as the dev, devs only. p = { stand? (kept | proposed), marks: [{ theme_id, target_kind, target_id, why?, proves_by? }] }; the dry run resolves each mark (ready | already | held with a reason), apply inserts the ready ones.';
