SET lock_timeout = '3s';

-- Punch list #389 (the Sub NDA builder), the ground under step 4, the office's settings page
-- (to-dos/sub-nda-builder/README.md). Taunya answered four calls on 2026-11-21. Two of them change the database:
--
--   * After the first signature the office may make ANY change to a job's paper, tighter or looser. It is still a new
--     row that everyone signs again. Step 3 (20261120163000) held it to stricter only.
--   * The page is the whole walked flow, with *What puts a person in breach* and *What the site must have* on every
--     topic. So the Contract Book's settings list holds those lines beside each choice, and the notice and the site
--     note the flow opens on. A settings list is JSON the database stores as given: nothing here adds a column to the
--     Book. What is new is the database's own stop on their shape.
--
-- And two things the page needs on the job's row: the basis, the level the office picked before walking the topics,
-- and who ticked the notice's box and when. The box is ticked once for a paper on a job.
--
-- No table is made, so there is no fence call. Every statement is safe to run twice. Nothing changes for a paper with
-- no settings list, or for a settings list with none of the new keys.

-- 1) The job's row: the basis and the tick.
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS basis text;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS notice_read_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.job_required_papers ADD COLUMN IF NOT EXISTS notice_read_at timestamptz;

COMMENT ON COLUMN public.job_required_papers.basis IS
  'Punch list #389 step 4: the level the office picked as the basis of this job''s paper, a key of the Book''s settings list levels. It marks the page, never the paper: the paper is the picks. Null when none was picked or the list has no levels.';
COMMENT ON COLUMN public.job_required_papers.notice_read_by IS
  'Punch list #389 step 4: who ticked the box on the notice the settings flow opens on, when this paper was required on the job. Kept across a change of settings: the box is ticked once for a paper on a job.';
COMMENT ON COLUMN public.job_required_papers.notice_read_at IS
  'Punch list #389 step 4: when the notice''s box was ticked.';

-- 2) The shape of the lines a settings list may hold. True when the value is there and is not a list of at most
-- p_max plain lines, each with words and at most 400 characters.
CREATE OR REPLACE FUNCTION public.contract_paper_lines_bad(p_lines jsonb, p_max integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_lines IS NULL OR jsonb_typeof(p_lines) = 'null' THEN false
    WHEN jsonb_typeof(p_lines) <> 'array' THEN true
    WHEN jsonb_array_length(p_lines) > p_max THEN true
    ELSE EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_lines) AS e(v)
      WHERE jsonb_typeof(e.v) <> 'string' OR btrim(e.v #>> '{}') = '' OR length(e.v #>> '{}') > 400
    )
  END;
$$;

-- True when the value is there and is not a title, a list of lines and a few plain words (a notice, a site note).
CREATE OR REPLACE FUNCTION public.contract_paper_note_bad(p_note jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_note IS NULL OR jsonb_typeof(p_note) = 'null' THEN false
    WHEN jsonb_typeof(p_note) <> 'object' THEN true
    ELSE public.contract_paper_lines_bad(p_note -> 'lines', 12) OR public.contract_paper_lines_bad(p_note -> 'linesEs', 12)
      OR EXISTS (
        SELECT 1 FROM jsonb_each(p_note) AS w(k, v)
        WHERE w.k NOT IN ('lines', 'linesEs') AND (jsonb_typeof(w.v) <> 'string' OR length(w.v #>> '{}') > 400)
      )
  END;
$$;

-- Whether a settings list opens on a notice: one with at least one line.
CREATE OR REPLACE FUNCTION public.contract_paper_has_notice(p_def jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_typeof(p_def -> 'notice' -> 'lines') = 'array' AND jsonb_array_length(p_def -> 'notice' -> 'lines') > 0, false);
$$;

-- A basis as the row keeps it: a level of the list, by key. Anything else is no basis.
CREATE OR REPLACE FUNCTION public.job_paper_basis_clean(p_def jsonb, p_basis text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (SELECT l.v ->> 'key' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_def -> 'levels') = 'array' THEN p_def -> 'levels' ELSE '[]'::jsonb END) AS l(v)
          WHERE l.v ->> 'key' = btrim(coalesce(p_basis, '')) LIMIT 1);
$$;

REVOKE ALL ON FUNCTION public.contract_paper_lines_bad(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contract_paper_note_bad(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contract_paper_has_notice(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_paper_basis_clean(jsonb, text) FROM PUBLIC, anon, authenticated;

-- 3) Whether a settings list reads at all. Started from the function as 20261120050000 left it, word for word. What
-- is new is its last two stops: the breach and site lines of a choice, and the notice and the site note.
CREATE OR REPLACE FUNCTION public.contract_paper_settings_def_problem(p_def jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_key CONSTANT text := '^[a-z][a-z0-9_]{0,39}$';
BEGIN
  IF p_def IS NULL THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_def) <> 'object' OR jsonb_typeof(p_def -> 'settings') IS DISTINCT FROM 'array'
     OR coalesce(jsonb_typeof(p_def -> 'fields'), 'array') <> 'array' OR coalesce(jsonb_typeof(p_def -> 'levels'), 'array') <> 'array' THEN
    RETURN 'That settings list does not read.';
  END IF;
  IF length(p_def::text) > 200000 THEN
    RETURN 'A settings list holds at most 200,000 characters.';
  END IF;
  IF jsonb_array_length(p_def -> 'settings') < 1 THEN
    RETURN 'Add a setting.';
  END IF;
  IF jsonb_array_length(p_def -> 'settings') > 40 OR jsonb_array_length(coalesce(p_def -> 'fields', '[]'::jsonb)) > 40
     OR jsonb_array_length(coalesce(p_def -> 'levels', '[]'::jsonb)) > 12 THEN
    RETURN 'A settings list holds at most 40 settings, 40 blanks and 12 levels.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_def -> 'settings') AS s(v)
    WHERE jsonb_typeof(s.v) <> 'object' OR coalesce(s.v ->> 'key', '') !~ v_key OR btrim(coalesce(s.v ->> 'label', '')) = ''
       OR jsonb_typeof(s.v -> 'choices') IS DISTINCT FROM 'array'
       OR (CASE WHEN jsonb_typeof(s.v -> 'choices') = 'array' THEN jsonb_array_length(s.v -> 'choices') ELSE 0 END) NOT BETWEEN 2 AND 12
  ) THEN
    RETURN 'Every setting needs a key, a name and two to twelve choices.';
  END IF;
  IF (SELECT count(DISTINCT s.v ->> 'key') FROM jsonb_array_elements(p_def -> 'settings') AS s(v)) <> jsonb_array_length(p_def -> 'settings') THEN
    RETURN 'Two settings share a key.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_def -> 'settings') AS s(v), jsonb_array_elements(s.v -> 'choices') AS c(v)
    WHERE jsonb_typeof(c.v) <> 'object' OR coalesce(c.v ->> 'key', '') !~ v_key OR btrim(coalesce(c.v ->> 'label', '')) = ''
       OR coalesce(jsonb_typeof(c.v -> 'fills'), 'object') <> 'object' OR coalesce(jsonb_typeof(c.v -> 'fillsEs'), 'object') <> 'object'
  ) THEN
    RETURN 'Every choice needs a key and a name.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_def -> 'settings') AS s(v)
    WHERE (SELECT count(DISTINCT c.v ->> 'key') FROM jsonb_array_elements(s.v -> 'choices') AS c(v)) <> jsonb_array_length(s.v -> 'choices')
  ) THEN
    RETURN 'Two choices of one setting share a key.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_def -> 'fields', '[]'::jsonb)) AS f(v)
    WHERE jsonb_typeof(f.v) <> 'object' OR coalesce(f.v ->> 'key', '') !~ v_key OR f.v ->> 'key' IN ('company', 'job') OR btrim(coalesce(f.v ->> 'label', '')) = ''
  ) THEN
    RETURN 'Every blank needs a key and a name.';
  END IF;
  IF (SELECT count(DISTINCT f.v ->> 'key') FROM jsonb_array_elements(coalesce(p_def -> 'fields', '[]'::jsonb)) AS f(v)) <> jsonb_array_length(coalesce(p_def -> 'fields', '[]'::jsonb)) THEN
    RETURN 'Two blanks share a key.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_def -> 'levels', '[]'::jsonb)) AS l(v)
    WHERE jsonb_typeof(l.v) <> 'object' OR coalesce(l.v ->> 'key', '') !~ v_key OR btrim(coalesce(l.v ->> 'label', '')) = ''
       OR jsonb_typeof(l.v -> 'picks') IS DISTINCT FROM 'object'
       OR public.contract_paper_picks_problem(p_def, CASE WHEN jsonb_typeof(l.v -> 'picks') = 'object' THEN l.v -> 'picks' ELSE NULL END) IS NOT NULL
  ) THEN
    RETURN 'Every level needs a key, a name and a pick for every setting.';
  END IF;
  IF (SELECT count(DISTINCT l.v ->> 'key') FROM jsonb_array_elements(coalesce(p_def -> 'levels', '[]'::jsonb)) AS l(v)) <> jsonb_array_length(coalesce(p_def -> 'levels', '[]'::jsonb)) THEN
    RETURN 'Two levels share a key.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_def -> 'settings') AS s(v), jsonb_array_elements(s.v -> 'choices') AS c(v)
    WHERE public.contract_paper_lines_bad(c.v -> 'breach', 20) OR public.contract_paper_lines_bad(c.v -> 'breachEs', 20)
       OR public.contract_paper_lines_bad(c.v -> 'site', 20) OR public.contract_paper_lines_bad(c.v -> 'siteEs', 20)
  ) THEN
    RETURN 'A choice''s breach lines and site lines are lists of plain lines: twenty at most, each with words and 400 characters at most.';
  END IF;
  IF public.contract_paper_note_bad(p_def -> 'notice') OR public.contract_paper_note_bad(p_def -> 'siteNote') THEN
    RETURN 'The notice and the site note are a title, twelve plain lines at most, and a few plain words.';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_paper_settings_def_problem(jsonb) FROM PUBLIC, anon, authenticated;

-- 4) The office requires papers on a job. Started from the function as 20261120163000 left it. What is new, for a
-- paper built from settings: its entry in p_settings may carry "basis", and must carry "notice_read": true when the
-- Book's settings list opens on a notice. The row keeps who ticked the box and when.
CREATE OR REPLACE FUNCTION public.job_papers_require(p_job_id uuid, p_book_document_ids uuid[], p_settings jsonb DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_ids uuid[];
  v_book_id uuid;
  v_doc public.contract_template_documents%ROWTYPE;
  v_old uuid;
  v_added integer := 0;
  v_given jsonb := CASE WHEN jsonb_typeof(p_settings) = 'object' THEN p_settings ELSE '{}'::jsonb END;
  v_built boolean;
  v_picks jsonb;
  v_typed jsonb;
  v_live public.job_required_papers%ROWTYPE;
  v_basis text;
  v_notice boolean;
  v_now timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'No job with that id.' USING ERRCODE = 'P0001';
  END IF;
  -- Each paper once, in the order the office picked them: the prompt lists them in that order.
  SELECT array_agg(t.x ORDER BY t.first_ord) INTO v_ids
  FROM (
    SELECT u.x, min(u.ord) AS first_ord
    FROM unnest(coalesce(p_book_document_ids, '{}'::uuid[])) WITH ORDINALITY AS u(x, ord)
    WHERE u.x IS NOT NULL
    GROUP BY u.x
  ) t;
  IF coalesce(cardinality(v_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Pick a paper from the Contract Book.' USING ERRCODE = 'P0001';
  END IF;
  IF cardinality(v_ids) > 20 THEN
    RAISE EXCEPTION 'A job takes twenty papers at most.' USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_book_id IN ARRAY v_ids LOOP
    SELECT * INTO v_doc FROM public.contract_template_documents c WHERE c.id = v_book_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That paper is not in the Contract Book.' USING ERRCODE = 'P0001';
    END IF;
    v_built := v_doc.settings_def IS NOT NULL;
    v_picks := NULL;
    v_typed := NULL;
    v_basis := NULL;
    v_notice := false;
    IF v_built THEN
      -- A paper built from settings goes with its picks, and is checked whole before the job takes it.
      IF jsonb_typeof(v_given -> v_book_id::text -> 'settings') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION '% is built from settings. Require it with its settings.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
      IF public.is_digital_twin() THEN
        RAISE EXCEPTION 'A digital twin cannot set a job''s paper settings.' USING ERRCODE = '42501';
      END IF;
      v_picks := public.job_paper_picks_clean(v_doc.settings_def, v_given -> v_book_id::text -> 'settings');
      v_typed := public.job_paper_typed_clean(v_doc.settings_def, v_given -> v_book_id::text -> 'fields');
      PERFORM public.job_paper_settings_check(p_job_id, v_book_id, v_picks, v_typed);
      v_basis := public.job_paper_basis_clean(v_doc.settings_def, v_given -> v_book_id::text ->> 'basis');
      v_notice := public.contract_paper_has_notice(v_doc.settings_def);
    ELSE
      IF v_given ? v_book_id::text THEN
        RAISE EXCEPTION '% is not built from settings. It takes none.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
      IF btrim(coalesce(v_doc.book_body_html, '')) = '' AND v_doc.form_template_id IS NULL
         AND btrim(coalesce(v_doc.canonical_document_url, '')) = '' THEN
        RAISE EXCEPTION '% has no words yet. Write it in the Contract Book first.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
    END IF;
    SELECT * INTO v_live FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NULL;
    IF FOUND THEN
      IF v_built AND (v_live.settings IS DISTINCT FROM v_picks OR v_live.fields IS DISTINCT FROM v_typed) THEN
        RAISE EXCEPTION 'This job requires % already, with other settings. Change them on that paper.', v_doc.document_name USING ERRCODE = 'P0001';
      END IF;
      CONTINUE;
    END IF;
    -- A paper whose settings list opens on a notice is required only by someone who ticked its box. Once for the
    -- paper on this job: a later change of its settings asks for no second tick.
    IF v_notice AND (v_given -> v_book_id::text -> 'notice_read') IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION '% opens on a notice. Tick its box before you require it.', v_doc.document_name USING ERRCODE = 'P0001';
    END IF;
    v_now := clock_timestamp();

    IF v_built THEN
      -- One taken off earlier comes back with its signatures when its settings and the Book's revision are the same.
      SELECT r.id INTO v_old FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NOT NULL
        AND r.paper_name = btrim(v_doc.document_name)
        AND r.settings IS NOT DISTINCT FROM v_picks AND r.fields IS NOT DISTINCT FROM v_typed
        AND r.book_revision = v_doc.revision
      ORDER BY r.removed_at DESC
      LIMIT 1;
    ELSE
      SELECT r.id INTO v_old FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.book_document_id = v_book_id AND r.removed_at IS NOT NULL
        AND r.settings IS NULL
        AND r.paper_name = btrim(v_doc.document_name)
        AND r.body_html IS NOT DISTINCT FROM v_doc.book_body_html
        AND r.body_format = coalesce(nullif(btrim(v_doc.book_body_format), ''), 'html')
        AND r.canonical_document_url IS NOT DISTINCT FROM nullif(btrim(coalesce(v_doc.canonical_document_url, '')), '')
        AND r.form_template_id IS NOT DISTINCT FROM v_doc.form_template_id
      ORDER BY r.removed_at DESC
      LIMIT 1;
    END IF;
    IF v_old IS NOT NULL THEN
      UPDATE public.job_required_papers
        SET removed_at = NULL, removed_by = NULL,
            basis = CASE WHEN v_built THEN coalesce(v_basis, basis) ELSE basis END,
            notice_read_by = CASE WHEN v_notice THEN auth.uid() ELSE notice_read_by END,
            notice_read_at = CASE WHEN v_notice THEN v_now ELSE notice_read_at END
        WHERE id = v_old;
    ELSIF v_built THEN
      -- The words are the Book's clauses, put together for the picks when the paper is read. The row keeps no body.
      INSERT INTO public.job_required_papers (
        job_id, book_document_id, paper_name, body_format, required_by, required_at,
        settings, fields, book_revision, settings_revision, settings_set_by, settings_set_at,
        basis, notice_read_by, notice_read_at
      ) VALUES (
        p_job_id, v_book_id, btrim(v_doc.document_name), 'html', auth.uid(), v_now,
        v_picks, v_typed, v_doc.revision, 1, auth.uid(), v_now,
        v_basis, CASE WHEN v_notice THEN auth.uid() END, CASE WHEN v_notice THEN v_now END
      );
    ELSE
      -- The clock, not the transaction's start: papers saved in one press keep the order they were picked in.
      INSERT INTO public.job_required_papers (
        job_id, book_document_id, paper_name, body_html, body_format, canonical_document_url, form_template_id, required_by, required_at
      ) VALUES (
        p_job_id, v_book_id, btrim(v_doc.document_name), v_doc.book_body_html,
        coalesce(nullif(btrim(v_doc.book_body_format), ''), 'html'),
        nullif(btrim(coalesce(v_doc.canonical_document_url, '')), ''), v_doc.form_template_id, auth.uid(), clock_timestamp()
      );
    END IF;
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

COMMENT ON FUNCTION public.job_papers_require(uuid, uuid[], jsonb) IS
  'Papers before a job opens: the office requires papers on a job, each a Contract Book entry, and gets back how many were added. The job keeps each paper''s words as they stand in the Book now. One the job already requires is left alone, and one taken off earlier comes back with its signatures when the Book''s words have not changed. Refuses a paper with no words, more than twenty, and anyone outside the office. Since punch list #389 step 3 a paper built from settings is required with its picks, p_settings as {"<book document id>": {"settings": {...}, "fields": {...}, "basis": "<level key>", "notice_read": true}}: a pick for every setting, a paper that goes together, and, on a job that is not a ZZ Test job, only at the revision an attorney read. Since step 4 the entry may name the basis, and must say notice_read when the Book''s settings list opens on a notice: the row keeps who ticked its box and when. Never a twin.';
REVOKE EXECUTE ON FUNCTION public.job_papers_require(uuid, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_papers_require(uuid, uuid[], jsonb) TO authenticated, service_role;

-- 5) The office changes a required paper's settings. Started from the function as 20261120163000 left it. What is
-- new: after the first signature ANY change is taken, tighter or looser, as a new row that everyone signs again
-- (Taunya's call, 2026-11-21; step 3 held it to stricter only). The new row keeps the basis and the notice's tick.
CREATE OR REPLACE FUNCTION public.job_paper_set_settings(p_required_paper_id uuid, p_settings jsonb, p_fields jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.job_required_papers%ROWTYPE;
  v_doc public.contract_template_documents%ROWTYPE;
  v_picks jsonb;
  v_typed jsonb;
  v_change text;
  v_signed integer;
  v_new uuid;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to set a job''s paper settings.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot set a job''s paper settings.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was changed.' USING ERRCODE = '42501';
  END IF;
  -- The row is the lock: a change and a signature on the same paper happen one after the other.
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = p_required_paper_id AND r.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.settings IS NULL THEN
    RAISE EXCEPTION 'That paper is not built from settings. It has none to set.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_doc FROM public.contract_template_documents d WHERE d.id = v_row.book_document_id;
  IF NOT FOUND OR v_doc.settings_def IS NULL THEN
    RAISE EXCEPTION 'That paper is no longer built from settings in the Contract Book. Take it off the job.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_settings) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'This paper is built from settings. It goes with its settings.' USING ERRCODE = 'P0001';
  END IF;
  v_picks := public.job_paper_picks_clean(v_doc.settings_def, p_settings);
  v_typed := public.job_paper_typed_clean(v_doc.settings_def, p_fields);
  PERFORM public.job_paper_settings_check(v_row.job_id, v_doc.id, v_picks, v_typed);

  v_change := public.contract_paper_picks_change(v_doc.settings_def, v_row.settings, v_picks);
  IF v_change = 'same' AND v_row.fields IS NOT DISTINCT FROM v_typed AND v_row.book_revision = v_doc.revision THEN
    RAISE EXCEPTION 'Nothing changed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_signed FROM public.person_contract_documents d WHERE d.job_required_paper_id = v_row.id AND d.status = 'signed';

  IF v_signed = 0 THEN
    UPDATE public.job_required_papers
      SET settings = v_picks, fields = v_typed, book_revision = v_doc.revision, settings_set_by = v_uid, settings_set_at = v_now
      WHERE id = v_row.id;
    RETURN jsonb_build_object('state', 'saved', 'id', v_row.id, 'revision', v_row.settings_revision, 'change', v_change, 'sign_again', 0);
  END IF;

  -- Any change, tighter or looser: it is a new paper to everyone who signed, and each of them signs it again.
  UPDATE public.job_required_papers SET removed_at = v_now, removed_by = v_uid WHERE id = v_row.id;
  INSERT INTO public.job_required_papers (
    job_id, book_document_id, paper_name, body_format, required_by, required_at,
    settings, fields, book_revision, settings_revision, revision_of, settings_set_by, settings_set_at,
    basis, notice_read_by, notice_read_at
  ) VALUES (
    v_row.job_id, v_row.book_document_id, btrim(v_doc.document_name), 'html', v_uid, v_row.required_at,
    v_picks, v_typed, v_doc.revision, v_row.settings_revision + 1, v_row.id, v_uid, v_now,
    public.job_paper_basis_clean(v_doc.settings_def, v_row.basis), v_row.notice_read_by, v_row.notice_read_at
  )
  RETURNING id INTO v_new;
  RETURN jsonb_build_object('state', 'revised', 'id', v_new, 'revision', v_row.settings_revision + 1, 'change', v_change, 'sign_again', v_signed);
END;
$$;

COMMENT ON FUNCTION public.job_paper_set_settings(uuid, jsonb, jsonb) IS
  'Punch list #389: the office changes the settings of a paper a job requires, and gets back {state, id, revision, change, sign_again}. Until a copy is signed the row changes in place (state saved). After the first signature the row is locked: any change, tighter or looser, or the same picks with new typed words or a new Book revision, makes a new row in the old one''s place that everyone signs again (state revised, sign_again the signatures the old row keeps, change which way it went). Checked like a first require: a pick for every setting, a paper that goes together, the read-revision rule. Office only, never a twin, an archived account or training.';
REVOKE ALL ON FUNCTION public.job_paper_set_settings(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_set_settings(uuid, jsonb, jsonb) TO authenticated;

-- 6) The office moves the basis of a required paper. The basis marks the page, never the paper, so it changes in
-- place whoever has signed, and nobody signs again.
CREATE OR REPLACE FUNCTION public.job_paper_set_basis(p_required_paper_id uuid, p_basis text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row public.job_required_papers%ROWTYPE;
  v_def jsonb;
  v_basis text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to set a job''s paper settings.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot set a job''s paper settings.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sets the papers a job requires.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was changed.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.job_required_papers r WHERE r.id = p_required_paper_id AND r.removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This job no longer requires that paper.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.settings IS NULL THEN
    RAISE EXCEPTION 'That paper is not built from settings. It has none to set.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.settings_def INTO v_def FROM public.contract_template_documents d WHERE d.id = v_row.book_document_id;
  v_basis := public.job_paper_basis_clean(v_def, p_basis);
  IF v_basis IS NULL AND btrim(coalesce(p_basis, '')) <> '' THEN
    RAISE EXCEPTION 'That level is not on this paper''s list.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.job_required_papers SET basis = v_basis WHERE id = v_row.id;
  RETURN v_basis;
END;
$$;

COMMENT ON FUNCTION public.job_paper_set_basis(uuid, text) IS
  'Punch list #389 step 4: the office moves the basis of a paper a job requires, the level its settings page starts each topic on, and gets the basis back. An empty basis clears it. The basis marks the page and never the paper, so nobody signs again. Office only, never a twin, an archived account or training.';
REVOKE ALL ON FUNCTION public.job_paper_set_basis(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_paper_set_basis(uuid, text) TO authenticated;
