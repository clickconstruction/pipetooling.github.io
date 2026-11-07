SET lock_timeout = '3s';

-- get_person_document (v2.6621, punch list #278 PR 3): a document on a person's HR file read a piece at a time, so a
-- 300 KB document never crosses the door whole. dev_doc_read answers, as a dev only, with the section index of a named
-- document (by id) or of the summary or narrative (by kind) — every heading with its number, level, line and size — and,
-- when a section is named by its number or its heading, that section's text alone with its neighbours named. The
-- sections are cut as hr_doc_headings (20261107013000) reads the headings and as dev_person_doc_write's ops name them,
-- so read and write use one grammar. No table; the slicing stands on its own, with no other function of this week's.

CREATE OR REPLACE FUNCTION public.dev_doc_read(p_person_id uuid, p_doc_id uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_section text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_text text;
  v_target jsonb;
  v_lines text[];
  v_total int;
  v_heads jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_h record;
  v_i int := 0;
  v_count int;
  v_starts int[] := ARRAY[]::int[];
  v_ends int[] := ARRAY[]::int[];
  v_ns int[] := ARRAY[]::int[];
  v_headings text[] := ARRAY[]::text[];
  v_levels int[] := ARRAY[]::int[];
  v_want_n int;
  v_want text;
  v_pick int := 0;
  v_matches int := 0;
  v_body text;
  v_cap constant int := 200000;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_doc_read: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'dev_doc_read: person_id is required';
  END IF;
  IF (p_doc_id IS NULL) = (COALESCE(btrim(p_kind), '') = '') THEN
    RAISE EXCEPTION 'dev_doc_read: name the document — doc_id (a named document) or kind (summary | narrative), one of the two';
  END IF;

  IF p_doc_id IS NOT NULL THEN
    SELECT d.content, jsonb_build_object('doc_id', d.id, 'title', d.title, 'counsel_only', d.counsel_only, 'archived_at', d.archived_at,
                                         'updated_at', d.updated_at, 'kept_by', d.author_label, 'chars', length(d.content))
      INTO v_text, v_target
      FROM public.person_documents d WHERE d.id = p_doc_id AND d.person_id = p_person_id;
    IF v_text IS NULL THEN
      RAISE EXCEPTION 'dev_doc_read: no document % on this person', p_doc_id;
    END IF;
  ELSE
    IF btrim(p_kind) NOT IN ('summary', 'narrative') THEN
      RAISE EXCEPTION 'dev_doc_read: kind must be summary or narrative';
    END IF;
    SELECT f.content, jsonb_build_object('kind', f.kind, 'title', f.kind, 'counsel_only', false, 'archived_at', NULL,
                                         'updated_at', f.updated_at, 'kept_by', f.author_label, 'covered_through', f.covered_through, 'chars', length(f.content))
      INTO v_text, v_target
      FROM public.person_files f WHERE f.person_id = p_person_id AND f.kind = btrim(p_kind);
    IF v_text IS NULL THEN
      RAISE EXCEPTION 'dev_doc_read: this person has no % yet', btrim(p_kind);
    END IF;
  END IF;

  v_lines := CASE WHEN v_text = '' THEN ARRAY[]::text[] ELSE regexp_split_to_array(v_text, E'\n') END;
  v_total := COALESCE(array_length(v_lines, 1), 0);

  -- The sections: a preamble when words come before the first heading, then one a heading.
  FOR v_h IN
    SELECT h.line_no, h.level, h.heading, (regexp_match(h.heading, '^\s*(?:§\s*)?(\d{1,3})(?:[.:)]|\s+[-–—]|\s)'))[1]::int AS num
      FROM public.hr_doc_headings(v_text) h ORDER BY h.line_no
  LOOP
    IF v_i = 0 AND v_h.line_no > 1 AND btrim(array_to_string(v_lines[1 : v_h.line_no - 1], E'\n')) <> '' THEN
      v_i := v_i + 1;
      v_starts[v_i] := 1; v_ends[v_i] := v_h.line_no - 1; v_ns[v_i] := NULL; v_headings[v_i] := NULL; v_levels[v_i] := 0;
    END IF;
    IF v_i > 0 AND v_headings[v_i] IS NOT NULL THEN
      v_ends[v_i] := v_h.line_no - 1;
    ELSIF v_i > 0 THEN
      v_ends[v_i] := v_h.line_no - 1;
    END IF;
    v_i := v_i + 1;
    v_starts[v_i] := v_h.line_no; v_ends[v_i] := v_total; v_ns[v_i] := v_h.num; v_headings[v_i] := v_h.heading; v_levels[v_i] := v_h.level;
  END LOOP;
  IF v_i = 0 AND v_total > 0 THEN
    v_i := 1;
    v_starts[1] := 1; v_ends[1] := v_total; v_ns[1] := NULL; v_headings[1] := NULL; v_levels[1] := 0;
  END IF;
  v_count := v_i;

  FOR v_i IN 1 .. v_count LOOP
    v_sections := v_sections || jsonb_build_object(
      'i', v_i, 'n', v_ns[v_i], 'heading', v_headings[v_i], 'level', v_levels[v_i],
      'from_line', v_starts[v_i], 'to_line', v_ends[v_i],
      'chars', length(array_to_string(v_lines[v_starts[v_i] : v_ends[v_i]], E'\n')));
  END LOOP;

  IF COALESCE(btrim(p_section), '') = '' THEN
    RETURN jsonb_build_object('target', v_target, 'lines', v_total, 'sections', v_sections, 'section', NULL);
  END IF;

  -- The section asked for: a number (as the heading carries it), else a heading's text, exact then by its start.
  v_want := lower(btrim(p_section));
  IF v_want ~ '^\d{1,3}$' THEN
    v_want_n := v_want::int;
    FOR v_i IN 1 .. v_count LOOP
      IF v_ns[v_i] = v_want_n THEN v_matches := v_matches + 1; IF v_pick = 0 THEN v_pick := v_i; END IF; END IF;
    END LOOP;
  ELSE
    FOR v_i IN 1 .. v_count LOOP
      IF v_headings[v_i] IS NOT NULL AND lower(v_headings[v_i]) = v_want THEN v_matches := v_matches + 1; IF v_pick = 0 THEN v_pick := v_i; END IF; END IF;
    END LOOP;
    IF v_matches = 0 THEN
      FOR v_i IN 1 .. v_count LOOP
        IF v_headings[v_i] IS NOT NULL AND lower(v_headings[v_i]) LIKE v_want || '%' THEN v_matches := v_matches + 1; IF v_pick = 0 THEN v_pick := v_i; END IF; END IF;
      END LOOP;
    END IF;
  END IF;
  IF v_matches = 0 THEN
    RAISE EXCEPTION 'dev_doc_read: no section "%" here. The sections: %', p_section,
      COALESCE((SELECT string_agg(COALESCE(s->>'heading', '(before the first heading)'), ' | ') FROM jsonb_array_elements(v_sections) s), '(none)');
  END IF;
  IF v_matches > 1 THEN
    RAISE EXCEPTION 'dev_doc_read: "%" names % sections here; ask by the full heading', p_section, v_matches;
  END IF;

  v_body := array_to_string(v_lines[v_starts[v_pick] : v_ends[v_pick]], E'\n');
  RETURN jsonb_build_object(
    'target', v_target,
    'lines', v_total,
    'sections', v_sections,
    'section', jsonb_build_object(
      'i', v_pick, 'n', v_ns[v_pick], 'heading', v_headings[v_pick], 'level', v_levels[v_pick],
      'from_line', v_starts[v_pick], 'to_line', v_ends[v_pick], 'chars', length(v_body),
      'body', left(v_body, v_cap), 'cut', length(v_body) > v_cap,
      'before', CASE WHEN v_pick > 1 THEN jsonb_build_object('n', v_ns[v_pick - 1], 'heading', v_headings[v_pick - 1]) ELSE NULL END,
      'after', CASE WHEN v_pick < v_count THEN jsonb_build_object('n', v_ns[v_pick + 1], 'heading', v_headings[v_pick + 1]) ELSE NULL END)
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_doc_read(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_doc_read(uuid, uuid, text, text) TO authenticated;
