SET lock_timeout = '3s';

-- GC mode, door 1 (v2.4832): New project, the plans window, the questions window and the scope
-- book open to the office and estimators (to-dos/gc-mode/mockups/door-1-new-project.md on branch
-- spike/gc-mode). Until now every New project table was dev only (decision 2 of
-- NEW_PROJECT_REAL_BUILD.md: dev only while it is built).
--   1) public.gc_office_team(): who is on GC mode's office team, named once. Today it is
--      is_office_or_estimator(): dev, the leaders, the assistants, the controller and estimators.
--   2) The twelve tables swap their dev-only policy for one team policy, and anon loses its grants.
--   3) The team reads the projects row of a GC project (the office already reads every project;
--      an estimator read none, since a GC project's master_user_id is null).
--   4) gc_create_project runs as its owner behind the same gate, refuses a training account and a
--      digital twin, and files a customer named for the first time under the company owner, as
--      every new customer is since one company (v2.2967). Before, only a dev or a leader could name
--      someone new (the customers guard refuses any other master_user_id), and an estimator could
--      not write the projects row at all.
-- The other RPCs (gc_issue_plan_set, gc_record_question, gc_answer_question, gc_questions_close_on)
-- are SECURITY INVOKER and write only the twelve tables, so the policies here are their gate.

-- 1) The team.
CREATE OR REPLACE FUNCTION public.gc_office_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_office_or_estimator();
$$;

COMMENT ON FUNCTION public.gc_office_team() IS
  'GC mode door 1 (v2.4832): who may read and write the New project tables, named once. Today the office and estimators (is_office_or_estimator()). Change the audience here, never in the policies.';

REVOKE EXECUTE ON FUNCTION public.gc_office_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_office_team() TO authenticated, service_role;

-- 2) The twelve tables: one policy each for every verb, asked once a statement.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_projects', 'gc_trade_packages', 'gc_scope_items', 'gc_scope_exclusions',
    'gc_scope_book_saved', 'gc_scope_book_edits', 'gc_scope_book_merges', 'gc_scope_sets',
    'gc_plan_sets', 'gc_plan_set_items', 'gc_plan_questions', 'gc_plan_set_sends'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()))',
      t || '_team', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- 3) The projects row of a GC project, for the team. A second permissive SELECT policy beside
-- "Users can see projects they have access to"; it reads gc_projects, whose policy reads users
-- only, so nothing loops.
DROP POLICY IF EXISTS "GC team sees GC projects" ON public.projects;
CREATE POLICY "GC team sees GC projects" ON public.projects FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()) AND EXISTS (SELECT 1 FROM public.gc_projects g WHERE g.project_id = projects.id));

-- 4) New project's press, behind the team's gate.
CREATE OR REPLACE FUNCTION public.gc_create_project(draft jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(draft->>'name', ''));
  v_role text := coalesce(nullif(btrim(draft->>'customerRole'), ''), 'owner');
  v_company uuid := public.company_owner_user_id();
  v_customer uuid;
  v_architect uuid;
  v_owner uuid;
  v_project uuid;
  v_pkg uuid;
  v_set uuid;
  t jsonb;
  s jsonb;
  ex jsonb;
  line text;
  sheets text[];
  specs text[];
  i integer := 0;
  j integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to make a project.';
  END IF;
  -- The gate (door 1): it runs as its owner, so it says who may, in words.
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'GC projects are for the office and estimators.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot make a project.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot make a GC project.' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Give the project a name.';
  END IF;
  -- The prototype spells the role ownersRep; the table spells it owners_rep.
  IF v_role = 'ownersRep' THEN
    v_role := 'owners_rep';
  END IF;
  IF v_role NOT IN ('owner', 'gc', 'owners_rep') THEN
    RAISE EXCEPTION 'Who we work for must be the owner, a general contractor or an owner''s rep.';
  END IF;
  -- Someone named for the first time is filed under the company owner (one company, v2.2967).
  IF v_company IS NULL AND (
    (nullif(btrim(coalesce(draft->>'customerId', '')), '') IS NULL AND btrim(coalesce(draft->>'ownerName', '')) <> '')
    OR (nullif(btrim(coalesce(draft->>'architectId', '')), '') IS NULL AND btrim(coalesce(draft->>'architectName', '')) <> '')
    OR (nullif(btrim(coalesce(draft->>'propertyOwnerId', '')), '') IS NULL AND btrim(coalesce(draft->>'propertyOwnerName', '')) <> '')
  ) THEN
    RAISE EXCEPTION 'Settings names no company owner, so someone new cannot be filed. Pick them from the list.';
  END IF;

  -- The customer: a record, or a company named for the first time (an ordinary commercial customer).
  v_customer := nullif(btrim(coalesce(draft->>'customerId', '')), '')::uuid;
  IF v_customer IS NULL THEN
    IF btrim(coalesce(draft->>'ownerName', '')) = '' THEN
      RAISE EXCEPTION 'Say who the customer is.';
    END IF;
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'ownerName'), v_company, 'commercial')
    RETURNING id INTO v_customer;
  END IF;

  -- The architect, the same way (decision 4: an ordinary customer row). Optional.
  v_architect := nullif(btrim(coalesce(draft->>'architectId', '')), '')::uuid;
  IF v_architect IS NULL AND btrim(coalesce(draft->>'architectName', '')) <> '' THEN
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'architectName'), v_company, 'commercial')
    RETURNING id INTO v_architect;
  END IF;

  -- The property's owner, when someone other than the customer. Optional.
  v_owner := nullif(btrim(coalesce(draft->>'propertyOwnerId', '')), '')::uuid;
  IF v_owner IS NULL AND btrim(coalesce(draft->>'propertyOwnerName', '')) <> '' THEN
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'propertyOwnerName'), v_company, 'commercial')
    RETURNING id INTO v_owner;
  END IF;

  -- The projects row: the number comes from its sequence (set_project_number_if_empty).
  INSERT INTO public.projects (name, address, customer_id, plans_link)
  VALUES (v_name, nullif(btrim(coalesce(draft->>'address', '')), ''), v_customer, nullif(btrim(coalesce(draft->'drive'->>'url', '')), ''))
  RETURNING id INTO v_project;

  INSERT INTO public.gc_projects (
    project_id, stage, bid_due, sq_ft, size_note, customer_role,
    property_owner_customer_id, architect_customer_id, created_by
  ) VALUES (
    v_project, 'bidding', nullif(btrim(coalesce(draft->>'bidDue', '')), '')::date,
    nullif(btrim(coalesce(draft->>'sqFt', '')), '')::numeric, coalesce(draft->>'sizeNote', ''), v_role,
    v_owner, v_architect, v_uid
  );

  -- Each trade, in the draft's order, with its scope lines and what its quote leaves out.
  FOR t IN SELECT value FROM jsonb_array_elements(coalesce(draft->'trades', '[]'::jsonb)) LOOP
    IF btrim(coalesce(t->>'trade', '')) = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO public.gc_trade_packages (project_id, trade, position, budget, ours)
    VALUES (v_project, btrim(t->>'trade'), i, coalesce(nullif(btrim(coalesce(t->>'budget', '')), '')::numeric, 0), coalesce((t->>'ours')::boolean, false))
    RETURNING id INTO v_pkg;
    i := i + 1;

    j := 0;
    FOR line IN SELECT value #>> '{}' FROM jsonb_array_elements(coalesce(t->'scope', '[]'::jsonb)) LOOP
      IF btrim(coalesce(line, '')) <> '' THEN
        -- The sheets and sections the office tied to the line, in the order of the scope; absent: follow the guess.
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
        INSERT INTO public.gc_scope_items (package_id, position, label, sheets, specs)
        VALUES (v_pkg, j, btrim(line), sheets, specs);
      END IF;
      j := j + 1;
    END LOOP;

    j := 0;
    FOR ex IN SELECT value FROM jsonb_array_elements(coalesce(t->'excludes', '[]'::jsonb)) LOOP
      IF btrim(coalesce(ex->>'label', '')) <> '' THEN
        INSERT INTO public.gc_scope_exclusions (package_id, position, label, by)
        VALUES (v_pkg, j, btrim(ex->>'label'), coalesce(ex->>'by', ''));
        j := j + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- The first set of plans, rev 0, with every sheet and section as issued.
  INSERT INTO public.gc_plan_sets (
    project_id, rev, label, kind, issued_on, note, checked_by_user_id,
    drive_url, drive_access, drive_checked_on, created_by
  ) VALUES (
    v_project, 0, coalesce(nullif(btrim(coalesce(draft->>'setLabel', '')), ''), 'Bid set'), coalesce(draft->>'setKind', ''),
    coalesce(nullif(btrim(coalesce(draft->>'issuedOn', '')), '')::date, current_date), coalesce(draft->>'setNote', ''),
    coalesce(nullif(btrim(coalesce(draft->>'checkedByUserId', '')), '')::uuid, v_uid),
    coalesce(draft->'drive'->>'url', ''), nullif(btrim(coalesce(draft->'drive'->>'access', '')), ''),
    nullif(btrim(coalesce(draft->'drive'->>'checkedOn', '')), '')::date, v_uid
  )
  RETURNING id INTO v_set;

  j := 0;
  FOR s IN SELECT value FROM jsonb_array_elements(coalesce(draft->'sheets', '[]'::jsonb)) LOOP
    IF btrim(coalesce(s->>'id', '')) <> '' THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change, discipline, page)
      VALUES (v_set, j, 'sheet', btrim(s->>'id'), coalesce(s->>'title', ''), 'issued', nullif(btrim(coalesce(s->>'discipline', '')), ''), nullif(btrim(coalesce(s->>'page', '')), '')::integer);
      j := j + 1;
    END IF;
  END LOOP;
  FOR s IN SELECT value FROM jsonb_array_elements(coalesce(draft->'specs', '[]'::jsonb)) LOOP
    IF btrim(coalesce(s->>'id', '')) <> '' THEN
      INSERT INTO public.gc_plan_set_items (set_id, position, kind, number, title, change)
      VALUES (v_set, j, 'section', btrim(s->>'id'), coalesce(s->>'title', ''), 'issued');
      j := j + 1;
    END IF;
  END LOOP;

  RETURN v_project;
END;
$$;

COMMENT ON FUNCTION public.gc_create_project(jsonb) IS
  'GC mode: New project''s press, all or nothing. Takes the prototype''s NewProjectDraft as jsonb (name, address, customerId or ownerName, architectId or architectName, propertyOwnerId or propertyOwnerName, customerRole, bidDue, sqFt, sizeNote, setLabel, setKind, issuedOn, setNote, checkedByUserId, drive {url, access, checkedOn}, sheets, specs, trades [{trade, budget, ours, scope, scopeSheets, scopeSpecs, excludes}]) and writes the projects row, gc_projects, the trades with their scope lines and exclusions, and set 0 with every sheet and section as issued. Returns the project id. SECURITY DEFINER since door 1 (v2.4832): the GC office team only (gc_office_team()), never a training account or a digital twin; someone named for the first time is filed under company_owner_user_id().';

REVOKE ALL ON FUNCTION public.gc_create_project(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_create_project(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_create_project(jsonb) TO authenticated;
