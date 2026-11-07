SET lock_timeout = '3s';

-- Named documents on a person's HR file (v2.6613, punch list #277, PR 1). A person's file keeps two documents the
-- agent writes from the entries, the summary and the narrative (person_files, one row a kind); everything else written
-- about the person had no home — two long documents went onto a file this week as evidence records with Drive links,
-- which the app can neither render nor edit. This adds the list: any number of titled markdown documents a person,
-- each with the same revision trail as the fixed two, a counsel-only mark, and the same write door — dev_person_doc_write
-- (20261107013000) now takes doc_id for an existing named document or title for a new one, beside kind for the fixed
-- two, with the same section ops, the same dry run and the same stale refusal. Dev-only, like every HR table.
--
-- Tables: person_documents (the documents), person_document_revisions (the prior version of every rewrite, written by
-- the BEFORE UPDATE trigger person_documents_archive_revision, the way person_files_archive_revision does for the fixed
-- two). The view person_document_index lists a person's documents with their size and section count without carrying
-- the text, for the HR tab's list and the seat's get_person_file. The four house fences close the new tables to
-- read-only users, twins and an archived caller.

CREATE TABLE IF NOT EXISTS public.person_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  content text NOT NULL DEFAULT '',
  counsel_only boolean NOT NULL DEFAULT false,
  author_label text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
COMMENT ON TABLE public.person_documents IS
  'Named documents on a person''s HR file (v2.6613, punch list #277): any number a person, markdown or plain text, beside the summary and narrative in person_files. Dev-only. Prior versions archive by trigger into person_document_revisions. counsel_only marks a document kept inside the circle whole; archived_at retires one without deleting it.';
CREATE INDEX IF NOT EXISTS idx_person_documents_person_updated
  ON public.person_documents (person_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.person_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.person_documents(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  counsel_only boolean NOT NULL DEFAULT false,
  author_label text,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  replaced_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  replaced_by_label text
);
COMMENT ON TABLE public.person_document_revisions IS
  'The prior version of every person_documents rewrite (v2.6613), written only by the trigger; devs read it.';
CREATE INDEX IF NOT EXISTS idx_person_document_revisions_document
  ON public.person_document_revisions (document_id, replaced_at DESC);

CREATE OR REPLACE FUNCTION public.person_documents_archive_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.person_document_revisions
      (document_id, person_id, title, content, counsel_only, author_label, replaced_at, replaced_by, replaced_by_label)
    VALUES
      (OLD.id, OLD.person_id, OLD.title, OLD.content, OLD.counsel_only, OLD.author_label, now(), NEW.updated_by, NEW.author_label);
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS person_documents_archive_revision ON public.person_documents;
CREATE TRIGGER person_documents_archive_revision
  BEFORE UPDATE ON public.person_documents
  FOR EACH ROW EXECUTE FUNCTION public.person_documents_archive_revision();

ALTER TABLE public.person_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_document_revisions ENABLE ROW LEVEL SECURITY;

-- Devs manage the documents; nobody deletes a row (archived_at retires one) — the policy admits no DELETE.
DROP POLICY IF EXISTS "Devs can read person documents" ON public.person_documents;
CREATE POLICY "Devs can read person documents" ON public.person_documents
  FOR SELECT USING (public.is_dev());
DROP POLICY IF EXISTS "Devs can add person documents" ON public.person_documents;
CREATE POLICY "Devs can add person documents" ON public.person_documents
  FOR INSERT WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs can change person documents" ON public.person_documents;
CREATE POLICY "Devs can change person documents" ON public.person_documents
  FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs can read person document revisions" ON public.person_document_revisions;
CREATE POLICY "Devs can read person document revisions" ON public.person_document_revisions
  FOR SELECT USING (public.is_dev());

-- The list without the text: title, mark, who kept it, when, its size and its section count (hr_doc_headings, 20261107013000).
-- security_invoker, so the table's own policies and fences decide what a reader sees.
CREATE OR REPLACE VIEW public.person_document_index
WITH (security_invoker = true) AS
  SELECT d.id, d.person_id, d.title, d.counsel_only, d.author_label, d.created_by, d.updated_by, d.created_at, d.updated_at, d.archived_at,
         length(d.content) AS chars,
         (SELECT count(*)::int FROM public.hr_doc_headings(d.content)) AS sections
    FROM public.person_documents d;
GRANT SELECT ON public.person_document_index TO authenticated;

-- dev_person_doc_write (20261107013000), extended: the target is one of kind (summary | narrative, a person_files row),
-- doc_id (a person_documents row) or title (a new named document). A named document also takes counsel_only (set or
-- clear the mark) and archive (true retires it, false brings it back) — either may come alone, with no text change.
-- The dry run names the target as document { id, title, counsel_only, archived_at } beside the fields it named before.
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
  v_doc_id uuid;
  v_title text := btrim(COALESCE(p->>'title', ''));
  v_named boolean;
  v_row public.person_files%ROWTYPE;
  v_doc public.person_documents%ROWTYPE;
  v_exists boolean := false;
  v_before text := '';
  v_after text;
  v_has_text boolean;
  v_counsel boolean;
  v_archive boolean;
  v_flag_changes boolean := false;
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
  v_updated_at timestamptz;
  v_author text;
  v_what text;
  v_max_chars constant int := 1000000;
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

  -- The target: exactly one of kind, doc_id, title.
  IF ((v_kind <> '')::int + (COALESCE(p->>'doc_id', '') <> '')::int + (v_title <> '')::int) <> 1 THEN
    RAISE EXCEPTION 'dev_person_doc_write: name the target — kind (summary | narrative), doc_id (a named document) or title (a new named document), one of the three';
  END IF;
  v_named := v_kind = '';
  IF NOT v_named AND v_kind NOT IN ('summary', 'narrative') THEN
    RAISE EXCEPTION 'dev_person_doc_write: kind must be summary or narrative';
  END IF;
  v_has_text := (p ? 'markdown') OR (p ? 'ops');
  v_archive := CASE WHEN p ? 'archive' THEN (p->>'archive')::boolean ELSE NULL END;
  v_counsel := CASE WHEN p ? 'counsel_only' THEN (p->>'counsel_only')::boolean ELSE NULL END;
  IF NOT v_named AND (v_archive IS NOT NULL OR v_counsel IS NOT NULL) THEN
    RAISE EXCEPTION 'dev_person_doc_write: counsel_only and archive are for a named document; the % has neither', v_kind;
  END IF;
  IF (p ? 'markdown') AND (p ? 'ops') THEN
    RAISE EXCEPTION 'dev_person_doc_write: send markdown (the whole text) or ops (section edits), not both';
  END IF;
  IF NOT v_has_text AND v_archive IS NULL AND v_counsel IS NULL THEN
    RAISE EXCEPTION 'dev_person_doc_write: send markdown (the whole text) or ops (section edits)';
  END IF;

  -- The text as it stands.
  IF v_named THEN
    IF COALESCE(p->>'doc_id', '') <> '' THEN
      IF (p->>'doc_id') !~ '^[0-9a-fA-F-]{36}$' THEN
        RAISE EXCEPTION 'dev_person_doc_write: doc_id must be a person_documents.id';
      END IF;
      v_doc_id := (p->>'doc_id')::uuid;
      SELECT * INTO v_doc FROM public.person_documents WHERE id = v_doc_id AND person_id = v_person_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'dev_person_doc_write: no document % on %', v_doc_id, v_person_name;
      END IF;
      v_exists := true;
      v_before := v_doc.content;
      v_title := v_doc.title;
      v_updated_at := v_doc.updated_at;
      v_author := v_doc.author_label;
      v_what := 'document';
    ELSE
      IF length(v_title) > 160 THEN
        RAISE EXCEPTION 'dev_person_doc_write: the title is longer than 160 characters';
      END IF;
      IF v_archive IS NOT NULL THEN
        RAISE EXCEPTION 'dev_person_doc_write: a new document cannot be archived; make it first';
      END IF;
      IF NOT v_has_text THEN
        RAISE EXCEPTION 'dev_person_doc_write: a new document needs markdown';
      END IF;
      SELECT * INTO v_doc FROM public.person_documents WHERE person_id = v_person_id AND archived_at IS NULL AND lower(title) = lower(v_title) LIMIT 1;
      IF FOUND THEN
        RAISE EXCEPTION 'dev_person_doc_write: % already has a document titled "%" (doc_id %); edit it by doc_id, or pick another title', v_person_name, v_doc.title, v_doc.id;
      END IF;
      v_doc := NULL;
      v_what := 'document';
    END IF;
  ELSE
    SELECT * INTO v_row FROM public.person_files WHERE person_id = v_person_id AND kind = v_kind;
    v_exists := FOUND;
    v_before := COALESCE(v_row.content, '');
    v_updated_at := v_row.updated_at;
    v_author := v_row.author_label;
    v_what := v_kind;
  END IF;

  IF p ? 'expect_updated_at' AND NULLIF(btrim(p->>'expect_updated_at'), '') IS NOT NULL THEN
    v_expect := (p->>'expect_updated_at')::timestamptz;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'dev_person_doc_write: there is no % yet, so there is no version to expect', v_what;
    END IF;
    IF abs(extract(epoch FROM (v_updated_at - v_expect))) > 0.001 THEN
      RAISE EXCEPTION 'dev_person_doc_write: the % was saved at % by %, after the version you loaded (%). Read it again and edit from that.',
        v_what, to_char(v_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS"Z"'), COALESCE(v_author, 'someone'),
        to_char(v_expect AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS"Z"');
    END IF;
  END IF;

  v_after := v_before;
  IF p ? 'markdown' THEN
    IF jsonb_typeof(p->'markdown') <> 'string' THEN
      RAISE EXCEPTION 'dev_person_doc_write: markdown must be text';
    END IF;
    v_after := p->>'markdown';
    v_changes := jsonb_build_array(jsonb_build_object(
      'op', CASE WHEN v_exists THEN 'rewrite' ELSE 'create' END,
      'removed_lines', CASE WHEN v_before = '' THEN 0 ELSE array_length(regexp_split_to_array(v_before, E'\n'), 1) END,
      'added_lines', CASE WHEN v_after = '' THEN 0 ELSE array_length(regexp_split_to_array(v_after, E'\n'), 1) END));
  ELSIF p ? 'ops' THEN
    v_ops := p->'ops';
    IF jsonb_typeof(v_ops) <> 'array' OR jsonb_array_length(v_ops) = 0 THEN
      RAISE EXCEPTION 'dev_person_doc_write: ops must be a list of at least one op';
    END IF;
    IF jsonb_array_length(v_ops) > 20 THEN
      RAISE EXCEPTION 'dev_person_doc_write: at most 20 ops a call';
    END IF;
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
            v_op->>'heading', v_what,
            COALESCE((SELECT string_agg(h.heading, ' | ' ORDER BY h.line_no) FROM (SELECT * FROM public.hr_doc_headings(v_after) LIMIT 60) h), '(none)');
        END IF;
        IF v_matches > 1 THEN
          RAISE EXCEPTION 'dev_person_doc_write: the heading "%" appears % times in the %; make it unique first', v_op->>'heading', v_matches, v_what;
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

  IF v_named AND v_exists THEN
    v_flag_changes := (v_counsel IS NOT NULL AND v_counsel IS DISTINCT FROM v_doc.counsel_only)
                   OR (v_archive IS NOT NULL AND v_archive IS DISTINCT FROM (v_doc.archived_at IS NOT NULL));
    IF v_counsel IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('op', 'counsel_only', 'before', v_doc.counsel_only, 'after', v_counsel);
    END IF;
    IF v_archive IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('op', CASE WHEN v_archive THEN 'archive' ELSE 'restore' END, 'before', v_doc.archived_at);
    END IF;
  END IF;

  IF length(v_after) > v_max_chars THEN
    RAISE EXCEPTION 'dev_person_doc_write: the % would be longer than 1,000,000 characters', v_what;
  END IF;
  IF v_after = v_before AND NOT v_flag_changes AND v_exists THEN
    RAISE EXCEPTION 'dev_person_doc_write: nothing changes — the % already reads that way', v_what;
  END IF;
  IF v_named AND NOT v_exists AND btrim(v_after) = '' THEN
    RAISE EXCEPTION 'dev_person_doc_write: a new document needs words';
  END IF;
  v_covered := COALESCE(NULLIF(btrim(p->>'covered_through'), '')::timestamptz, v_now);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('line', h.line_no, 'level', h.level, 'heading', h.heading) ORDER BY h.line_no), '[]'::jsonb)
    INTO v_sections
    FROM (SELECT * FROM public.hr_doc_headings(v_after) LIMIT 80) h;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'person', jsonb_build_object('id', v_person_id, 'name', v_person_name),
      'kind', CASE WHEN v_named THEN 'document' ELSE v_kind END,
      'document', CASE WHEN v_named THEN jsonb_build_object(
        'id', v_doc.id, 'title', v_title,
        'counsel_only', COALESCE(v_counsel, v_doc.counsel_only, false),
        'archived_at', CASE WHEN v_archive IS TRUE THEN v_now WHEN v_archive IS FALSE THEN NULL ELSE v_doc.archived_at END) ELSE NULL END,
      'before', jsonb_build_object(
        'exists', v_exists,
        'chars', length(v_before),
        'lines', CASE WHEN v_before = '' THEN 0 ELSE array_length(regexp_split_to_array(v_before, E'\n'), 1) END,
        'updated_at', v_updated_at, 'author_label', v_author, 'covered_through', v_row.covered_through),
      'after', jsonb_build_object(
        'chars', length(v_after),
        'lines', CASE WHEN v_after = '' THEN 0 ELSE array_length(regexp_split_to_array(v_after, E'\n'), 1) END),
      'changes', v_changes,
      'sections', v_sections,
      'author_label', v_label
    );
  END IF;

  IF v_named THEN
    IF v_exists THEN
      UPDATE public.person_documents
         SET content = v_after,
             counsel_only = COALESCE(v_counsel, counsel_only),
             archived_at = CASE WHEN v_archive IS TRUE THEN v_now WHEN v_archive IS FALSE THEN NULL ELSE archived_at END,
             author_label = v_label,
             updated_at = v_now,
             updated_by = auth.uid()
       WHERE id = v_doc.id;
    ELSE
      INSERT INTO public.person_documents (person_id, title, content, counsel_only, author_label, created_by, updated_by, created_at, updated_at)
      VALUES (v_person_id, v_title, v_after, COALESCE(v_counsel, false), v_label, auth.uid(), auth.uid(), v_now, v_now)
      RETURNING * INTO v_doc;
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'person_id', v_person_id, 'kind', 'document',
      'document', jsonb_build_object('id', v_doc.id, 'title', v_title),
      'chars', length(v_after),
      'lines', CASE WHEN v_after = '' THEN 0 ELSE array_length(regexp_split_to_array(v_after, E'\n'), 1) END,
      'updated_at', v_now, 'revision_archived', v_exists AND v_after <> v_before
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
    'ok', true, 'person_id', v_person_id, 'kind', v_kind,
    'chars', length(v_after),
    'lines', CASE WHEN v_after = '' THEN 0 ELSE array_length(regexp_split_to_array(v_after, E'\n'), 1) END,
    'updated_at', v_now, 'revision_archived', v_exists
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_person_doc_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_person_doc_write(jsonb, boolean) TO authenticated;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal on the new tables.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
