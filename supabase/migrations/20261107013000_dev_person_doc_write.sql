SET lock_timeout = '3s';

-- dev_person_doc_write (v2.6608): the dev seat's door to a person's HR documents — the summary and the
-- narrative in person_files — with a dry run, the way dev_legal_narrative_write (20261007235000) wraps
-- a matter's narrative. The app renders both as markdown on People → HR, and until now only
-- hr_agent_write (psql, the hr_agent role) and dev_hr_entry_write (a whole text inside an entries call)
-- could write them: no preview, no edit of one section, and nothing that told a second writer the text
-- had moved under them. This function takes either the whole text or a list of section ops against the
-- document's own headings, names what would change, and commits to the row's updated_at — so an apply,
-- or the app's Save (which passes expect_updated_at, the version the editor loaded), against a document
-- someone saved since is refused and nothing is written. The archive trigger
-- person_files_archive_revision (20260824141540) keeps the prior version of every write. Additive; two
-- functions; no table.
--
-- Payload p:
--   { person_id (a people.id), kind ('summary' | 'narrative'),
--     markdown  (the whole text; replaces what is there)                — or —
--     ops: [ { op: 'replace_section', heading, markdown }   the lines under that heading, up to the next
--                                                            heading of the same or a higher level; the
--                                                            heading line stays; '' empties the section
--            { op: 'insert_after',    heading, markdown }   new lines after that section's last line
--            { op: 'append',                   markdown } ] new lines at the end of the document
--     expect_updated_at? (timestamptz — refused unless the row's updated_at is that instant),
--     covered_through?   (timestamptz; now() when left out) }
--   author_label is never read: the dev's name is written, as dev_hr_entry_write does.
-- Dry run (p_dry_run = true, the default): writes nothing; replies { dry_run, person { id, name }, kind,
--   before { exists, chars, lines, updated_at, author_label, covered_through }, after { chars, lines },
--   changes [ per op: what moved, the words removed and added, each capped ], sections [ the headings
--   after the change, with their line numbers ] }. Apply: the upsert as the dev, updated_by and
--   author_label stamped; replies { ok, person_id, kind, chars, lines, updated_at, revision_archived }.

-- The headings of an HR document, fence-aware, as src/lib/people/hrDocMarkdown.ts extracts them for the
-- jump list: ATX headings, backticks and bold markers stripped, lines inside ``` or ~~~ fences skipped.
CREATE OR REPLACE FUNCTION public.hr_doc_headings(md text)
RETURNS TABLE(line_no int, level int, heading text)
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_lines text[];
  v_i int;
  v_fence boolean := false;
  v_m text[];
BEGIN
  IF md IS NULL OR md = '' THEN
    RETURN;
  END IF;
  v_lines := regexp_split_to_array(md, E'\n');
  FOR v_i IN 1..array_length(v_lines, 1) LOOP
    IF v_lines[v_i] ~ '^\s*(```|~~~)' THEN
      v_fence := NOT v_fence;
      CONTINUE;
    END IF;
    IF v_fence THEN
      CONTINUE;
    END IF;
    v_m := regexp_match(v_lines[v_i], '^(#{1,6})\s+(.+?)\s*#*\s*$');
    IF v_m IS NULL THEN
      CONTINUE;
    END IF;
    heading := btrim(replace(replace(v_m[2], '`', ''), '**', ''));
    IF heading = '' THEN
      CONTINUE;
    END IF;
    line_no := v_i;
    level := length(v_m[1]);
    RETURN NEXT;
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.dev_person_doc_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_person_id uuid;
  v_person_name text;
  v_kind text := btrim(COALESCE(p->>'kind', ''));
  v_row public.person_files%ROWTYPE;
  v_exists boolean := false;
  v_before text := '';
  v_after text;
  v_lines text[];
  v_new_lines text[];
  v_n int;
  v_ops jsonb;
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
  v_sections jsonb;
  v_expect timestamptz;
  v_covered timestamptz;
  v_now timestamptz := now();
  v_max_chars constant int := 400000;
  v_cap constant int := 6000;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_person_doc_write: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'dev_person_doc_write: no users row for the caller';
  END IF;
  IF COALESCE(p->>'person_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_person_doc_write: person_id is required (a people.id)';
  END IF;
  v_person_id := (p->>'person_id')::uuid;
  SELECT pe.name INTO v_person_name FROM public.people pe WHERE pe.id = v_person_id;
  IF v_person_name IS NULL THEN
    RAISE EXCEPTION 'dev_person_doc_write: person % not found', v_person_id;
  END IF;
  IF v_kind NOT IN ('summary', 'narrative') THEN
    RAISE EXCEPTION 'dev_person_doc_write: kind must be summary or narrative';
  END IF;
  IF (p ? 'markdown') = (p ? 'ops') THEN
    RAISE EXCEPTION 'dev_person_doc_write: send markdown (the whole text) or ops (section edits), one of the two';
  END IF;

  SELECT * INTO v_row FROM public.person_files WHERE person_id = v_person_id AND kind = v_kind;
  v_exists := FOUND;
  v_before := COALESCE(v_row.content, '');

  IF p ? 'expect_updated_at' AND NULLIF(btrim(p->>'expect_updated_at'), '') IS NOT NULL THEN
    v_expect := (p->>'expect_updated_at')::timestamptz;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'dev_person_doc_write: there is no % yet, so there is no version to expect', v_kind;
    END IF;
    IF abs(extract(epoch FROM (v_row.updated_at - v_expect))) > 0.001 THEN
      RAISE EXCEPTION 'dev_person_doc_write: the % was saved at % by %, after the version you loaded (%). Read it again and edit from that.',
        v_kind, to_char(v_row.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS"Z"'), COALESCE(v_row.author_label, 'someone'),
        to_char(v_expect AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS"Z"');
    END IF;
  END IF;

  IF p ? 'markdown' THEN
    IF jsonb_typeof(p->'markdown') <> 'string' THEN
      RAISE EXCEPTION 'dev_person_doc_write: markdown must be text';
    END IF;
    v_after := p->>'markdown';
    v_changes := jsonb_build_array(jsonb_build_object(
      'op', 'rewrite',
      'removed_lines', CASE WHEN v_before = '' THEN 0 ELSE array_length(regexp_split_to_array(v_before, E'\n'), 1) END,
      'added_lines', CASE WHEN v_after = '' THEN 0 ELSE array_length(regexp_split_to_array(v_after, E'\n'), 1) END));
  ELSE
    v_ops := p->'ops';
    IF jsonb_typeof(v_ops) <> 'array' OR jsonb_array_length(v_ops) = 0 THEN
      RAISE EXCEPTION 'dev_person_doc_write: ops must be a list of at least one op';
    END IF;
    IF jsonb_array_length(v_ops) > 20 THEN
      RAISE EXCEPTION 'dev_person_doc_write: at most 20 ops a call';
    END IF;
    v_after := v_before;
    FOR v_op IN SELECT value FROM jsonb_array_elements(v_ops) LOOP
      v_opname := btrim(COALESCE(v_op->>'op', ''));
      IF v_opname NOT IN ('replace_section', 'insert_after', 'append') THEN
        RAISE EXCEPTION 'dev_person_doc_write: op must be replace_section, insert_after or append (got "%")', v_opname;
      END IF;
      IF jsonb_typeof(v_op->'markdown') <> 'string' THEN
        RAISE EXCEPTION 'dev_person_doc_write: op % needs markdown', v_opname;
      END IF;
      v_md := rtrim(v_op->>'markdown', E'\n');
      IF v_opname <> 'replace_section' AND btrim(v_md) = '' THEN
        RAISE EXCEPTION 'dev_person_doc_write: op % needs words', v_opname;
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
        v_changes := v_changes || jsonb_build_object(
          'op', 'append', 'at_line', v_start,
          'added_lines', array_length(v_new_lines, 1), 'added', left(v_md, v_cap));
      ELSE
        -- The wanted heading, read as the extractor reads a heading line: leading #s, trailing #s,
        -- backticks and bold markers dropped, then case-folded.
        v_want := lower(btrim(replace(replace(regexp_replace(regexp_replace(COALESCE(v_op->>'heading', ''), '^\s*#{1,6}\s+', ''), '\s*#*\s*$', ''), '`', ''), '**', '')));
        IF v_want = '' THEN
          RAISE EXCEPTION 'dev_person_doc_write: op % needs heading (the section''s heading text)', v_opname;
        END IF;
        SELECT count(*), min(h.line_no), min(h.level), min(h.heading)
          INTO v_matches, v_start, v_level, v_found
          FROM public.hr_doc_headings(v_after) h
         WHERE lower(h.heading) = v_want;
        IF v_matches = 0 THEN
          RAISE EXCEPTION 'dev_person_doc_write: no heading "%" in the %. Its headings: %',
            v_op->>'heading', v_kind,
            COALESCE((SELECT string_agg(h.heading, ' | ' ORDER BY h.line_no) FROM (SELECT * FROM public.hr_doc_headings(v_after) LIMIT 60) h), '(none)');
        END IF;
        IF v_matches > 1 THEN
          RAISE EXCEPTION 'dev_person_doc_write: the heading "%" appears % times in the %; make it unique first', v_op->>'heading', v_matches, v_kind;
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
            'op', 'replace_section', 'heading', v_found, 'level', v_level,
            'from_line', v_start + 1, 'to_line', v_end,
            'removed_lines', v_end - v_start, 'added_lines', COALESCE(array_length(v_new_lines, 1), 0),
            'removed', left(v_removed, v_cap), 'added', left(v_md, v_cap));
        ELSE
          v_lines := v_lines[1 : v_end]
            || CASE WHEN v_end > 0 AND v_lines[v_end] <> '' THEN ARRAY[''] ELSE ARRAY[]::text[] END
            || v_new_lines
            || CASE WHEN v_end < v_n THEN ARRAY[''] ELSE ARRAY[]::text[] END
            || v_lines[v_end + 1 : v_n];
          v_changes := v_changes || jsonb_build_object(
            'op', 'insert_after', 'heading', v_found, 'level', v_level,
            'at_line', v_end + 1, 'added_lines', array_length(v_new_lines, 1), 'added', left(v_md, v_cap));
        END IF;
      END IF;
      v_after := array_to_string(v_lines, E'\n');
    END LOOP;
  END IF;

  IF length(v_after) > v_max_chars THEN
    RAISE EXCEPTION 'dev_person_doc_write: the % would be longer than 400,000 characters', v_kind;
  END IF;
  IF v_after = v_before THEN
    RAISE EXCEPTION 'dev_person_doc_write: nothing changes — the % already reads that way', v_kind;
  END IF;
  v_covered := COALESCE(NULLIF(btrim(p->>'covered_through'), '')::timestamptz, v_now);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('line', h.line_no, 'level', h.level, 'heading', h.heading) ORDER BY h.line_no), '[]'::jsonb)
    INTO v_sections
    FROM (SELECT * FROM public.hr_doc_headings(v_after) LIMIT 80) h;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'person', jsonb_build_object('id', v_person_id, 'name', v_person_name),
      'kind', v_kind,
      'before', jsonb_build_object(
        'exists', v_exists,
        'chars', length(v_before),
        'lines', CASE WHEN v_before = '' THEN 0 ELSE array_length(regexp_split_to_array(v_before, E'\n'), 1) END,
        'updated_at', v_row.updated_at, 'author_label', v_row.author_label, 'covered_through', v_row.covered_through),
      'after', jsonb_build_object(
        'chars', length(v_after),
        'lines', CASE WHEN v_after = '' THEN 0 ELSE array_length(regexp_split_to_array(v_after, E'\n'), 1) END),
      'changes', v_changes,
      'sections', v_sections,
      'author_label', v_label
    );
  END IF;

  INSERT INTO public.person_files (person_id, kind, content, author_label, covered_through, updated_at, updated_by)
  VALUES (v_person_id, v_kind, v_after, v_label, v_covered, v_now, auth.uid())
  ON CONFLICT (person_id, kind) DO UPDATE
    SET content = EXCLUDED.content,
        author_label = EXCLUDED.author_label,
        covered_through = EXCLUDED.covered_through,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;

  RETURN jsonb_build_object(
    'ok', true,
    'person_id', v_person_id,
    'kind', v_kind,
    'chars', length(v_after),
    'lines', CASE WHEN v_after = '' THEN 0 ELSE array_length(regexp_split_to_array(v_after, E'\n'), 1) END,
    'updated_at', v_now,
    'revision_archived', v_exists
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_person_doc_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_person_doc_write(jsonb, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hr_doc_headings(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_doc_headings(text) TO authenticated;
