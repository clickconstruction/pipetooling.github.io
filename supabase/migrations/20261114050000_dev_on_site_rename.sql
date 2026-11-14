SET lock_timeout = '3s';

-- Materials on site: the dev seat edits a box and fixes a part's typed name (the owner's yes, 2026-11-13).
--
-- The app does both since v2.7179 (Edit a box) and v2.7212 (Fix the name). The seat could add, move, retire and
-- bring back a box and write deliveries, presses and counts, and could do neither of these, so a site's names
-- could not be tidied through it. This adds the one function its two new verb pairs post:
--
--   1. on_site_by_name()              - the name a rename row carries: the seat's stamp inside the seat's own
--                                       transaction, the caller's own name everywhere else.
--   2. job_containers_keep_names()    - re-stated: the box's name history reads that name.
--      job_part_renames_judge()       - re-stated: the part rename's row reads that name.
--   3. on_site_typed_names_on_hand()  - what a box holds of several typed names read as one line, so a plan can
--                                       say what two lines become before they are merged.
--   4. dev_on_site_rename(p, dry_run) - the seat's write. SECURITY INVOKER, as dev_on_site_write is: the box is
--                                       updated and the rename row inserted under the dev's own RLS, and the
--                                       triggers the screens' writes fire do the rest. Three actions:
--                                         edit_container    a box's name, kind and where line
--                                         rename_part       a typed part's name, job wide (a job_part_renames row)
--                                         undo_part_rename  the old name back (a row naming the first, undo_of)
--
-- A new function and not two more actions in dev_on_site_write: that one is 350 lines the four working verbs
-- stand on, and re-stating it whole to add to it risks them for nothing.
--
-- No table is created, so no fence call closes this file.

-- 1. The name a rename row carries.
--    The seat's writes read "<agent> · MCP as <dev>" on every row they make. The two rename records are written
--    by triggers, which knew the caller's own name alone. dev_on_site_rename sets on_site.by_name for its own
--    transaction and clears it after the write; a trigger reads it here. It is honoured for a dev alone, and
--    by_user_id stays auth.uid() whatever it says.
CREATE OR REPLACE FUNCTION public.on_site_by_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN public.is_dev() AND btrim(COALESCE(current_setting('on_site.by_name', true), '')) <> ''
      THEN left(btrim(current_setting('on_site.by_name', true)), 120)
    ELSE public.box_sticker_caller_name()
  END
$fn$;
COMMENT ON FUNCTION public.on_site_by_name() IS 'Materials on site: the name a box rename or a part rename is kept under. The caller''s own name; inside dev_on_site_rename, for a dev, the seat''s stamp ("<agent> · MCP as <dev>") from the transaction''s on_site.by_name.';
REVOKE EXECUTE ON FUNCTION public.on_site_by_name() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_by_name() FROM anon;
GRANT EXECUTE ON FUNCTION public.on_site_by_name() TO authenticated, service_role;

-- 2a. The box's name history, re-stated from 20261113020000_box_stickers.sql with the one name changed.
CREATE OR REPLACE FUNCTION public.job_containers_keep_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.job_container_names (container_id, old_label, new_label, by_user_id, by_name)
  VALUES (NEW.id, OLD.label, NEW.label, auth.uid(), public.on_site_by_name());
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.job_containers_keep_names() IS 'Stickers before boxes (#329): AFTER UPDATE OF label on job_containers. Keeps the old name, the new name, who and when, for every client at once. The who is on_site_by_name(): the caller, or the dev seat''s stamp.';
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_names() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_names() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_names() FROM authenticated;

-- 2b. The part rename's judge, re-stated from 20261113230000_on_site_part_renames.sql with the one name changed.
CREATE OR REPLACE FUNCTION public.job_part_renames_judge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_old text;
  v_new text;
  v_ids uuid[];
  v_src public.job_part_renames%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to rename a part.' USING ERRCODE = '42501';
  END IF;
  IF NEW.undo_of IS NOT NULL THEN
    SELECT * INTO v_src FROM public.job_part_renames r WHERE r.id = NEW.undo_of AND r.job_id = NEW.job_id;
    IF NOT FOUND THEN
      v_old := '';
      v_new := '';
      v_ids := '{}';
    ELSE
      v_old := v_src.new_name;
      v_new := v_src.old_name;
      SELECT COALESCE(array_agg(m.id), '{}') INTO v_ids
      FROM public.job_material_movements m
      WHERE m.id = ANY (v_src.movement_ids) AND m.job_id = NEW.job_id AND m.part_id IS NULL AND m.part_name = v_src.new_name;
    END IF;
  ELSE
    v_old := btrim(regexp_replace(COALESCE(NEW.old_name, ''), '\s+', ' ', 'g'));
    v_new := btrim(regexp_replace(COALESCE(NEW.new_name, ''), '\s+', ' ', 'g'));
    IF v_new = '' THEN
      RAISE EXCEPTION 'Give the part a name.' USING ERRCODE = 'P0PRN';
    END IF;
    IF length(v_new) > 160 THEN
      RAISE EXCEPTION 'A part name holds 160 characters. This one is %.', length(v_new) USING ERRCODE = 'P0PRN';
    END IF;
    IF v_old = v_new THEN
      RAISE EXCEPTION 'That is the name it has.' USING ERRCODE = 'P0PRN';
    END IF;
    SELECT COALESCE(array_agg(m.id), '{}') INTO v_ids
    FROM public.job_material_movements m
    WHERE m.job_id = NEW.job_id AND m.part_id IS NULL
      AND lower(btrim(regexp_replace(m.part_name, '\s+', ' ', 'g'))) = lower(v_old);
  END IF;
  NEW.old_name := v_old;
  NEW.new_name := v_new;
  NEW.movement_ids := v_ids;
  NEW.row_count := COALESCE(cardinality(v_ids), 0);
  NEW.by_user_id := auth.uid();
  NEW.by_name := public.on_site_by_name();
  NEW.at := now();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.job_part_renames_judge() IS 'Materials on site: BEFORE INSERT on job_part_renames. Cleans the names, finds the job''s typed ledger rows that carry the old one (or, for an undo, the rows the named rename changed that still carry its new name) and fills the row. Writes nothing else. The who is on_site_by_name(): the caller, or the dev seat''s stamp.';
REVOKE EXECUTE ON FUNCTION public.job_part_renames_judge() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_part_renames_judge() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_part_renames_judge() FROM authenticated;

-- 3. Several typed names read as one line. The same arithmetic as on_site_line_on_hand (and as
--    src/lib/materials/onSite.ts containerLines): the newest count resets the line, and the rows after it add up.
--    A rename that lands on a name the box already holds makes the two lines one, and the one line's newest count
--    is the newer of the two, so the sum of the two is not always what it reads. A plan says which.
CREATE OR REPLACE FUNCTION public.on_site_typed_names_on_hand(p_container_id uuid, p_names text[])
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH names AS (
    SELECT lower(regexp_replace(btrim(n), '\s+', ' ', 'g')) AS k FROM unnest(COALESCE(p_names, '{}'::text[])) n
  ),
  line AS (
    SELECT m.id, m.at, m.quantity, m.reason, m.from_container_id, m.to_container_id
    FROM public.job_material_movements m
    WHERE (m.from_container_id = p_container_id OR m.to_container_id = p_container_id)
      AND m.part_id IS NULL
      AND lower(regexp_replace(btrim(m.part_name), '\s+', ' ', 'g')) IN (SELECT k FROM names)
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
COMMENT ON FUNCTION public.on_site_typed_names_on_hand(uuid, text[]) IS 'Materials on site: what a container holds of several typed part names read as one line, the arithmetic of on_site_line_on_hand. dev_on_site_rename''s dry run reads it to say what two lines become when a rename merges them. Runs as the caller.';
REVOKE ALL ON FUNCTION public.on_site_typed_names_on_hand(uuid, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_typed_names_on_hand(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_site_typed_names_on_hand(uuid, text[]) TO authenticated;

-- 4. The seat's write.
CREATE OR REPLACE FUNCTION public.dev_on_site_rename(p jsonb, p_dry_run boolean DEFAULT true)
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
  v_container public.job_containers%ROWTYPE;
  v_label text;
  v_kind text;
  v_where text;
  v_changes jsonb := '[]'::jsonb;
  v_old text;
  v_new text;
  v_old_kept text;
  v_ids uuid[] := '{}';
  v_rows integer := 0;
  v_already integer := 0;
  v_spelled jsonb := '[]'::jsonb;
  v_boxes jsonb := '[]'::jsonb;
  v_merges jsonb := '[]'::jsonb;
  v_box record;
  v_from_on_hand integer;
  v_to_on_hand integer;
  v_becomes integer;
  v_src public.job_part_renames%ROWTYPE;
  v_id uuid;
  v_n integer := 0;
  v_after jsonb;
  v_reply jsonb;
  v_out_ids jsonb := '[]'::jsonb;
BEGIN
  -- Who may write: a dev, with their own key, not in training mode, not a twin. As dev_on_site_write.
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_on_site_rename: devs only' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'dev_on_site_rename: a training account (read_only) cannot write materials on site' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'dev_on_site_rename: a digital twin cannot write materials on site' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(NULLIF(btrim(u.name), ''), u.email, 'the dev') INTO v_dev_name FROM public.users u WHERE u.id = auth.uid();

  IF v_action NOT IN ('edit_container', 'rename_part', 'undo_part_rename') THEN
    RAISE EXCEPTION 'dev_on_site_rename: action must be edit_container, rename_part or undo_part_rename';
  END IF;
  IF v_agent = '' THEN RAISE EXCEPTION 'dev_on_site_rename: agent_label is required — the robot''s name as the record will show it (the tidy robot)'; END IF;
  IF length(v_agent) > 80 THEN RAISE EXCEPTION 'dev_on_site_rename: keep agent_label under 80 characters'; END IF;
  v_by_name := left(v_agent || ' · MCP as ' || v_dev_name, 120);

  -- The job, under the caller's own RLS, then the screens' own gate. Named as the app names it (JP1085).
  IF COALESCE(p->>'job_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_on_site_rename: job_id is required (a jobs_ledger.id — find_job)';
  END IF;
  SELECT j.id, COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, '')
    INTO v_job_id, v_job_label, v_job_name
  FROM public.jobs_ledger j LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = (p->>'job_id')::uuid;
  IF v_job_id IS NULL THEN RAISE EXCEPTION 'dev_on_site_rename: job % not found, or not one you can see', p->>'job_id'; END IF;
  IF NOT public.on_site_can_touch_job(v_job_id) THEN
    RAISE EXCEPTION 'dev_on_site_rename: you cannot touch materials on job % — not yours to see and not on its team', v_job_label USING ERRCODE = '42501';
  END IF;

  -- ── edit_container ───────────────────────────────────────────────────────────────────────────
  -- The Edit window's own rules (src/lib/materials/editBox.ts editBoxVerdict): a live box that is not Unsorted,
  -- a name of 1 to 24 characters in capitals that no other live box of the job carries, a kind of cage, box or
  -- loose, a where line of 120 at most, and at least one of them changed. A key left out stays as it is; where
  -- sent empty clears the line.
  IF v_action = 'edit_container' THEN
    v_container := public.dev_on_site_container(v_job_id, p->>'container');
    IF v_container.kind = 'unsorted' THEN RAISE EXCEPTION 'dev_on_site_rename: Unsorted is the app''s own row. It cannot be changed.'; END IF;
    v_label := v_container.label;
    v_kind := v_container.kind;
    v_where := COALESCE(v_container.where_note, '');
    IF p ? 'label' THEN
      v_label := upper(regexp_replace(btrim(COALESCE(p->>'label', '')), '\s+', ' ', 'g'));
      IF length(v_label) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'dev_on_site_rename: label is the name on the box (A1, B7), 1 to 24 characters. This one is %.', length(v_label); END IF;
      IF EXISTS (SELECT 1 FROM public.job_containers c WHERE c.job_id = v_job_id AND c.id <> v_container.id AND c.retired_at IS NULL AND lower(btrim(c.label)) = lower(v_label)) THEN
        RAISE EXCEPTION 'dev_on_site_rename: % is already a live box on job %. Pick another name, or retire that one first.', v_label, v_job_label;
      END IF;
    END IF;
    IF p ? 'kind' THEN
      v_kind := lower(btrim(COALESCE(p->>'kind', '')));
      IF v_kind NOT IN ('cage', 'box', 'loose') THEN RAISE EXCEPTION 'dev_on_site_rename: kind must be cage, box or loose (a pallet, or a thing too big for a box, is loose)'; END IF;
    END IF;
    IF p ? 'where' THEN
      v_where := regexp_replace(btrim(COALESCE(p->>'where', '')), '\s+', ' ', 'g');
      IF length(v_where) > 120 THEN RAISE EXCEPTION 'dev_on_site_rename: the where line holds 120 characters. This one is %.', length(v_where); END IF;
    END IF;
    IF v_label <> v_container.label THEN v_changes := v_changes || jsonb_build_object('field', 'label', 'before', v_container.label, 'after', v_label); END IF;
    IF v_kind <> v_container.kind THEN v_changes := v_changes || jsonb_build_object('field', 'kind', 'before', v_container.kind, 'after', v_kind); END IF;
    IF v_where <> COALESCE(v_container.where_note, '') THEN v_changes := v_changes || jsonb_build_object('field', 'where', 'before', COALESCE(v_container.where_note, ''), 'after', v_where); END IF;
    IF jsonb_array_length(v_changes) = 0 THEN
      RAISE EXCEPTION 'dev_on_site_rename: nothing to change. % already reads that way.', v_container.label;
    END IF;
    v_after := jsonb_build_object(
      'container', v_container.label, 'container_id', v_container.id, 'code', v_container.code,
      'changes', v_changes,
      'reads_after', jsonb_build_object('label', v_label, 'kind', v_kind, 'where', v_where),
      'note', CASE WHEN v_label <> v_container.label
        THEN format('A label printed as %s still opens this box: its code is cut from the box''s id, never from its name. Only the words on the tape are old until it is printed again. The box''s history keeps the old name, the new one, who and when.', v_container.label)
        ELSE 'The name and the printed label stay as they are.' END);
    IF NOT p_dry_run THEN
      PERFORM set_config('on_site.by_name', v_by_name, true);
      UPDATE public.job_containers SET label = v_label, kind = v_kind, where_note = v_where WHERE id = v_container.id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      PERFORM set_config('on_site.by_name', '', true);
      IF v_n = 0 THEN
        RAISE EXCEPTION 'dev_on_site_rename: % was not changed — it is not yours to change on job %', v_container.label, v_job_label USING ERRCODE = '42501';
      END IF;
      v_out_ids := jsonb_build_array(v_container.id);
    END IF;

  -- ── rename_part ──────────────────────────────────────────────────────────────────────────────
  -- Fix the name's own rules (src/lib/materials/partRename.ts, job_part_renames_judge): a typed name alone, job
  -- wide, matched without case or doubled spaces. The plan names every spelling the rows carry now, every box
  -- that holds the line and, where the new name is already a line in one of them, what the two become.
  ELSIF v_action = 'rename_part' THEN
    v_old := btrim(regexp_replace(COALESCE(p->>'from', ''), '\s+', ' ', 'g'));
    v_new := btrim(regexp_replace(COALESCE(p->>'to', ''), '\s+', ' ', 'g'));
    IF v_old = '' THEN RAISE EXCEPTION 'dev_on_site_rename: from is required — the typed name as read_on_site lists it'; END IF;
    IF v_new = '' THEN RAISE EXCEPTION 'dev_on_site_rename: to is required — the name the line should carry'; END IF;
    IF length(v_new) > 160 THEN RAISE EXCEPTION 'dev_on_site_rename: a part name holds 160 characters. This one is %.', length(v_new); END IF;
    IF v_old = v_new THEN RAISE EXCEPTION 'dev_on_site_rename: from and to are the same name'; END IF;
    SELECT COALESCE(array_agg(m.id), '{}'), count(*)::integer, (count(*) FILTER (WHERE m.part_name = v_new))::integer
      INTO v_ids, v_rows, v_already
    FROM public.job_material_movements m
    WHERE m.job_id = v_job_id AND m.part_id IS NULL
      AND lower(btrim(regexp_replace(m.part_name, '\s+', ' ', 'g'))) = lower(v_old);
    IF v_rows = 0 THEN
      IF EXISTS (SELECT 1 FROM public.job_material_movements m WHERE m.job_id = v_job_id AND m.part_id IS NOT NULL AND lower(btrim(regexp_replace(m.part_name, '\s+', ' ', 'g'))) = lower(v_old)) THEN
        RAISE EXCEPTION 'dev_on_site_rename: % is a part from the parts book on job %. Its name is the book''s: change it in the parts book.', v_old, v_job_label;
      END IF;
      RAISE EXCEPTION 'dev_on_site_rename: no typed part named % on job % — read_on_site lists the lines as they are spelled', v_old, v_job_label;
    END IF;
    IF v_already = v_rows THEN
      RAISE EXCEPTION 'dev_on_site_rename: every line of that part on job % already reads %', v_job_label, v_new;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s.part_name, 'rows', s.n) ORDER BY s.n DESC, s.part_name), '[]'::jsonb) INTO v_spelled
    FROM (SELECT m.part_name, count(*)::integer AS n FROM public.job_material_movements m WHERE m.id = ANY (v_ids) GROUP BY m.part_name) s;
    -- The old name the record keeps, and so the name an undo puts back: the spelling most of the rows carry, not
    -- the caller's own typing of it. from matches without case, so "pex rolls red" finds "Pex rolls red".
    SELECT btrim(regexp_replace(s.part_name, '\s+', ' ', 'g')) INTO v_old_kept
    FROM (SELECT m.part_name, count(*) AS n FROM public.job_material_movements m WHERE m.id = ANY (v_ids) GROUP BY m.part_name) s
    WHERE btrim(regexp_replace(s.part_name, '\s+', ' ', 'g')) <> v_new
    ORDER BY s.n DESC, s.part_name
    LIMIT 1;
    v_old_kept := COALESCE(v_old_kept, v_old);
    SELECT COALESCE(jsonb_agg(b.words ORDER BY b.label, b.id::text), '[]'::jsonb) INTO v_boxes
    FROM (
      SELECT DISTINCT c.id, c.label, c.label || CASE WHEN c.retired_at IS NOT NULL THEN ' (retired)' ELSE '' END AS words
      FROM public.job_material_movements m
      JOIN public.job_containers c ON c.id IN (m.from_container_id, m.to_container_id)
      WHERE m.id = ANY (v_ids)
    ) b;
    IF lower(v_new) <> lower(v_old) THEN
      FOR v_box IN
        SELECT DISTINCT c.id, c.label
        FROM public.job_material_movements m
        JOIN public.job_containers c ON c.id IN (m.from_container_id, m.to_container_id)
        WHERE m.id = ANY (v_ids)
          AND EXISTS (
            SELECT 1 FROM public.job_material_movements o
            WHERE o.job_id = v_job_id AND o.part_id IS NULL
              AND lower(btrim(regexp_replace(o.part_name, '\s+', ' ', 'g'))) = lower(v_new)
              AND c.id IN (o.from_container_id, o.to_container_id))
        ORDER BY c.label, c.id
      LOOP
        v_from_on_hand := public.on_site_line_on_hand(v_box.id, NULL::uuid, v_old);
        v_to_on_hand := public.on_site_line_on_hand(v_box.id, NULL::uuid, v_new);
        v_becomes := public.on_site_typed_names_on_hand(v_box.id, ARRAY[v_old, v_new]);
        v_merges := v_merges || jsonb_build_object('box', v_box.label, 'from_on_hand', v_from_on_hand, 'to_on_hand', v_to_on_hand, 'becomes', v_becomes,
          'reads', CASE WHEN v_becomes = v_from_on_hand + v_to_on_hand
            THEN format('%s already has a line named %s. The two become one line of %s.', v_box.label, v_new, v_becomes)
            ELSE format('%s already has a line named %s. The two become one line of %s, not %s: the newer count of the two resets the line.', v_box.label, v_new, v_becomes, v_from_on_hand + v_to_on_hand) END);
      END LOOP;
    END IF;
    v_after := jsonb_build_object(
      'from', v_old, 'to', v_new, 'rows', v_rows, 'spelled_now', v_spelled, 'undo_restores', v_old_kept, 'boxes', v_boxes, 'merges', v_merges,
      'note', format('The name changes on every typed line of this job that carries it, in every box: a part moved between two boxes is one ledger row both read. No quantity, count, box or time changes. apply replies with a rename_id, and plan_part_rename with undo: that id puts %s back on the rows this changed%s.', v_old_kept,
        CASE WHEN jsonb_array_length(v_spelled) > 1 THEN ', one name for all of them and not each row''s own spelling' ELSE '' END));
    IF NOT p_dry_run THEN
      PERFORM set_config('on_site.by_name', v_by_name, true);
      INSERT INTO public.job_part_renames (job_id, old_name, new_name) VALUES (v_job_id, v_old_kept, v_new) RETURNING id, row_count INTO v_id, v_n;
      PERFORM set_config('on_site.by_name', '', true);
      v_out_ids := jsonb_build_array(v_id);
      v_after := v_after || jsonb_build_object('rename_id', v_id, 'rows_changed', v_n);
    END IF;

  -- ── undo_part_rename ─────────────────────────────────────────────────────────────────────────
  -- A second row that names the first. It puts the old name back on the rows the first one changed that still
  -- carry its new name, so a line the rename merged into comes apart again. Each rename is undone once.
  ELSE
    IF COALESCE(p->>'rename_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_on_site_rename: rename_id is required — the id apply_part_rename replied with (read_rows on job_part_renames by job_id lists a job''s renames)';
    END IF;
    SELECT * INTO v_src FROM public.job_part_renames r WHERE r.id = (p->>'rename_id')::uuid AND r.job_id = v_job_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_on_site_rename: no rename % on job %', p->>'rename_id', v_job_label; END IF;
    IF EXISTS (SELECT 1 FROM public.job_part_renames u WHERE u.undo_of = v_src.id) THEN
      RAISE EXCEPTION 'dev_on_site_rename: that rename was already undone. To change the name again, plan a new rename.';
    END IF;
    SELECT COALESCE(array_agg(m.id), '{}'), count(*)::integer INTO v_ids, v_rows
    FROM public.job_material_movements m
    WHERE m.id = ANY (v_src.movement_ids) AND m.job_id = v_job_id AND m.part_id IS NULL AND m.part_name = v_src.new_name;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'dev_on_site_rename: nothing is left to undo. The part was renamed again since.';
    END IF;
    SELECT COALESCE(jsonb_agg(b.words ORDER BY b.label, b.id::text), '[]'::jsonb) INTO v_boxes
    FROM (
      SELECT DISTINCT c.id, c.label, c.label || CASE WHEN c.retired_at IS NOT NULL THEN ' (retired)' ELSE '' END AS words
      FROM public.job_material_movements m
      JOIN public.job_containers c ON c.id IN (m.from_container_id, m.to_container_id)
      WHERE m.id = ANY (v_ids)
    ) b;
    v_after := jsonb_build_object(
      'undo_of', v_src.id, 'from', v_src.new_name, 'to', v_src.old_name,
      'rows', v_rows, 'rows_first_changed', v_src.row_count, 'boxes', v_boxes,
      'renamed_by', v_src.by_name, 'renamed_at', to_char(v_src.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'note', CASE WHEN v_rows < v_src.row_count
        THEN format('%s of the %s rows that rename changed still carry its name. The rest were renamed again since and stay as they are.', v_rows, v_src.row_count)
        ELSE 'Every row that rename changed gets the old name back. A line it merged into keeps its own rows.' END);
    IF NOT p_dry_run THEN
      PERFORM set_config('on_site.by_name', v_by_name, true);
      INSERT INTO public.job_part_renames (job_id, undo_of) VALUES (v_job_id, v_src.id) RETURNING id, row_count INTO v_id, v_n;
      PERFORM set_config('on_site.by_name', '', true);
      v_out_ids := jsonb_build_array(v_id);
      v_after := v_after || jsonb_build_object('rename_id', v_id, 'rows_changed', v_n);
    END IF;
  END IF;

  v_reply := jsonb_build_object(
    'ok', true,
    'dry_run', p_dry_run,
    'action', v_action,
    'job', jsonb_build_object('id', v_job_id, 'label', v_job_label, 'name', v_job_name),
    'after', v_after,
    'by', v_by_name
  );
  IF NOT p_dry_run THEN v_reply := v_reply || jsonb_build_object('ids', v_out_ids); END IF;
  RETURN v_reply;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dev_on_site_rename(jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.dev_on_site_rename(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_on_site_rename(jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.dev_on_site_rename(jsonb, boolean) IS 'Materials on site: the dev seat''s renames — plan (dry run) then apply, devs only, never a training account or a twin, under the caller''s own RLS. edit_container changes a live box''s name, kind and where line by the Edit window''s rules; rename_part fixes a typed part''s name job wide by inserting a job_part_renames row, the plan naming every box and every merge; undo_part_rename puts it back. The records read "<agent_label> · MCP as <dev>".';
