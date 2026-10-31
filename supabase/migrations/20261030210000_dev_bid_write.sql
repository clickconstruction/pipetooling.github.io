SET lock_timeout = '3s';

-- The dev seat's bid verbs (v2.6183; the owner, 2026-10-30, after the Gun Dog intake: "a verb to
-- upload … so that anyone with dev access can direct an agent to set up a bid for estimating").
-- Until now no verb made a bid row: a dev's agent read every bid and wrote none.
--
-- dev_bid_write(p, p_dry_run, p_link): the dry-run wrapper the dev seat's plan_bid / apply_bid
-- POST (action create) and, in the next PR, plan_file_plans / apply_file_plans (action file_plans)
-- — both here so one push serves the train. Devs only.
--   create:     the row the New Bid form makes, numbered by set_bid_number_if_empty at insert.
--   file_plans: once the set is in Drive, the plans link the robots read and a bid_plan_sets row
--               named for it; p_link carries the Drive leg the function did first.
-- The dry run replies with the row as it will read; the real run writes as the dev.

CREATE OR REPLACE FUNCTION public.dev_bid_write(p jsonb, p_dry_run boolean DEFAULT true, p_link jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_action text := lower(btrim(COALESCE(p->>'action', 'create')));
  v_project text := left(btrim(COALESCE(p->>'project_name', '')), 120);
  v_address text := NULLIF(btrim(COALESCE(p->>'address', '')), '');
  v_customer_id uuid;
  v_customer_name text;
  v_service_type_id uuid;
  v_service_type_name text;
  v_division text;
  v_development_id uuid := NULL;
  v_development_name text := NULL;
  v_distance text := NULLIF(btrim(COALESCE(p->>'distance_from_office', '')), '');
  v_due_date date := NULL;
  v_due_time time := NULL;
  v_estimator_id uuid;
  v_estimator_name text;
  v_notes text := NULLIF(btrim(COALESCE(p->>'notes', '')), '');
  v_opt_out boolean := COALESCE((p->>'robot_opt_out')::boolean, false);
  v_same_name jsonb;
  v_bid public.bids%ROWTYPE;
  v_file_name text := left(btrim(COALESCE(p->>'file_name', '')), 140);
  v_size bigint;
  v_sha text := lower(btrim(COALESCE(p->>'sha256', '')));
  v_replace boolean := COALESCE((p->>'replace')::boolean, false);
  v_set_name text;
  v_memo text := left(btrim(COALESCE(p->>'memo', '')), 500);
  v_sets integer;
  v_folder_link text;
  v_file_link text;
  v_pages integer;
  v_set_id uuid;
  v_id uuid;
  v_number text;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_bid_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('create', 'file_plans') THEN
    RAISE EXCEPTION 'dev_bid_write: action must be create or file_plans';
  END IF;

  -- ── create: the row the New Bid form makes ──────────────────────────────────────────────
  IF v_action = 'create' THEN
    IF v_project = '' THEN RAISE EXCEPTION 'dev_bid_write: project_name is required — it names the bid and its plans folder'; END IF;
    IF COALESCE(p->>'customer_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_bid_write: customer_id is required (a customers.id — find_customer)'; END IF;
    SELECT id, name INTO v_customer_id, v_customer_name FROM public.customers WHERE id = (p->>'customer_id')::uuid;
    IF v_customer_id IS NULL THEN RAISE EXCEPTION 'dev_bid_write: customer % not found', p->>'customer_id'; END IF;
    IF COALESCE(p->>'service_type_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_bid_write: service_type_id is required (a service_types.id — read_rows on service_types)'; END IF;
    SELECT id, name INTO v_service_type_id, v_service_type_name FROM public.service_types WHERE id = (p->>'service_type_id')::uuid;
    IF v_service_type_id IS NULL THEN RAISE EXCEPTION 'dev_bid_write: service type % not found', p->>'service_type_id'; END IF;
    -- The division folder the plans go in, by the service type's name (divisionBidFolderFor).
    v_division := CASE
      WHEN v_service_type_name ~* 'plumb' THEN 'plumbing'
      WHEN v_service_type_name ~* 'electric' THEN 'electrical'
      WHEN v_service_type_name ~* 'hvac|heat|air' THEN 'hvac'
      ELSE NULL END;
    IF COALESCE(p->>'development_id', '') <> '' THEN
      IF p->>'development_id' !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_bid_write: development_id must be a developments.id'; END IF;
      SELECT id, name INTO v_development_id, v_development_name FROM public.developments WHERE id = (p->>'development_id')::uuid;
      IF v_development_id IS NULL THEN RAISE EXCEPTION 'dev_bid_write: development % not found', p->>'development_id'; END IF;
    END IF;
    IF v_distance IS NOT NULL AND v_distance !~ '^[0-9]+(\.[0-9]+)?$' THEN RAISE EXCEPTION 'dev_bid_write: distance_from_office is miles, a number'; END IF;
    IF COALESCE(p->>'bid_due_date', '') <> '' THEN
      BEGIN
        v_due_date := (p->>'bid_due_date')::date;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'dev_bid_write: bid_due_date must be YYYY-MM-DD';
      END;
    END IF;
    IF COALESCE(p->>'bid_due_time', '') <> '' THEN
      BEGIN
        v_due_time := (p->>'bid_due_time')::time;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'dev_bid_write: bid_due_time must be HH:MM';
      END;
    END IF;
    IF COALESCE(p->>'estimator_id', '') <> '' THEN
      IF p->>'estimator_id' !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_bid_write: estimator_id must be a users.id'; END IF;
      SELECT id, name INTO v_estimator_id, v_estimator_name FROM public.users WHERE id = (p->>'estimator_id')::uuid AND archived_at IS NULL;
      IF v_estimator_id IS NULL THEN RAISE EXCEPTION 'dev_bid_write: estimator % not found, or archived', p->>'estimator_id'; END IF;
    ELSE
      SELECT id, name INTO v_estimator_id, v_estimator_name FROM public.users WHERE id = auth.uid();
    END IF;
    -- Live bids already wearing the name: unsent, undecided, still on the working board.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('bid', 'b' || b.bid_number, 'id', b.id, 'created_at', b.created_at) ORDER BY b.created_at DESC), '[]'::jsonb)
      INTO v_same_name
      FROM public.bids b
      WHERE lower(btrim(COALESCE(b.project_name, ''))) = lower(v_project)
        AND b.bid_date_sent IS NULL AND b.outcome IS NULL AND b.working_board_archived_at IS NULL;
    IF jsonb_array_length(v_same_name) > 0 AND NOT COALESCE((p->>'allow_duplicate_name')::boolean, false) THEN
      RAISE EXCEPTION 'dev_bid_write: a live bid already wears the name "%" (%) — plan with allow_duplicate_name: true if you mean a second one, or file the plans on that bid', v_project, (SELECT string_agg(x->>'bid', ', ') FROM jsonb_array_elements(v_same_name) x);
    END IF;

    v_after := jsonb_build_object(
      'project_name', v_project,
      'address', v_address,
      'customer', jsonb_build_object('id', v_customer_id, 'name', v_customer_name),
      'service_type', jsonb_build_object('id', v_service_type_id, 'name', v_service_type_name),
      'division', v_division,
      'development', CASE WHEN v_development_id IS NULL THEN NULL ELSE jsonb_build_object('id', v_development_id, 'name', v_development_name) END,
      'distance_from_office', v_distance,
      'bid_due_date', v_due_date,
      'bid_due_time', v_due_time,
      'estimator', jsonb_build_object('id', v_estimator_id, 'name', v_estimator_name),
      'robot_opt_out', v_opt_out,
      'notes_chars', COALESCE(length(v_notes), 0),
      'plans_folder_name', v_project,
      'same_name_live_bids', v_same_name,
      'readiness', jsonb_build_object(
        'plans', 'missing — file the set next (plan_file_plans), or paste a Drive link on the bid form',
        'address', v_address IS NOT NULL,
        'distance', v_distance IS NOT NULL,
        'due_date', v_due_date IS NOT NULL,
        'division_folder', v_division IS NOT NULL,
        'robots', NOT v_opt_out
      )
    );
    IF p_dry_run THEN
      RETURN jsonb_build_object('ok', true, 'dry_run', true, 'action', 'create', 'after', v_after);
    END IF;

    INSERT INTO public.bids (project_name, address, customer_id, service_type_id, development_id, distance_from_office, bid_due_date, bid_due_time, estimator_id, created_by, notes, robot_opt_out)
    VALUES (v_project, v_address, v_customer_id, v_service_type_id, v_development_id, v_distance, v_due_date, v_due_time, v_estimator_id, auth.uid(), v_notes, v_opt_out)
    RETURNING id, bid_number INTO v_id, v_number;
    RETURN jsonb_build_object('ok', true, 'dry_run', false, 'action', 'create', 'bid_id', v_id, 'bid_number', v_number, 'after', v_after);
  END IF;

  -- ── file_plans: the set is in Drive; the bid reads it from here ──────────────────────────
  IF COALESCE(p->>'bid_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_bid_write: bid_id is required (a bids.id — find_bid)'; END IF;
  SELECT * INTO v_bid FROM public.bids WHERE id = (p->>'bid_id')::uuid;
  IF v_bid.id IS NULL THEN RAISE EXCEPTION 'dev_bid_write: bid % not found', p->>'bid_id'; END IF;
  IF v_bid.bid_date_sent IS NOT NULL THEN RAISE EXCEPTION 'dev_bid_write: b% was sent on % — the robots read live bids only', v_bid.bid_number, v_bid.bid_date_sent; END IF;
  IF v_bid.outcome IS NOT NULL THEN RAISE EXCEPTION 'dev_bid_write: b% is decided (%)', v_bid.bid_number, v_bid.outcome; END IF;
  IF v_bid.working_board_archived_at IS NOT NULL THEN RAISE EXCEPTION 'dev_bid_write: b% is archived off the working board', v_bid.bid_number; END IF;
  SELECT name INTO v_service_type_name FROM public.service_types WHERE id = v_bid.service_type_id;
  v_division := CASE
    WHEN v_service_type_name ~* 'plumb' THEN 'plumbing'
    WHEN v_service_type_name ~* 'electric' THEN 'electrical'
    WHEN v_service_type_name ~* 'hvac|heat|air' THEN 'hvac'
    ELSE NULL END;
  IF v_division IS NULL THEN RAISE EXCEPTION 'dev_bid_write: b% is % — no division folder holds its plans (plumbing, electrical or HVAC)', v_bid.bid_number, COALESCE(v_service_type_name, 'without a service type'); END IF;
  IF v_file_name = '' OR v_file_name !~* '\.pdf$' THEN RAISE EXCEPTION 'dev_bid_write: file_name must be the PDF''s name, ending .pdf'; END IF;
  IF v_file_name ~ '[/\\]' THEN RAISE EXCEPTION 'dev_bid_write: file_name is a name, not a path'; END IF;
  BEGIN
    v_size := (p->>'size_bytes')::bigint;
  EXCEPTION WHEN OTHERS THEN
    v_size := NULL;
  END;
  IF v_size IS NULL OR v_size < 1 OR v_size > 52428800 THEN RAISE EXCEPTION 'dev_bid_write: size_bytes must be 1 to 52,428,800 — CountTooling refuses a set over 50 MB'; END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'dev_bid_write: sha256 must be the file''s sha256, 64 hex characters'; END IF;
  IF NULLIF(btrim(COALESCE(v_bid.plans_link, '')), '') IS NOT NULL AND NOT v_replace THEN
    RAISE EXCEPTION 'dev_bid_write: b% already has plans (%) — pass replace: true to point the robot at the new set', v_bid.bid_number, v_bid.plans_link;
  END IF;
  v_set_name := left(NULLIF(btrim(COALESCE(p->>'set_name', '')), ''), 120);
  IF v_set_name IS NULL THEN v_set_name := left(regexp_replace(v_file_name, '\.pdf$', '', 'i'), 120); END IF;
  IF v_memo = '' THEN v_memo := 'Filed by the dev seat'; END IF;
  SELECT count(*) INTO v_sets FROM public.bid_plan_sets WHERE bid_id = v_bid.id;

  v_after := jsonb_build_object(
    'bid', 'b' || v_bid.bid_number,
    'bid_id', v_bid.id,
    'project_name', v_bid.project_name,
    'division', v_division,
    'plans_folder_name', left(COALESCE(NULLIF(btrim(v_bid.project_name), ''), 'Bid ' || v_bid.bid_number), 120),
    'plans_link_before', NULLIF(btrim(COALESCE(v_bid.plans_link, '')), ''),
    'replace', v_replace,
    'file_name', v_file_name,
    'size_bytes', v_size,
    'sha256', v_sha,
    'set_name', v_set_name,
    'memo', v_memo,
    'sets_on_bid', v_sets
  );
  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'action', 'file_plans', 'after', v_after);
  END IF;

  v_folder_link := NULLIF(btrim(COALESCE(p_link->>'folder_link', '')), '');
  v_file_link := NULLIF(btrim(COALESCE(p_link->>'file_link', '')), '');
  BEGIN
    v_pages := (p_link->>'pages')::integer;
  EXCEPTION WHEN OTHERS THEN
    v_pages := NULL;
  END;
  IF v_folder_link IS NULL OR v_folder_link !~ '^https://drive\.google\.com/drive/folders/' THEN
    RAISE EXCEPTION 'dev_bid_write: the real run needs p_link.folder_link — the Drive folder the set was filed in';
  END IF;
  UPDATE public.bids SET plans_link = v_folder_link WHERE id = v_bid.id;
  INSERT INTO public.bid_plan_sets (bid_id, name, memo, plan_date, link, file_name, file_size, file_count, checked_at, check_note, created_by)
  VALUES (v_bid.id, v_set_name, v_memo, NULL, v_folder_link, v_file_name, v_size, 1, now(), NULL, auth.uid())
  RETURNING id INTO v_set_id;
  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'action', 'file_plans', 'bid_id', v_bid.id, 'bid_number', v_bid.bid_number, 'plans_link', v_folder_link, 'file_link', v_file_link, 'pages', v_pages, 'set_id', v_set_id, 'after', v_after);
END;
$fn$;

REVOKE ALL ON FUNCTION public.dev_bid_write(jsonb, boolean, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.dev_bid_write(jsonb, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_bid_write(jsonb, boolean, jsonb) TO authenticated;

COMMENT ON FUNCTION public.dev_bid_write(jsonb, boolean, jsonb) IS 'The dev seat''s bid write (v2.6183): plan (dry run) then apply, devs only. action create inserts a bid as the New Bid form makes it (numbered by set_bid_number_if_empty); action file_plans sets the plans link the robots read and records the set in bid_plan_sets once p_link carries the Drive folder.';
