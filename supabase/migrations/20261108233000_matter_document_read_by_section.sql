SET lock_timeout = '3s';

-- get_matter_document (v2.6722, punch list #288 PR 3): a text document on a matter's Evidence tab read a section at a time, as
-- get_person_document (v2.6621) reads a named document on an HR file. The slice is lifted out of dev_doc_read into hr_doc_slice
-- so the two reads share one grammar; dev_doc_read and dev_doc_history (v2.6622) move off the old-name view onto the
-- documents table itself (v2.6716's rename). dev_person_doc_write stays on that view: #286 and #287 replace it in the same week,
-- and the later of their stamps carries both; it moves with the next PR that touches it. No table, no column, so no fence is owed.

-- The section grammar every document read uses (v2.6722): the index of a text's sections — the preamble when words come before
-- the first heading, then one a heading, with its number as the heading carries it — and, when a section is named by its
-- number or heading, that section's text alone with its neighbours named. Cut as hr_doc_headings (20261107013000) reads the
-- headings, so read and write use one grammar. Lifted whole from dev_doc_read (20261107080000); p_who names the caller in a refusal.
CREATE OR REPLACE FUNCTION public.hr_doc_slice(p_text text, p_section text DEFAULT NULL, p_who text DEFAULT 'the document')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
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
  v_lines := CASE WHEN p_text = '' THEN ARRAY[]::text[] ELSE regexp_split_to_array(p_text, E'\n') END;
  v_total := COALESCE(array_length(v_lines, 1), 0);

  -- The sections: a preamble when words come before the first heading, then one a heading.
  FOR v_h IN
    SELECT h.line_no, h.level, h.heading, (regexp_match(h.heading, '^\s*(?:§\s*)?(\d{1,3})(?:[.:)]|\s+[-–—]|\s)'))[1]::int AS num
      FROM public.hr_doc_headings(p_text) h ORDER BY h.line_no
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
    RETURN jsonb_build_object('lines', v_total, 'sections', v_sections, 'section', NULL);
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
    RAISE EXCEPTION '%: no section "%" here. The sections: %', p_who, p_section,
      COALESCE((SELECT string_agg(COALESCE(s->>'heading', '(before the first heading)'), ' | ') FROM jsonb_array_elements(v_sections) s), '(none)');
  END IF;
  IF v_matches > 1 THEN
    RAISE EXCEPTION '%: "%" names % sections here; ask by the full heading', p_who, p_section, v_matches;
  END IF;

  v_body := array_to_string(v_lines[v_starts[v_pick] : v_ends[v_pick]], E'\n');
  RETURN jsonb_build_object(
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
REVOKE EXECUTE ON FUNCTION public.hr_doc_slice(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_doc_slice(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dev_doc_read(p_person_id uuid, p_doc_id uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_section text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_text text;
  v_target jsonb;
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
      FROM public.documents d WHERE d.id = p_doc_id AND d.person_id = p_person_id;
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

  RETURN jsonb_build_object('target', v_target) || public.hr_doc_slice(v_text, p_section, 'dev_doc_read');
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_doc_read(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_doc_read(uuid, uuid, text, text) TO authenticated;

-- A text document on a matter's Evidence tab, read a piece at a time (v2.6722): the Evidence row by id on the matter, its words
-- from documents through text_document_id, then the same slice a named document gets. A paper that is a file alone is refused
-- with what it is; a counsel-only paper (v2.6720) is refused to the seat as deployed and read, marked, by a dev signed in.
CREATE OR REPLACE FUNCTION public.dev_matter_doc_read(p_matter_id uuid, p_doc_id uuid, p_section text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_row public.legal_matter_documents%ROWTYPE;
  v_text text;
  v_target jsonb;
  v_held integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_matter_doc_read: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_matter_id IS NULL OR p_doc_id IS NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: matter_id and doc_id (the Evidence row) are required';
  END IF;
  SELECT * INTO v_row FROM public.legal_matter_documents d WHERE d.id = p_doc_id AND d.matter_id = p_matter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_matter_doc_read: no document % on this matter', p_doc_id;
  END IF;
  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: document % was removed from the matter', p_doc_id;
  END IF;
  IF v_row.counsel_only AND public.request_is_dev_seat() THEN
    SELECT count(*) INTO v_held FROM public.legal_matter_documents d WHERE d.matter_id = p_matter_id AND d.counsel_only AND d.voided_at IS NULL;
    RAISE EXCEPTION 'dev_matter_doc_read: "%" is for counsel alone — refused to the seat as deployed (% on this matter); a dev signed in reads it on the Legal desk', v_row.title, v_held USING ERRCODE = '42501';
  END IF;
  IF v_row.text_document_id IS NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: "%" is a % (%), not a text document; its bytes are on the Evidence tab, and its title and what it shows are what search_case reads', v_row.title, v_row.mime, v_row.original_name;
  END IF;
  SELECT t.content, jsonb_build_object('document_id', v_row.id, 'text_document_id', t.id, 'title', v_row.title, 'shows', v_row.shows, 'state', v_row.state,
                                       'dated_on', v_row.dated_on, 'counsel_only', v_row.counsel_only, 'mime', v_row.mime, 'original_name', v_row.original_name,
                                       'updated_at', t.updated_at, 'kept_by', t.author_label, 'chars', length(t.content), 'archived_at', t.archived_at)
    INTO v_text, v_target
    FROM public.documents t WHERE t.id = v_row.text_document_id;
  IF v_text IS NULL THEN
    RAISE EXCEPTION 'dev_matter_doc_read: the words of "%" are not in documents any more', v_row.title;
  END IF;
  RETURN jsonb_build_object('target', v_target) || public.hr_doc_slice(v_text, p_section, 'dev_matter_doc_read');
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_matter_doc_read(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_matter_doc_read(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dev_doc_history(p_person_id uuid, p_doc_id uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_from uuid DEFAULT NULL, p_to uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_named boolean;
  v_now jsonb;
  v_now_text text;
  v_revisions jsonb;
  v_from jsonb;
  v_to jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_doc_history: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'dev_doc_history: person_id is required';
  END IF;
  IF (p_doc_id IS NULL) = (COALESCE(btrim(p_kind), '') = '') THEN
    RAISE EXCEPTION 'dev_doc_history: name the document — doc_id (a named document) or kind (summary | narrative), one of the two';
  END IF;
  v_named := p_doc_id IS NOT NULL;

  IF v_named THEN
    SELECT jsonb_build_object('doc_id', d.id, 'title', d.title, 'counsel_only', d.counsel_only, 'updated_at', d.updated_at, 'kept_by', d.author_label,
                              'updated_by', u.name, 'chars', length(d.content), 'archived_at', d.archived_at), d.content
      INTO v_now, v_now_text
      FROM public.documents d LEFT JOIN public.users u ON u.id = d.updated_by
     WHERE d.id = p_doc_id AND d.person_id = p_person_id;
    IF v_now IS NULL THEN
      RAISE EXCEPTION 'dev_doc_history: no document % on this person', p_doc_id;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'replaced_by', COALESCE(u.name, r.replaced_by_label), 'kept_by', r.author_label,
                                                 'title', r.title, 'counsel_only', r.counsel_only, 'chars', length(r.content)) ORDER BY r.replaced_at DESC), '[]'::jsonb)
      INTO v_revisions
      FROM public.document_revisions r LEFT JOIN public.users u ON u.id = r.replaced_by
     WHERE r.document_id = p_doc_id;
  ELSE
    IF btrim(p_kind) NOT IN ('summary', 'narrative') THEN
      RAISE EXCEPTION 'dev_doc_history: kind must be summary or narrative';
    END IF;
    SELECT jsonb_build_object('kind', f.kind, 'title', f.kind, 'counsel_only', false, 'updated_at', f.updated_at, 'kept_by', f.author_label,
                              'updated_by', u.name, 'chars', length(f.content), 'covered_through', f.covered_through), f.content
      INTO v_now, v_now_text
      FROM public.person_files f LEFT JOIN public.users u ON u.id = f.updated_by
     WHERE f.person_id = p_person_id AND f.kind = btrim(p_kind);
    IF v_now IS NULL THEN
      RAISE EXCEPTION 'dev_doc_history: this person has no % yet', btrim(p_kind);
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'replaced_by', COALESCE(u.name, r.replaced_by_label), 'kept_by', r.author_label,
                                                 'title', r.kind, 'counsel_only', false, 'chars', length(r.content), 'covered_through', r.covered_through) ORDER BY r.replaced_at DESC), '[]'::jsonb)
      INTO v_revisions
      FROM public.person_file_revisions r LEFT JOIN public.users u ON u.id = r.replaced_by
     WHERE r.person_id = p_person_id AND r.kind = btrim(p_kind);
  END IF;

  -- Two versions' texts, when asked: p_from a revision id; p_to a revision id, or null for the current text.
  IF p_from IS NOT NULL THEN
    IF v_named THEN
      SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_from
        FROM public.document_revisions r WHERE r.id = p_from AND r.document_id = p_doc_id;
    ELSE
      SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_from
        FROM public.person_file_revisions r WHERE r.id = p_from AND r.person_id = p_person_id AND r.kind = btrim(p_kind);
    END IF;
    IF v_from IS NULL THEN
      RAISE EXCEPTION 'dev_doc_history: no revision % of this document', p_from;
    END IF;
    IF p_to IS NULL THEN
      v_to := jsonb_build_object('id', NULL, 'replaced_at', NULL, 'content', v_now_text);
    ELSE
      IF v_named THEN
        SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_to
          FROM public.document_revisions r WHERE r.id = p_to AND r.document_id = p_doc_id;
      ELSE
        SELECT jsonb_build_object('id', r.id, 'replaced_at', r.replaced_at, 'content', r.content) INTO v_to
          FROM public.person_file_revisions r WHERE r.id = p_to AND r.person_id = p_person_id AND r.kind = btrim(p_kind);
      END IF;
      IF v_to IS NULL THEN
        RAISE EXCEPTION 'dev_doc_history: no revision % of this document', p_to;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('now', v_now, 'revisions', v_revisions, 'from', v_from, 'to', v_to);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_doc_history(uuid, uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_doc_history(uuid, uuid, text, uuid, uuid) TO authenticated;
