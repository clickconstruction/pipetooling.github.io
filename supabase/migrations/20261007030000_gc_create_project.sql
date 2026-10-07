SET lock_timeout = '3s';

-- GC mode, the real build, step 4a: gc_create_project (to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on
-- branch spike/gc-mode, "Writing it: three RPCs, so a step is all or nothing"). New project's five
-- steps end in one press; this writes everything that press makes in one transaction, or nothing:
-- the projects row, gc_projects, each trade with its scope lines and exclusions, and the first set
-- of plans with every sheet and section as issued. It takes the prototype's NewProjectDraft shape
-- as jsonb, with customerRole, the property's owner, sqFt and the first set's drive (checked
-- before the press, by gc-drive-access once that lands). SECURITY INVOKER, so RLS decides who may:
-- today the gc_* tables are dev-only, and the projects and customers rows follow their own policies.
CREATE OR REPLACE FUNCTION public.gc_create_project(draft jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(draft->>'name', ''));
  v_role text := coalesce(nullif(btrim(draft->>'customerRole'), ''), 'owner');
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

  -- The customer: a record, or a company named for the first time (an ordinary commercial customer,
  -- with the person making the project as its master until the office changes it).
  v_customer := nullif(btrim(coalesce(draft->>'customerId', '')), '')::uuid;
  IF v_customer IS NULL THEN
    IF btrim(coalesce(draft->>'ownerName', '')) = '' THEN
      RAISE EXCEPTION 'Say who the customer is.';
    END IF;
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'ownerName'), v_uid, 'commercial')
    RETURNING id INTO v_customer;
  END IF;

  -- The architect, the same way (decision 4: an ordinary customer row). Optional.
  v_architect := nullif(btrim(coalesce(draft->>'architectId', '')), '')::uuid;
  IF v_architect IS NULL AND btrim(coalesce(draft->>'architectName', '')) <> '' THEN
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'architectName'), v_uid, 'commercial')
    RETURNING id INTO v_architect;
  END IF;

  -- The property's owner, when someone other than the customer. Optional.
  v_owner := nullif(btrim(coalesce(draft->>'propertyOwnerId', '')), '')::uuid;
  IF v_owner IS NULL AND btrim(coalesce(draft->>'propertyOwnerName', '')) <> '' THEN
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'propertyOwnerName'), v_uid, 'commercial')
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
  'GC mode: New project''s press, all or nothing. Takes the prototype''s NewProjectDraft as jsonb (name, address, customerId or ownerName, architectId or architectName, propertyOwnerId or propertyOwnerName, customerRole, bidDue, sqFt, sizeNote, setLabel, setKind, issuedOn, setNote, checkedByUserId, drive {url, access, checkedOn}, sheets, specs, trades [{trade, budget, ours, scope, scopeSheets, scopeSpecs, excludes}]) and writes the projects row, gc_projects, the trades with their scope lines and exclusions, and set 0 with every sheet and section as issued. Returns the project id. SECURITY INVOKER: RLS decides who may.';

REVOKE ALL ON FUNCTION public.gc_create_project(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_create_project(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_create_project(jsonb) TO authenticated;
