SET lock_timeout = '3s';

-- GC mode (v2.4757, real build step 6): gc_issue_plan_set(set jsonb), the one press that puts a new
-- set of plans on a project. It writes the set with its items (the sheets and sections it revises,
-- adds, takes out and renames), the trades it brings with their scope and exclusions, the scope
-- lines it adds to trades already on the job, and the lines it ties to new sheets or sections when
-- what they read is gone, in one transaction. It refuses a lost bid and a set with no checker. The
-- Drive link is checked by gc-drive-access before the press; the set records the verdict.
-- SECURITY INVOKER, so the tables' policies decide who may (dev only while the build goes on).
-- Plan: to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on spike/gc-mode. Doc: docs/migrations/.

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

  RETURN v_set;
END;
$$;

COMMENT ON FUNCTION public.gc_issue_plan_set(jsonb) IS
  'GC mode (v2.4757): a new set of plans on a project in one press: the set and its items, the trades it brings, the lines it adds and the lines it ties to new sheets. Refuses a lost bid and a set with no checker. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_issue_plan_set(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_issue_plan_set(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_issue_plan_set(jsonb) TO authenticated;
