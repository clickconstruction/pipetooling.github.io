SET lock_timeout = '3s';

-- GC mode (v2.4779, real build step 8): questions about the plans on real data. A company asks by
-- phone or email and the office records it; the office sends it to the architect and records the
-- answer; a new set of plans carries the answers in its note. Until the company record lands, the
-- asker is a name (asked_by_name); company_id stays for the record. Two RPCs keep the closing day
-- in one place: questions close three days before our bid is due (the owner, 2026-10-03), never on
-- a bid we lost. gc_issue_plan_set gains questionIds: the answered questions the set carries.
-- Plan: to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on spike/gc-mode. Doc: docs/migrations/.

ALTER TABLE public.gc_plan_questions ADD COLUMN IF NOT EXISTS asked_by_name text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.gc_plan_questions.asked_by_name IS 'Who asked, as the office typed it, until the company record lands (then company_id).';

-- The day questions close on a project: three days before our bid is due while we bid; null when they never close.
CREATE OR REPLACE FUNCTION public.gc_questions_close_on(p_project uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE WHEN g.stage = 'bidding' AND g.bid_due IS NOT NULL THEN g.bid_due - 3 ELSE NULL END
  FROM public.gc_projects g WHERE g.project_id = p_project
$$;

CREATE OR REPLACE FUNCTION public.gc_record_question(q jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_pkg uuid;
  v_text text;
  v_lost date;
  v_close date;
  v_id uuid;
  v_sheets text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  v_project := nullif(btrim(coalesce(q->>'projectId', '')), '')::uuid;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Which project the question is about is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT lost_on INTO v_lost FROM public.gc_projects WHERE project_id = v_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'We lost this bid. Nobody is open on it.' USING ERRCODE = 'P0001';
  END IF;
  v_close := public.gc_questions_close_on(v_project);
  IF v_close IS NOT NULL AND current_date >= v_close THEN
    RAISE EXCEPTION 'Questions closed %. They close three days before our bid is due.', to_char(v_close, 'Mon DD') USING ERRCODE = 'P0001';
  END IF;
  v_text := btrim(coalesce(q->>'text', ''));
  IF v_text = '' THEN
    RAISE EXCEPTION 'Type the question first.' USING ERRCODE = 'P0001';
  END IF;
  v_pkg := nullif(btrim(coalesce(q->>'packageId', '')), '')::uuid;
  IF v_pkg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_pkg AND project_id = v_project) THEN
    RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(q->'sheets') = 'array' THEN
    v_sheets := ARRAY(SELECT DISTINCT upper(btrim(value #>> '{}')) FROM jsonb_array_elements(q->'sheets') WHERE btrim(value #>> '{}') <> '');
  ELSE
    v_sheets := '{}';
  END IF;
  INSERT INTO public.gc_plan_questions (project_id, package_id, asked_by_name, text, sheets, asked_on, created_by)
  VALUES (v_project, v_pkg, btrim(coalesce(q->>'askedByName', '')), v_text, v_sheets,
          coalesce(nullif(btrim(coalesce(q->>'askedOn', '')), '')::date, current_date), v_uid)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_answer_question(q jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_answer text;
  v_answered date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  v_id := nullif(btrim(coalesce(q->>'questionId', '')), '')::uuid;
  v_answer := btrim(coalesce(q->>'answer', ''));
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Which question is missing.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answer = '' THEN
    RAISE EXCEPTION 'Type the answer first.' USING ERRCODE = 'P0001';
  END IF;
  SELECT answered_on INTO v_answered FROM public.gc_plan_questions WHERE id = v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No question with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answered IS NOT NULL THEN
    RAISE EXCEPTION 'That question is answered already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_plan_questions SET answer = v_answer, answered_on = current_date WHERE id = v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_record_question(jsonb) IS 'GC mode (v2.4779): a question about the plans, recorded by the office while questions are open. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_answer_question(jsonb) IS 'GC mode (v2.4779): the architect''s answer on a question not answered yet. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_questions_close_on(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_record_question(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_answer_question(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_questions_close_on(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.gc_record_question(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.gc_answer_question(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_questions_close_on(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_record_question(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_answer_question(jsonb) TO authenticated;

-- gc_issue_plan_set, as 20261007090000 made it, with questionIds: the answered questions the set carries.
CREATE OR REPLACE FUNCTION public.gc_issue_plan_set(set_in jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_set uuid;
  v_rev integer;
  v_label text;
  v_checker uuid;
  v_lost date;
  v_pkg uuid;
  v_pos integer;
  i integer := 0;
  j integer;
  t jsonb;
  x jsonb;
  line text;
  sheets text[];
  specs text[];
  seen text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  v_project := nullif(btrim(coalesce(set_in->>'projectId', '')), '')::uuid;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Which project the set is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT lost_on INTO v_lost FROM public.gc_projects WHERE project_id = v_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'We lost this bid. Nothing goes out.' USING ERRCODE = 'P0001';
  END IF;
  v_label := btrim(coalesce(set_in->>'label', ''));
  IF v_label = '' THEN
    RAISE EXCEPTION 'Give the set a name.' USING ERRCODE = 'P0001';
  END IF;
  v_checker := nullif(btrim(coalesce(set_in->>'checkedByUserId', '')), '')::uuid;
  IF v_checker IS NULL THEN
    RAISE EXCEPTION 'Say who on our team checked the set.' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(max(rev), -1) + 1 INTO v_rev FROM public.gc_plan_sets WHERE project_id = v_project;

  INSERT INTO public.gc_plan_sets (
    project_id, rev, label, kind, issued_on, note, checked_by_user_id,
    drive_url, drive_access, drive_checked_on, created_by
  ) VALUES (
    v_project, v_rev, v_label, coalesce(set_in->>'kind', ''),
    coalesce(nullif(btrim(coalesce(set_in->>'issuedOn', '')), '')::date, current_date), coalesce(set_in->>'note', ''),
    v_checker,
    coalesce(set_in->'drive'->>'url', ''), nullif(btrim(coalesce(set_in->'drive'->>'access', '')), ''),
    nullif(btrim(coalesce(set_in->'drive'->>'checkedOn', '')), '')::date, v_uid
  ) RETURNING id INTO v_set;

  -- The sheets: added, renamed, taken out, and the rest named as revised. Each number once.
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(set_in->'addedSheets', '[]'::jsonb)) LOOP
    IF btrim(coalesce(x->>'id', '')) <> '' AND NOT (upper(x->>'id') = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change, discipline, page)
      VALUES (v_set, i, 'sheet', btrim(x->>'id'), coalesce(x->>'title', ''), 'added', nullif(x->>'discipline', ''), nullif(x->>'page', '')::integer);
      seen := seen || upper(x->>'id'); i := i + 1;
    END IF;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(set_in->'retitledSheets', '[]'::jsonb)) LOOP
    IF btrim(coalesce(x->>'id', '')) <> '' AND NOT (upper(x->>'id') = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change, was_title)
      VALUES (v_set, i, 'sheet', btrim(x->>'id'), coalesce(x->>'title', ''), 'renamed', nullif(x->>'wasTitle', ''));
      seen := seen || upper(x->>'id'); i := i + 1;
    END IF;
  END LOOP;
  FOR line IN SELECT value #>> '{}' FROM jsonb_array_elements(coalesce(set_in->'removedSheets', '[]'::jsonb)) LOOP
    IF btrim(coalesce(line, '')) <> '' AND NOT (upper(line) = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change)
      VALUES (v_set, i, 'sheet', btrim(line), '', 'removed');
      seen := seen || upper(line); i := i + 1;
    END IF;
  END LOOP;
  FOR line IN SELECT value #>> '{}' FROM jsonb_array_elements(coalesce(set_in->'sheets', '[]'::jsonb)) LOOP
    IF btrim(coalesce(line, '')) <> '' AND NOT (upper(line) = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change)
      VALUES (v_set, i, 'sheet', btrim(line), '', 'revised');
      seen := seen || upper(line); i := i + 1;
    END IF;
  END LOOP;

  -- The sections of the manual, the same way.
  seen := '{}';
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(set_in->'addedSpecs', '[]'::jsonb)) LOOP
    IF btrim(coalesce(x->>'id', '')) <> '' AND NOT (upper(x->>'id') = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change)
      VALUES (v_set, i, 'section', btrim(x->>'id'), coalesce(x->>'title', ''), 'added');
      seen := seen || upper(x->>'id'); i := i + 1;
    END IF;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(set_in->'retitledSpecs', '[]'::jsonb)) LOOP
    IF btrim(coalesce(x->>'id', '')) <> '' AND NOT (upper(x->>'id') = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change, was_title)
      VALUES (v_set, i, 'section', btrim(x->>'id'), coalesce(x->>'title', ''), 'renamed', nullif(x->>'wasTitle', ''));
      seen := seen || upper(x->>'id'); i := i + 1;
    END IF;
  END LOOP;
  FOR line IN SELECT value #>> '{}' FROM jsonb_array_elements(coalesce(set_in->'removedSpecs', '[]'::jsonb)) LOOP
    IF btrim(coalesce(line, '')) <> '' AND NOT (upper(line) = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change)
      VALUES (v_set, i, 'section', btrim(line), '', 'removed');
      seen := seen || upper(line); i := i + 1;
    END IF;
  END LOOP;
  FOR line IN SELECT value #>> '{}' FROM jsonb_array_elements(coalesce(set_in->'specs', '[]'::jsonb)) LOOP
    IF btrim(coalesce(line, '')) <> '' AND NOT (upper(line) = ANY (seen)) THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change)
      VALUES (v_set, i, 'section', btrim(line), '', 'revised');
      seen := seen || upper(line); i := i + 1;
    END IF;
  END LOOP;

  -- The trades the set brings, after the ones the job has, with their scope and exclusions. Nobody is asked yet.
  SELECT coalesce(max(position), -1) + 1 INTO v_pos FROM public.gc_trade_packages WHERE project_id = v_project;
  FOR t IN SELECT value FROM jsonb_array_elements(coalesce(set_in->'newTrades', '[]'::jsonb)) LOOP
    IF btrim(coalesce(t->>'trade', '')) = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO public.gc_trade_packages (project_id, trade, position, budget, ours)
    VALUES (v_project, btrim(t->>'trade'), v_pos, coalesce(nullif(btrim(coalesce(t->>'budget', '')), '')::numeric, 0), coalesce((t->>'ours')::boolean, false))
    RETURNING id INTO v_pkg;
    v_pos := v_pos + 1;
    j := 0;
    FOR line IN SELECT value #>> '{}' FROM jsonb_array_elements(coalesce(t->'scope', '[]'::jsonb)) LOOP
      IF btrim(coalesce(line, '')) <> '' THEN
        IF jsonb_typeof(t->'scopeSheets'->j) = 'array' THEN
          sheets := ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(t->'scopeSheets'->j));
        ELSE
          sheets := NULL;
        END IF;
        IF jsonb_typeof(t->'scopeSpecs'->j) = 'array' THEN
          specs := ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(t->'scopeSpecs'->j));
        ELSE
          specs := NULL;
        END IF;
        INSERT INTO public.gc_scope_items (package_id, position, label, sheets, specs, added_in_set_id)
        VALUES (v_pkg, j, btrim(line), sheets, specs, v_set);
      END IF;
      j := j + 1;
    END LOOP;
    j := 0;
    FOR x IN SELECT value FROM jsonb_array_elements(coalesce(t->'excludes', '[]'::jsonb)) LOOP
      IF btrim(coalesce(x->>'label', '')) <> '' THEN
        INSERT INTO public.gc_scope_exclusions (package_id, position, label, by)
        VALUES (v_pkg, j, btrim(x->>'label'), coalesce(x->>'by', ''));
        j := j + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Scope lines the set adds to trades already on the job, after the trade's own lines.
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(set_in->'newLines', '[]'::jsonb)) LOOP
    v_pkg := nullif(btrim(coalesce(x->>'packageId', '')), '')::uuid;
    IF v_pkg IS NULL OR btrim(coalesce(x->>'label', '')) = '' THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_pkg AND project_id = v_project) THEN
      RAISE EXCEPTION 'A line names a trade that is not on this project.' USING ERRCODE = 'P0001';
    END IF;
    IF jsonb_typeof(x->'sheets') = 'array' THEN
      sheets := ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(x->'sheets'));
    ELSE
      sheets := NULL;
    END IF;
    IF jsonb_typeof(x->'specs') = 'array' THEN
      specs := ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(x->'specs'));
    ELSE
      specs := NULL;
    END IF;
    SELECT coalesce(max(position), -1) + 1 INTO j FROM public.gc_scope_items WHERE package_id = v_pkg;
    INSERT INTO public.gc_scope_items (package_id, position, label, sheets, specs, added_in_set_id)
    VALUES (v_pkg, j, btrim(x->>'label'), sheets, specs, v_set);
  END LOOP;

  -- Lines left with nothing to read, tied to new sheets or sections. An empty list: the trade as a whole.
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(set_in->'retiedLines', '[]'::jsonb)) LOOP
    IF nullif(btrim(coalesce(x->>'scopeId', '')), '') IS NULL THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(x->'sheets') = 'array' THEN
      UPDATE public.gc_scope_items s SET sheets = ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(x->'sheets'))
      FROM public.gc_trade_packages p
      WHERE s.id = (x->>'scopeId')::uuid AND s.package_id = p.id AND p.project_id = v_project;
    END IF;
    IF jsonb_typeof(x->'specs') = 'array' THEN
      UPDATE public.gc_scope_items s SET specs = ARRAY(SELECT value #>> '{}' FROM jsonb_array_elements(x->'specs'))
      FROM public.gc_trade_packages p
      WHERE s.id = (x->>'scopeId')::uuid AND s.package_id = p.id AND p.project_id = v_project;
    END IF;
  END LOOP;

  -- The answered questions this set carries in its note (v2.4779): each not in a set yet.
  FOR line IN SELECT value #>> '{}' FROM jsonb_array_elements(coalesce(set_in->'questionIds', '[]'::jsonb)) LOOP
    IF nullif(btrim(coalesce(line, '')), '') IS NOT NULL THEN
      UPDATE public.gc_plan_questions SET in_set_id = v_set
      WHERE id = line::uuid AND project_id = v_project AND answered_on IS NOT NULL AND in_set_id IS NULL;
    END IF;
  END LOOP;

  RETURN v_set;
END;
$$;


