SET lock_timeout = '3s';

-- Materials on site (punch list #209): three small fixes the dev seat's work turned up (v2.6456).
--
--   1. created_by on a cage, a box or a place. No screen passes the signed-in user to the store (it sends
--      created_by: null), so every container on prod read null. A BEFORE INSERT trigger fills it from auth.uid()
--      when the insert leaves it null: every client at once, the cached ones on crews' phones too, and the dev
--      seat's wrapper, which already sets it, is untouched. Rows written before this stay null; nothing recorded
--      who made them.
--   2. on_site_line_on_hand(container, part_id, part_name): both part arguments default to null, so the dev
--      seat's call_read, a GET that cannot send a null, reads a typed-name line with p_part_name alone and a
--      parts-book line with p_part_id alone. The body is unchanged.
--   3. dev_on_site_write names the job as the app does (JP1085), not the bare number. Re-stated whole from its
--      newest definition (20261102100000); only the job lookup changed.

-- 1. Who made a cage, a box or a place.
CREATE OR REPLACE FUNCTION public.on_site_fill_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.on_site_fill_created_by() IS 'Materials on site (#209, v2.6456): fills created_by on a new job_containers or job_places row from auth.uid() when the insert leaves it null (the screens send null). A service-role insert stays null.';

CREATE OR REPLACE TRIGGER job_containers_fill_created_by BEFORE INSERT ON public.job_containers
  FOR EACH ROW EXECUTE FUNCTION public.on_site_fill_created_by();
CREATE OR REPLACE TRIGGER job_places_fill_created_by BEFORE INSERT ON public.job_places
  FOR EACH ROW EXECUTE FUNCTION public.on_site_fill_created_by();

-- 2. The ledger's arithmetic, callable with one part argument.
CREATE OR REPLACE FUNCTION public.on_site_line_on_hand(p_container_id uuid, p_part_id uuid DEFAULT NULL, p_part_name text DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH line AS (
    SELECT m.id, m.at, m.quantity, m.reason, m.from_container_id, m.to_container_id
    FROM public.job_material_movements m
    WHERE (m.from_container_id = p_container_id OR m.to_container_id = p_container_id)
      AND CASE
            WHEN p_part_id IS NOT NULL THEN m.part_id = p_part_id
            ELSE m.part_id IS NULL AND lower(regexp_replace(btrim(m.part_name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(COALESCE(p_part_name, '')), '\s+', ' ', 'g'))
          END
  ),
  last_count AS (
    SELECT at, id, quantity FROM line
    WHERE reason = 'counted' AND from_container_id = p_container_id
    ORDER BY at DESC, id::text DESC
    LIMIT 1
  )
  SELECT (COALESCE((SELECT quantity FROM last_count), 0) + COALESCE(SUM(
    CASE
      WHEN r.reason = 'counted' THEN 0
      WHEN r.reason = 'delivered' THEN CASE WHEN r.to_container_id = p_container_id THEN r.quantity ELSE 0 END
      WHEN r.reason = 'moved' THEN (CASE WHEN r.to_container_id = p_container_id THEN r.quantity ELSE 0 END)
                                 - (CASE WHEN r.from_container_id = p_container_id THEN r.quantity ELSE 0 END)
      ELSE CASE WHEN r.from_container_id = p_container_id THEN -r.quantity ELSE 0 END
    END), 0))::integer
  FROM line r
  WHERE NOT EXISTS (SELECT 1 FROM last_count)
     OR (r.at, r.id::text) > (SELECT lc.at, lc.id::text FROM last_count lc)
$fn$;

REVOKE ALL ON FUNCTION public.on_site_line_on_hand(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_line_on_hand(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_site_line_on_hand(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.on_site_line_on_hand(uuid, uuid, text) IS 'Materials on site (#209): what a container holds of one part as the ledger reads it — the sum of the line''s rows since its last count, which resets it. The same arithmetic as src/lib/materials/onSite.ts containerLines; the dev seat''s dry runs read it. Runs as the caller. Both part arguments default to null (v2.6456), so a caller over GET names one.';

-- 3. The dev seat's write, naming the job as the app does.
CREATE OR REPLACE FUNCTION public.dev_on_site_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_action text := lower(btrim(COALESCE(p->>'action', '')));
  v_job_id uuid;
  v_job_label text;
  v_job_name text;
  v_dev_name text;
  v_agent text := btrim(COALESCE(p->>'agent_label', ''));
  v_by_name text;
  v_at timestamptz := NULL;
  v_at_words text := 'now';
  v_container public.job_containers%ROWTYPE;
  v_to public.job_containers%ROWTYPE;
  v_container_ref text;
  v_label text;
  v_kind text;
  v_where text;
  v_place_name text;
  v_place_id uuid := NULL;
  v_place_is_new boolean := false;
  v_from_place text;
  v_reason text;
  v_note text;
  v_source text;
  v_quantity integer;
  v_part_id uuid;
  v_part_name text;
  v_manufacturer text;
  v_on_hand integer;
  v_to_on_hand integer;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_n integer := 0;
  v_container_rows integer := 0;
  v_ids jsonb := '[]'::jsonb;
  v_id uuid;
  v_code text;
  v_after jsonb;
  v_reply jsonb;
BEGIN
  -- Who may write: a dev, with their own key, not in training mode, not a twin.
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_on_site_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'dev_on_site_write: a training account (read_only) cannot write materials on site' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'dev_on_site_write: a digital twin cannot write materials on site' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(NULLIF(btrim(u.name), ''), u.email, 'the dev') INTO v_dev_name FROM public.users u WHERE u.id = auth.uid();

  IF v_action NOT IN ('add_container', 'move_container', 'retire_container', 'bring_back_container', 'delivery', 'movement', 'count') THEN
    RAISE EXCEPTION 'dev_on_site_write: action must be add_container, move_container, retire_container, bring_back_container, delivery, movement or count';
  END IF;
  IF v_agent = '' THEN RAISE EXCEPTION 'dev_on_site_write: agent_label is required — the robot''s name as the row will show it (the receiving robot)'; END IF;
  IF length(v_agent) > 80 THEN RAISE EXCEPTION 'dev_on_site_write: keep agent_label under 80 characters'; END IF;
  v_by_name := left(v_agent || ' · MCP as ' || v_dev_name, 120);

  -- The job, under the caller's own RLS, then the screens' own gate.
  IF COALESCE(p->>'job_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_on_site_write: job_id is required (a jobs_ledger.id — find_job)';
  END IF;
  -- The job as the app names it (JP1085): the service type's job prefix, else J, then the HCP number, else the Click
  -- number — src/lib/ledgerDisplayPrefixes.ts formatJobLedgerNumberLabel over effectiveJobLedgerNumber (v2.6456).
  SELECT j.id, COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, '')
    INTO v_job_id, v_job_label, v_job_name
  FROM public.jobs_ledger j LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = (p->>'job_id')::uuid;
  IF v_job_id IS NULL THEN RAISE EXCEPTION 'dev_on_site_write: job % not found, or not one you can see', p->>'job_id'; END IF;
  IF NOT public.on_site_can_touch_job(v_job_id) THEN
    RAISE EXCEPTION 'dev_on_site_write: you cannot touch materials on job % — not yours to see and not on its team', v_job_label USING ERRCODE = '42501';
  END IF;

  -- When it happened: now, or a time given, never ahead.
  IF COALESCE(p->>'at', '') <> '' THEN
    BEGIN
      v_at := (p->>'at')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'dev_on_site_write: at must be an ISO timestamp with its offset (leave it out for now)';
    END;
    IF v_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'dev_on_site_write: at is in the future'; END IF;
    v_at_words := to_char(v_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  END IF;

  -- ── add_container ────────────────────────────────────────────────────────────────────────────
  IF v_action = 'add_container' THEN
    v_label := upper(regexp_replace(btrim(COALESCE(p->>'label', '')), '\s+', ' ', 'g'));
    v_kind := lower(btrim(COALESCE(p->>'kind', '')));
    v_where := btrim(COALESCE(p->>'where', ''));
    v_place_name := regexp_replace(btrim(COALESCE(p->>'place', '')), '\s+', ' ', 'g');
    IF length(v_label) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'dev_on_site_write: label is the stencil on the box (A1, B7), 1 to 24 characters'; END IF;
    IF v_kind NOT IN ('cage', 'box', 'loose') THEN RAISE EXCEPTION 'dev_on_site_write: kind must be cage, box or loose (Unsorted is the app''s own row — deliver into it instead)'; END IF;
    IF length(v_where) > 120 THEN RAISE EXCEPTION 'dev_on_site_write: keep where under 120 characters'; END IF;
    IF length(v_place_name) > 80 THEN RAISE EXCEPTION 'dev_on_site_write: keep place under 80 characters'; END IF;
    IF EXISTS (SELECT 1 FROM public.job_containers c WHERE c.job_id = v_job_id AND c.retired_at IS NULL AND lower(btrim(c.label)) = lower(v_label)) THEN
      RAISE EXCEPTION 'dev_on_site_write: % already has a live % on job % — pick another stencil or retire that one', v_label, 'container', v_job_label;
    END IF;
    IF v_place_name <> '' THEN
      SELECT id INTO v_place_id FROM public.job_places WHERE job_id = v_job_id AND lower(btrim(name)) = lower(v_place_name);
      v_place_is_new := v_place_id IS NULL;
    END IF;
    SELECT count(*) INTO v_container_rows FROM public.job_containers WHERE job_id = v_job_id AND retired_at IS NULL;
    v_after := jsonb_build_object('container', v_label, 'kind', v_kind, 'where', v_where, 'place', NULLIF(v_place_name, ''), 'place_is_new', v_place_is_new);
    IF NOT p_dry_run THEN
      IF v_place_is_new THEN
        INSERT INTO public.job_places (job_id, name, created_by) VALUES (v_job_id, v_place_name, auth.uid()) RETURNING id INTO v_place_id;
      END IF;
      INSERT INTO public.job_containers (job_id, label, kind, where_note, place_id, created_by)
      VALUES (v_job_id, v_label, v_kind, v_where, v_place_id, auth.uid())
      RETURNING id, code INTO v_id, v_code;
      v_ids := jsonb_build_array(v_id);
      v_after := v_after || jsonb_build_object('container_id', v_id, 'code', v_code, 'place_id', v_place_id);
    END IF;

  -- ── move_container ───────────────────────────────────────────────────────────────────────────
  ELSIF v_action = 'move_container' THEN
    v_container := public.dev_on_site_container(v_job_id, p->>'container');
    v_place_name := regexp_replace(btrim(COALESCE(p->>'place', '')), '\s+', ' ', 'g');
    IF length(v_place_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'dev_on_site_write: place is required — the place on the site the box moves to (Level 2, the laydown yard), under 80 characters'; END IF;
    IF v_container.kind = 'unsorted' THEN RAISE EXCEPTION 'dev_on_site_write: Unsorted is not a box that moves — move its lines into a box with action movement'; END IF;
    SELECT id INTO v_place_id FROM public.job_places WHERE job_id = v_job_id AND lower(btrim(name)) = lower(v_place_name);
    v_place_is_new := v_place_id IS NULL;
    IF v_place_id IS NOT NULL AND v_container.place_id = v_place_id THEN RAISE EXCEPTION 'dev_on_site_write: % is already at %', v_container.label, v_place_name; END IF;
    SELECT name INTO v_from_place FROM public.job_places WHERE id = v_container.place_id;
    SELECT count(*) INTO v_container_rows FROM public.job_container_moves WHERE container_id = v_container.id;
    v_after := jsonb_build_object('container', v_container.label, 'kind', v_container.kind, 'from_place', COALESCE(v_from_place, 'no place yet'), 'to_place', v_place_name, 'place_is_new', v_place_is_new);
    IF NOT p_dry_run THEN
      IF v_place_is_new THEN
        INSERT INTO public.job_places (job_id, name, created_by) VALUES (v_job_id, v_place_name, auth.uid()) RETURNING id INTO v_place_id;
      END IF;
      UPDATE public.job_containers SET place_id = v_place_id WHERE id = v_container.id;
      INSERT INTO public.job_container_moves (container_id, from_place_id, to_place_id, by_user_id, by_name, at)
      VALUES (v_container.id, v_container.place_id, v_place_id, auth.uid(), v_by_name, COALESCE(v_at, now()))
      RETURNING id INTO v_id;
      v_ids := jsonb_build_array(v_id);
      v_after := v_after || jsonb_build_object('container_id', v_container.id, 'place_id', v_place_id);
    END IF;

  -- ── retire_container ─────────────────────────────────────────────────────────────────────────
  ELSIF v_action = 'retire_container' THEN
    v_container := public.dev_on_site_container(v_job_id, p->>'container');
    IF v_container.kind = 'unsorted' THEN RAISE EXCEPTION 'dev_on_site_write: Unsorted is the app''s own row and is never retired'; END IF;
    -- What is still in it: the phone refuses a retire while any line has parts on hand.
    FOR v_part_id, v_part_name, v_manufacturer IN
      SELECT DISTINCT ON (COALESCE(m.part_id::text, lower(regexp_replace(btrim(m.part_name), '\s+', ' ', 'g')))) m.part_id, m.part_name, m.manufacturer
      FROM public.job_material_movements m
      WHERE m.from_container_id = v_container.id OR m.to_container_id = v_container.id
      ORDER BY COALESCE(m.part_id::text, lower(regexp_replace(btrim(m.part_name), '\s+', ' ', 'g'))), m.at DESC, m.id::text DESC
    LOOP
      v_on_hand := public.on_site_line_on_hand(v_container.id, v_part_id, v_part_name);
      IF v_on_hand > 0 THEN
        v_lines := v_lines || jsonb_build_object('part', v_part_name || CASE WHEN COALESCE(v_manufacturer, '') <> '' THEN ' · ' || v_manufacturer ELSE '' END, 'on_hand', v_on_hand);
      END IF;
    END LOOP;
    -- The phone's rule since v2.6041: a box with parts in it is not retired. Move them or mark them used first.
    IF jsonb_array_length(v_lines) > 0 THEN
      SELECT string_agg((l->>'part') || ' ' || (l->>'on_hand'), ', ') INTO v_note FROM jsonb_array_elements(v_lines) l;
      RAISE EXCEPTION 'dev_on_site_write: % still has parts in it. Move them or mark them used first, then retire it. In it: %', v_container.label, v_note;
    END IF;
    SELECT count(*) INTO v_container_rows FROM public.job_material_movements WHERE from_container_id = v_container.id OR to_container_id = v_container.id;
    v_after := jsonb_build_object('container', v_container.label, 'kind', v_container.kind,
      'note', format('The %s leaves this job. The next job gets its own %s. plan_container with action bring_back brings it back while no live box on the job carries the stencil.', CASE WHEN v_container.kind = 'cage' THEN 'cage' ELSE 'box' END, v_container.label));
    IF NOT p_dry_run THEN
      UPDATE public.job_containers SET retired_at = COALESCE(v_at, now()) WHERE id = v_container.id;
      v_ids := jsonb_build_array(v_container.id);
      v_after := v_after || jsonb_build_object('container_id', v_container.id);
    END IF;

  -- ── bring_back_container ─────────────────────────────────────────────────────────────────────
  -- v2.6406's Bring back, the way back from a retire: refused when the box is not on the job, is already
  -- live, or a live container on the job carries its stencil now — stencils compared without case or
  -- spaces, as src/lib/materials/unretire.ts (unretireVerdict) compares them. The ledger is untouched.
  ELSIF v_action = 'bring_back_container' THEN
    v_container_ref := btrim(COALESCE(p->>'container', ''));
    IF v_container_ref = '' THEN RAISE EXCEPTION 'dev_on_site_write: container is required — the retired box''s stencil (G4) or its id'; END IF;
    IF v_container_ref ~ '^[0-9a-fA-F-]{36}$' THEN
      SELECT * INTO v_container FROM public.job_containers WHERE id = v_container_ref::uuid AND job_id = v_job_id;
    ELSE
      SELECT * INTO v_container FROM public.job_containers
      WHERE job_id = v_job_id AND kind <> 'unsorted' AND retired_at IS NOT NULL
        AND lower(regexp_replace(label, '\s+', '', 'g')) = lower(regexp_replace(v_container_ref, '\s+', '', 'g'))
      ORDER BY retired_at DESC LIMIT 1;
      IF v_container.id IS NULL THEN
        SELECT * INTO v_container FROM public.job_containers
        WHERE job_id = v_job_id AND retired_at IS NULL
          AND lower(regexp_replace(label, '\s+', '', 'g')) = lower(regexp_replace(v_container_ref, '\s+', '', 'g'))
        ORDER BY created_at LIMIT 1;
      END IF;
    END IF;
    IF v_container.id IS NULL THEN RAISE EXCEPTION 'dev_on_site_write: That box is not on this job (%). read_on_site lists the retired ones.', v_container_ref; END IF;
    IF v_container.kind = 'unsorted' THEN RAISE EXCEPTION 'dev_on_site_write: Unsorted is the app''s own row and is never retired'; END IF;
    IF v_container.retired_at IS NULL THEN RAISE EXCEPTION 'dev_on_site_write: % is already on the job.', v_container.label; END IF;
    SELECT * INTO v_to FROM public.job_containers c
    WHERE c.job_id = v_job_id AND c.id <> v_container.id AND c.retired_at IS NULL
      AND lower(regexp_replace(c.label, '\s+', '', 'g')) = lower(regexp_replace(v_container.label, '\s+', '', 'g'))
    ORDER BY c.created_at LIMIT 1;
    IF v_to.id IS NOT NULL THEN
      RAISE EXCEPTION 'dev_on_site_write: A live % on this job already carries %. Retire it first, or give it another stencil.', CASE WHEN v_to.kind = 'cage' THEN 'cage' ELSE 'box' END, v_container.label;
    END IF;
    SELECT name INTO v_from_place FROM public.job_places WHERE id = v_container.place_id;
    SELECT count(*) INTO v_container_rows FROM public.job_containers WHERE job_id = v_job_id AND retired_at IS NULL;
    v_after := jsonb_build_object('container', v_container.label, 'kind', v_container.kind, 'place', v_from_place, 'retired_at', v_container.retired_at,
      'note', format('%s is back on the job. Its label works again.', v_container.label));
    IF NOT p_dry_run THEN
      UPDATE public.job_containers SET retired_at = NULL WHERE id = v_container.id;
      v_ids := jsonb_build_array(v_container.id);
      v_after := v_after || jsonb_build_object('container_id', v_container.id, 'code', v_container.code);
    END IF;

  -- ── delivery ─────────────────────────────────────────────────────────────────────────────────
  ELSIF v_action = 'delivery' THEN
    IF jsonb_typeof(p->'lines') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'dev_on_site_write: lines is required — 1 to 200 of { part_id | part_name, manufacturer?, quantity, unit? }';
    END IF;
    IF jsonb_array_length(p->'lines') NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'dev_on_site_write: lines takes 1 to 200 lines';
    END IF;
    v_source := NULLIF(btrim(COALESCE(p->>'source', '')), '');
    IF length(COALESCE(v_source, '')) > 120 THEN RAISE EXCEPTION 'dev_on_site_write: keep source under 120 characters (INV-10422, PO-2211)'; END IF;
    v_container_ref := btrim(COALESCE(p->>'to', ''));
    IF v_container_ref = '' OR lower(v_container_ref) = 'unsorted' THEN
      SELECT * INTO v_container FROM public.job_containers WHERE job_id = v_job_id AND kind = 'unsorted' AND retired_at IS NULL ORDER BY created_at LIMIT 1;
      v_place_is_new := v_container.id IS NULL; -- the Unsorted row is made on first use, as the office's Deliveries panel makes it
      IF v_place_is_new THEN v_container.label := 'Unsorted'; v_container.kind := 'unsorted'; END IF;
    ELSE
      v_container := public.dev_on_site_container(v_job_id, v_container_ref);
    END IF;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
      v_n := v_n + 1;
      SELECT q.part_id, q.part_name, q.manufacturer, q.quantity INTO v_part_id, v_part_name, v_manufacturer, v_quantity FROM public.dev_on_site_part(v_line, 'quantity', v_n) q;
      IF v_quantity < 1 THEN RAISE EXCEPTION 'dev_on_site_write: line % needs a quantity of at least 1', v_n; END IF;
      v_note := lower(btrim(COALESCE(v_line->>'unit', '')));
      IF length(v_note) > 40 THEN RAISE EXCEPTION 'dev_on_site_write: line %: keep unit under 40 characters', v_n; END IF;
      v_on_hand := CASE WHEN v_container.id IS NULL THEN 0 ELSE public.on_site_line_on_hand(v_container.id, v_part_id, v_part_name) END;
      v_lines := v_lines || jsonb_build_object('part', v_part_name, 'manufacturer', v_manufacturer, 'part_id', v_part_id, 'quantity', v_quantity, 'unit', NULLIF(v_note, ''), 'on_hand_before', v_on_hand, 'on_hand_after', v_on_hand + v_quantity);
    END LOOP;
    IF v_container.id IS NOT NULL THEN
      SELECT count(*) INTO v_container_rows FROM public.job_material_movements WHERE from_container_id = v_container.id OR to_container_id = v_container.id;
    END IF;
    v_after := jsonb_build_object('to', v_container.label, 'to_kind', v_container.kind, 'to_is_new', v_place_is_new, 'source', v_source, 'lines', v_lines, 'line_count', v_n);
    IF NOT p_dry_run THEN
      IF v_place_is_new THEN
        INSERT INTO public.job_containers (job_id, label, kind, where_note, created_by) VALUES (v_job_id, 'Unsorted', 'unsorted', '', auth.uid()) RETURNING * INTO v_container;
      END IF;
      FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
        INSERT INTO public.job_material_movements (job_id, part_id, part_name, manufacturer, quantity, reason, from_container_id, to_container_id, note, source, by_user_id, by_name, at)
        VALUES (v_job_id, NULLIF(v_line->>'part_id', '')::uuid, v_line->>'part', NULLIF(v_line->>'manufacturer', ''), (v_line->>'quantity')::integer, 'delivered', NULL, v_container.id, COALESCE(v_line->>'unit', ''), v_source, auth.uid(), v_by_name, COALESCE(v_at, now()))
        RETURNING id INTO v_id;
        v_ids := v_ids || jsonb_build_array(v_id);
      END LOOP;
      v_after := v_after || jsonb_build_object('container_id', v_container.id);
    END IF;

  -- ── movement ─────────────────────────────────────────────────────────────────────────────────
  ELSIF v_action = 'movement' THEN
    v_reason := lower(btrim(COALESCE(p->>'reason', '')));
    IF v_reason NOT IN ('moved', 'used', 'returned', 'taken', 'cannot_find', 'damaged') THEN
      RAISE EXCEPTION 'dev_on_site_write: reason must be moved, used, returned, taken, cannot_find or damaged (a delivery is action delivery; a count is action count)';
    END IF;
    v_container := public.dev_on_site_container(v_job_id, p->>'container');
    SELECT q.part_id, q.part_name, q.manufacturer, q.quantity INTO v_part_id, v_part_name, v_manufacturer, v_quantity FROM public.dev_on_site_part(p, 'quantity', 0) q;
    IF v_quantity < 1 THEN RAISE EXCEPTION 'dev_on_site_write: quantity must be at least 1'; END IF;
    v_note := btrim(COALESCE(p->>'note', ''));
    IF length(v_note) > 300 THEN RAISE EXCEPTION 'dev_on_site_write: keep note under 300 characters'; END IF;
    v_on_hand := public.on_site_line_on_hand(v_container.id, v_part_id, v_part_name);
    IF v_on_hand < 1 THEN RAISE EXCEPTION 'dev_on_site_write: % has none of % on its ledger — deliver it or move it there first, or count the box', v_container.label, v_part_name; END IF;
    IF v_quantity > v_on_hand THEN RAISE EXCEPTION 'dev_on_site_write: % has % of % — the phone caps the press at what is there; count the box first if more was there', v_container.label, v_on_hand, v_part_name; END IF;
    -- The part's book id and maker travel with the line as the ledger already has them.
    SELECT m.part_id, m.manufacturer INTO v_part_id, v_manufacturer FROM public.job_material_movements m
    WHERE (m.from_container_id = v_container.id OR m.to_container_id = v_container.id)
      AND CASE WHEN v_part_id IS NOT NULL THEN m.part_id = v_part_id ELSE m.part_id IS NULL AND lower(regexp_replace(btrim(m.part_name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(v_part_name), '\s+', ' ', 'g')) END
    ORDER BY m.at DESC, m.id::text DESC LIMIT 1;
    IF v_reason = 'moved' THEN
      IF btrim(COALESCE(p->>'to', '')) = '' THEN RAISE EXCEPTION 'dev_on_site_write: moved needs to — the box the parts go into (a label or an id)'; END IF;
      v_to := public.dev_on_site_container(v_job_id, p->>'to');
      IF v_to.id = v_container.id THEN RAISE EXCEPTION 'dev_on_site_write: to is the same box as container'; END IF;
      v_to_on_hand := public.on_site_line_on_hand(v_to.id, v_part_id, v_part_name);
    ELSIF btrim(COALESCE(p->>'to', '')) <> '' THEN
      RAISE EXCEPTION 'dev_on_site_write: to is for reason moved only — a taken part names where it went in note';
    END IF;
    IF v_reason = 'taken' AND v_note = '' THEN RAISE EXCEPTION 'dev_on_site_write: taken needs a note saying where it went (Mateo''s truck, the shop)'; END IF;
    SELECT count(*) INTO v_container_rows FROM public.job_material_movements WHERE from_container_id = v_container.id OR to_container_id = v_container.id;
    v_after := jsonb_build_object(
      'container', v_container.label, 'reason', v_reason, 'part', v_part_name, 'manufacturer', v_manufacturer, 'part_id', v_part_id, 'quantity', v_quantity, 'note', NULLIF(v_note, ''),
      'on_hand_before', v_on_hand, 'on_hand_after', v_on_hand - v_quantity,
      'to', CASE WHEN v_reason = 'moved' THEN v_to.label END, 'to_on_hand_before', CASE WHEN v_reason = 'moved' THEN v_to_on_hand END, 'to_on_hand_after', CASE WHEN v_reason = 'moved' THEN v_to_on_hand + v_quantity END,
      'press', CASE v_reason
        WHEN 'used' THEN format('Mark %s used', v_quantity)
        WHEN 'moved' THEN format('Move %s to %s', v_quantity, v_to.label)
        WHEN 'returned' THEN format('Send %s back', v_quantity)
        WHEN 'taken' THEN format('Take %s to %s', v_quantity, v_note)
        WHEN 'cannot_find' THEN format('Mark %s as can''t find', v_quantity)
        ELSE format('Mark %s damaged', v_quantity) END,
      'left', CASE WHEN v_on_hand - v_quantity <= 0 THEN format('%s will have none left.', v_container.label) ELSE format('%s will have %s left.', v_container.label, v_on_hand - v_quantity) END);
    IF NOT p_dry_run THEN
      INSERT INTO public.job_material_movements (job_id, part_id, part_name, manufacturer, quantity, reason, from_container_id, to_container_id, note, by_user_id, by_name, at)
      VALUES (v_job_id, v_part_id, v_part_name, v_manufacturer, v_quantity, v_reason, v_container.id, CASE WHEN v_reason = 'moved' THEN v_to.id END, v_note, auth.uid(), v_by_name, COALESCE(v_at, now()))
      RETURNING id INTO v_id;
      v_ids := jsonb_build_array(v_id);
      v_after := v_after || jsonb_build_object('container_id', v_container.id, 'to_container_id', CASE WHEN v_reason = 'moved' THEN v_to.id END);
    END IF;

  -- ── count ────────────────────────────────────────────────────────────────────────────────────
  ELSIF v_action = 'count' THEN
    v_container := public.dev_on_site_container(v_job_id, p->>'container');
    IF jsonb_typeof(p->'lines') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'dev_on_site_write: lines is required — 1 to 200 of { part_id | part_name, manufacturer?, counted }';
    END IF;
    IF jsonb_array_length(p->'lines') NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'dev_on_site_write: lines takes 1 to 200 lines';
    END IF;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
      v_n := v_n + 1;
      SELECT q.part_id, q.part_name, q.manufacturer, q.quantity INTO v_part_id, v_part_name, v_manufacturer, v_quantity FROM public.dev_on_site_part(v_line, 'counted', v_n) q;
      IF v_quantity < 0 THEN RAISE EXCEPTION 'dev_on_site_write: line %: counted is 0 or more', v_n; END IF;
      v_on_hand := public.on_site_line_on_hand(v_container.id, v_part_id, v_part_name);
      -- A line already in the box keeps its book id and maker; a new part may name its own.
      SELECT m.part_id, m.manufacturer INTO v_id, v_note FROM public.job_material_movements m
      WHERE (m.from_container_id = v_container.id OR m.to_container_id = v_container.id)
        AND CASE WHEN v_part_id IS NOT NULL THEN m.part_id = v_part_id ELSE m.part_id IS NULL AND lower(regexp_replace(btrim(m.part_name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(v_part_name), '\s+', ' ', 'g')) END
      ORDER BY m.at DESC, m.id::text DESC LIMIT 1;
      IF FOUND THEN v_part_id := COALESCE(v_part_id, v_id); v_manufacturer := COALESCE(v_manufacturer, v_note); END IF;
      v_lines := v_lines || jsonb_build_object('part', v_part_name, 'manufacturer', v_manufacturer, 'part_id', v_part_id, 'expected', v_on_hand, 'counted', v_quantity, 'diff', v_quantity - v_on_hand,
        'reads', CASE WHEN v_quantity = v_on_hand THEN 'counted right' WHEN v_quantity < v_on_hand THEN format('%s missing', v_on_hand - v_quantity) ELSE format('%s found', v_quantity - v_on_hand) END);
    END LOOP;
    SELECT count(*) INTO v_container_rows FROM public.job_material_movements WHERE from_container_id = v_container.id OR to_container_id = v_container.id;
    v_after := jsonb_build_object('container', v_container.label, 'kind', v_container.kind, 'lines', v_lines, 'line_count', v_n,
      'note', 'A count row resets each line to the number counted and keeps the difference; the office reads a shortfall as missing.');
    IF NOT p_dry_run THEN
      FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
        INSERT INTO public.job_material_movements (job_id, part_id, part_name, manufacturer, quantity, reason, from_container_id, to_container_id, note, by_user_id, by_name, at)
        VALUES (v_job_id, NULLIF(v_line->>'part_id', '')::uuid, v_line->>'part', NULLIF(v_line->>'manufacturer', ''), (v_line->>'counted')::integer, 'counted', v_container.id, NULL, '', auth.uid(), v_by_name, COALESCE(v_at, now()))
        RETURNING id INTO v_id;
        v_ids := v_ids || jsonb_build_array(v_id);
      END LOOP;
      v_after := v_after || jsonb_build_object('container_id', v_container.id);
    END IF;
  END IF;

  v_reply := jsonb_build_object(
    'ok', true,
    'dry_run', p_dry_run,
    'action', v_action,
    'job', jsonb_build_object('id', v_job_id, 'label', v_job_label, 'name', v_job_name),
    'after', v_after,
    'by', v_by_name,
    'at', v_at_words,
    'container_rows', v_container_rows
  );
  IF NOT p_dry_run THEN v_reply := v_reply || jsonb_build_object('ids', v_ids); END IF;
  RETURN v_reply;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dev_on_site_write(jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.dev_on_site_write(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_on_site_write(jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.dev_on_site_write(jsonb, boolean) IS 'Materials on site (#209): the dev seat''s write — plan (dry run) then apply, devs only, never a training account or a twin. Adds a container, moves, retires (an empty one) or brings one back, lands a delivery, presses a line (moved, used, returned, taken, cannot_find, damaged) or counts a box, as the screens do, under the caller''s own RLS. Rows are stamped "<agent_label> · MCP as <dev>".';
