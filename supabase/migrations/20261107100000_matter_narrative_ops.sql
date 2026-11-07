SET lock_timeout = '3s';

-- plan_matter_narrative takes section ops (v2.6623, punch list #278 PR 5). The matter's narrative for the firm was
-- edited whole (dev_legal_narrative_write, 20261007235000); the HR documents are edited a section at a time
-- (dev_person_doc_write, 20261107013000). One grammar for both: hr_doc_apply_ops carries the section ops — replace_section
-- (the lines under a heading, the heading kept; '' empties it), insert_after, append — against a text's headings, and
-- dev_legal_narrative_write takes markdown (the whole text) or ops, names each change in the dry run, and refuses a
-- write over a narrative saved since (expect_updated_at). The write still goes through the live legal_set_narrative.
-- No table.

-- The ops applied to a text: { after, changes: [...] }. Raises on a heading that is missing or appears twice, so the
-- caller's dry run says so.
CREATE OR REPLACE FUNCTION public.hr_doc_apply_ops(p_text text, p_ops jsonb, p_what text DEFAULT 'document')
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_after text := COALESCE(p_text, '');
  v_lines text[];
  v_new_lines text[];
  v_n int;
  v_op jsonb;
  v_opname text;
  v_md text;
  v_want text;
  v_matches int;
  v_start int;
  v_end int;
  v_level int;
  v_found text;
  v_removed text;
  v_changes jsonb := '[]'::jsonb;
  v_cap constant int := 6000;
BEGIN
  IF jsonb_typeof(p_ops) <> 'array' OR jsonb_array_length(p_ops) = 0 THEN
    RAISE EXCEPTION 'ops must be a list of at least one op';
  END IF;
  IF jsonb_array_length(p_ops) > 20 THEN
    RAISE EXCEPTION 'at most 20 ops a call';
  END IF;
  FOR v_op IN SELECT value FROM jsonb_array_elements(p_ops) LOOP
    v_opname := btrim(COALESCE(v_op->>'op', ''));
    IF v_opname NOT IN ('replace_section', 'insert_after', 'append') THEN
      RAISE EXCEPTION 'op must be replace_section, insert_after or append (got "%")', v_opname;
    END IF;
    IF jsonb_typeof(v_op->'markdown') <> 'string' THEN
      RAISE EXCEPTION 'op % needs markdown', v_opname;
    END IF;
    v_md := rtrim(v_op->>'markdown', E'\n');
    IF v_opname <> 'replace_section' AND btrim(v_md) = '' THEN
      RAISE EXCEPTION 'op % needs words', v_opname;
    END IF;
    v_lines := CASE WHEN v_after = '' THEN ARRAY[]::text[] ELSE regexp_split_to_array(v_after, E'\n') END;
    v_n := COALESCE(array_length(v_lines, 1), 0);
    v_new_lines := CASE WHEN v_md = '' THEN ARRAY[]::text[] ELSE regexp_split_to_array(v_md, E'\n') END;

    IF v_opname = 'append' THEN
      v_start := v_n + 1;
      IF v_n > 0 AND v_lines[v_n] <> '' THEN
        v_lines := v_lines || ARRAY[''];
      END IF;
      v_lines := v_lines || v_new_lines;
      v_changes := v_changes || jsonb_build_object('op', 'append', 'at_line', v_start, 'added_lines', array_length(v_new_lines, 1), 'added', left(v_md, v_cap));
    ELSE
      v_want := lower(btrim(replace(replace(regexp_replace(regexp_replace(COALESCE(v_op->>'heading', ''), '^\s*#{1,6}\s+', ''), '\s*#*\s*$', ''), '`', ''), '**', '')));
      IF v_want = '' THEN
        RAISE EXCEPTION 'op % needs heading (the section''s heading text)', v_opname;
      END IF;
      SELECT count(*), min(h.line_no), min(h.level), min(h.heading)
        INTO v_matches, v_start, v_level, v_found
        FROM public.hr_doc_headings(v_after) h
       WHERE lower(h.heading) = v_want;
      IF v_matches = 0 THEN
        RAISE EXCEPTION 'no heading "%" in the %. Its headings: %', v_op->>'heading', p_what,
          COALESCE((SELECT string_agg(h.heading, ' | ' ORDER BY h.line_no) FROM (SELECT * FROM public.hr_doc_headings(v_after) LIMIT 60) h), '(none)');
      END IF;
      IF v_matches > 1 THEN
        RAISE EXCEPTION 'the heading "%" appears % times in the %; make it unique first', v_op->>'heading', v_matches, p_what;
      END IF;
      SELECT COALESCE(min(h.line_no) - 1, v_n) INTO v_end
        FROM public.hr_doc_headings(v_after) h
       WHERE h.line_no > v_start AND h.level <= v_level;

      IF v_opname = 'replace_section' THEN
        v_removed := array_to_string(v_lines[v_start + 1 : v_end], E'\n');
        v_lines := v_lines[1 : v_start]
          || CASE WHEN v_md = '' THEN ARRAY[]::text[] ELSE ARRAY[''] || v_new_lines END
          || CASE WHEN v_end < v_n THEN ARRAY[''] ELSE ARRAY[]::text[] END
          || v_lines[v_end + 1 : v_n];
        v_changes := v_changes || jsonb_build_object(
          'op', 'replace_section', 'heading', v_found, 'level', v_level, 'from_line', v_start + 1, 'to_line', v_end,
          'removed_lines', v_end - v_start, 'added_lines', COALESCE(array_length(v_new_lines, 1), 0),
          'removed', left(v_removed, v_cap), 'added', left(v_md, v_cap));
      ELSE
        v_lines := v_lines[1 : v_end]
          || CASE WHEN v_end > 0 AND v_lines[v_end] <> '' THEN ARRAY[''] ELSE ARRAY[]::text[] END
          || v_new_lines
          || CASE WHEN v_end < v_n THEN ARRAY[''] ELSE ARRAY[]::text[] END
          || v_lines[v_end + 1 : v_n];
        v_changes := v_changes || jsonb_build_object(
          'op', 'insert_after', 'heading', v_found, 'level', v_level, 'at_line', v_end + 1,
          'added_lines', array_length(v_new_lines, 1), 'added', left(v_md, v_cap));
      END IF;
    END IF;
    v_after := array_to_string(v_lines, E'\n');
  END LOOP;
  RETURN jsonb_build_object('after', v_after, 'changes', v_changes);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.dev_legal_narrative_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_matter public.legal_matters%ROWTYPE;
  v_before text;
  v_md text;
  v_applied jsonb;
  v_changes jsonb;
  v_sections jsonb;
  v_expect timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: matter_id is required (a legal_matters.id)';
  END IF;
  SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: matter % not found', p->>'matter_id';
  END IF;
  IF (p ? 'markdown') = (p ? 'ops') THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: send markdown (the whole text) or ops (section edits), one of the two';
  END IF;
  v_before := COALESCE(v_matter.narrative_md, '');

  IF p ? 'expect_updated_at' AND NULLIF(btrim(p->>'expect_updated_at'), '') IS NOT NULL THEN
    v_expect := (p->>'expect_updated_at')::timestamptz;
    IF v_matter.narrative_updated_at IS NULL OR abs(extract(epoch FROM (v_matter.narrative_updated_at - v_expect))) > 0.001 THEN
      RAISE EXCEPTION 'dev_legal_narrative_write: the narrative was saved at %, after the version you loaded (%). Read it again and edit from that.',
        COALESCE(to_char(v_matter.narrative_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS"Z"'), 'never'),
        to_char(v_expect AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS"Z"');
    END IF;
  END IF;

  IF p ? 'markdown' THEN
    IF jsonb_typeof(p->'markdown') <> 'string' THEN
      RAISE EXCEPTION 'dev_legal_narrative_write: markdown must be text';
    END IF;
    v_md := btrim(p->>'markdown');
    v_changes := jsonb_build_array(jsonb_build_object(
      'op', 'rewrite',
      'removed_lines', CASE WHEN v_before = '' THEN 0 ELSE array_length(regexp_split_to_array(v_before, E'\n'), 1) END,
      'added_lines', CASE WHEN v_md = '' THEN 0 ELSE array_length(regexp_split_to_array(v_md, E'\n'), 1) END));
  ELSE
    BEGIN
      v_applied := public.hr_doc_apply_ops(v_before, p->'ops', 'narrative');
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'dev_legal_narrative_write: %', SQLERRM;
    END;
    v_md := btrim(v_applied->>'after');
    v_changes := v_applied->'changes';
  END IF;
  IF length(v_md) > 40000 THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: the narrative is longer than 40,000 characters';
  END IF;
  IF v_md = v_before THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: nothing changes — the narrative already reads that way';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('line', h.line_no, 'level', h.level, 'heading', h.heading) ORDER BY h.line_no), '[]'::jsonb)
    INTO v_sections
    FROM (SELECT * FROM public.hr_doc_headings(v_md) LIMIT 80) h;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'before', jsonb_build_object('chars', length(v_before), 'saved_at', v_matter.narrative_updated_at),
      'after', jsonb_build_object('chars', length(v_md)),
      'changes', v_changes,
      'sections', v_sections,
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  v_result := public.legal_set_narrative(v_matter.id, v_md);
  IF v_result ? 'error' THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: %', v_result->>'error';
  END IF;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_matter.id, 'chars', length(v_md), 'changes', jsonb_array_length(v_changes));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_narrative_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_narrative_write(jsonb, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hr_doc_apply_ops(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_doc_apply_ops(text, jsonb, text) TO authenticated;
