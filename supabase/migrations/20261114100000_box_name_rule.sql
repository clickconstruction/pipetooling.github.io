SET lock_timeout = '3s';

-- Materials on site (punch list #351, PR 1, v2.7276): a box's name is letters and a number, one of a kind across the site.
--
-- job_containers.label was one free field of 1 to 24 characters, one live name a job (job_containers_live_label_key),
-- and nothing more. People typed what was inside into it (G76 TOILETS, MISL PILE OF JUNK PIPE), the phone's sheet
-- offered A1 whatever letter the site's steel was painted, and a development's boxes sit under several jobs, so one
-- site held a name twice. The owner's calls of 2026-11-14 (to-dos/box-names-and-what-is-inside/README.md): one to
-- three letters, a number from 1 to 999 with no zeros in front, one letter after the number allowed (G24B); one of a
-- kind across every job of the development, or the one job when the job is on no development; the next free name
-- offered from the letters most of the site's live boxes carry, one past the highest number any box, live or
-- retired, carries under them; old names stay until the office tidies them (PR 3).
--
-- This file makes no table, so no fence call is owed. CREATE OR REPLACE throughout; the trigger CREATE OR REPLACE
-- TRIGGER.
--
--   1. box_name_words(label)                  — null when the name holds to the rule, else why not, in the words every
--                                               screen and the seat say. The same regex as src/lib/materials/boxName.ts.
--      on_site_site_job_ids(job)              — the site's jobs: every job of the job's development, or the job alone.
--      on_site_next_box_name(jobs[], letters) — the next free name across those jobs: the letters most live boxes carry
--                                               (a tie to the newest box) unless letters are given, one past the highest
--                                               number any box, live or retired, carries under them; null with no named
--                                               box and no letters, or past 999. boxName.ts nextFreeName, in SQL.
--      job_containers_name_rule()             — BEFORE INSERT OR UPDATE OF label on job_containers, SECURITY DEFINER so
--                                               it reads the whole site: refuses a name off the rule, and a live name
--                                               another live box of the site carries, for every kind but unsorted. A
--                                               trigger and not a CHECK, and a label that does not change passes, so a
--                                               row with an old name is still moved, pinned, retired and brought back.
--   2. on_site_carry_job(from, to)            — restated whole from 20261114070000 (v2.7265) with one change: a live
--                                               cage or box whose name the target's site already holds takes the site's
--                                               next free name in place of `A1 (2)`, which is not a name under the rule
--                                               and would be refused by the trigger. The clash is read across the
--                                               target's site, as the rule is.
--   3. dev_on_site_write(p, dry_run)          — restated whole from 20261103143000 (v2.6456): add_container holds the
--                                               label to the rule and to the site in words, in the plan as in the apply.
--   4. dev_on_site_rename(p, dry_run)         — restated whole from 20261114050000 (v2.7241): edit_container's label
--                                               branch holds to the rule and to the site in words.
--
-- Order with the client: the client checks the same rule before the press, so either may land first. Push right after
-- the merge. Proved on a scratch Postgres 15 (stub tables) and by CI's on-site-move, on-site-guards and combine-rows
-- beds, whose fixtures with old names are inserted with the trigger off, as rows written before the rule were.

-- 1. The rule, the site, the next free name, the trigger.
CREATE OR REPLACE FUNCTION public.box_name_words(p_label text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_label text := upper(regexp_replace(btrim(COALESCE(p_label, '')), '\s+', ' ', 'g'));
BEGIN
  IF v_label = '' THEN RETURN 'Give it a name.'; END IF;
  IF v_label !~ '^[A-Z]{1,3}[1-9][0-9]{0,2}[A-Z]?$' THEN
    RETURN format('%s is not a name. A name is one to three letters and a number from 1 to 999, like R76.', v_label);
  END IF;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.box_name_words(text) IS 'Materials on site (#351): null when a box''s name holds to the rule (one to three letters, a number from 1 to 999 with no zeros in front, one letter after the number allowed: R7, AB12, G24B), else why not, in the words the screens say. The same regex as src/lib/materials/boxName.ts BOX_NAME_RULE.';
GRANT EXECUTE ON FUNCTION public.box_name_words(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.on_site_site_job_ids(p_job_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT j.id FROM public.jobs_ledger j
  WHERE j.id = p_job_id
     OR (j.development_id IS NOT NULL AND j.development_id = (SELECT d.development_id FROM public.jobs_ledger d WHERE d.id = p_job_id))
$fn$;
COMMENT ON FUNCTION public.on_site_site_job_ids(uuid) IS 'Materials on site (#351): the jobs of a job''s site — every job of its development, or the job alone when it is on none. Runs as the caller, so a direct caller reads the jobs their own RLS shows; the trigger and the carry run it as their owner.';
GRANT EXECUTE ON FUNCTION public.on_site_site_job_ids(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.on_site_next_box_name(p_job_ids uuid[], p_letters text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_letters text := NULLIF(upper(btrim(COALESCE(p_letters, ''))), '');
  v_top integer;
BEGIN
  IF v_letters IS NULL THEN
    -- The letters most live boxes on the site carry; a tie goes to the newest live box, what the crew is painting now.
    SELECT s.letters INTO v_letters
    FROM (
      SELECT substring(upper(btrim(c.label)) FROM '^([A-Z]{1,3})[1-9][0-9]{0,2}[A-Z]?$') AS letters, count(*) AS n, max(c.created_at) AS newest
      FROM public.job_containers c
      WHERE c.job_id = ANY (p_job_ids) AND c.retired_at IS NULL AND c.kind <> 'unsorted'
        AND upper(btrim(c.label)) ~ '^[A-Z]{1,3}[1-9][0-9]{0,2}[A-Z]?$'
      GROUP BY 1
    ) s
    ORDER BY s.n DESC, s.newest DESC, s.letters ASC
    LIMIT 1;
  END IF;
  IF v_letters IS NULL OR v_letters !~ '^[A-Z]{1,3}$' THEN RETURN NULL; END IF;
  -- One past the highest number any box, live or retired, carries under the letters: a retired box's number is never
  -- offered again, and a letter after a number (G24B) counts the number as taken, so G25 follows and G24 is never offered.
  SELECT COALESCE(max(substring(upper(btrim(c.label)) FROM '^[A-Z]{1,3}([1-9][0-9]{0,2})[A-Z]?$')::integer), 0) INTO v_top
  FROM public.job_containers c
  WHERE c.job_id = ANY (p_job_ids) AND c.kind <> 'unsorted'
    AND upper(btrim(c.label)) ~ ('^' || v_letters || '[1-9][0-9]{0,2}[A-Z]?$');
  IF v_top >= 999 THEN RETURN NULL; END IF;
  RETURN v_letters || (v_top + 1)::text;
END;
$fn$;
COMMENT ON FUNCTION public.on_site_next_box_name(uuid[], text) IS 'Materials on site (#351): the next free box name across the given jobs (a site''s, from on_site_site_job_ids) — the letters most live boxes carry unless given, one past the highest number any box, live or retired, carries under them; null with no named box and no letters, or past 999. src/lib/materials/boxName.ts nextFreeName, in SQL. Runs as the caller.';
GRANT EXECUTE ON FUNCTION public.on_site_next_box_name(uuid[], text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.job_containers_name_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_label text;
  v_words text;
  v_clash text;
BEGIN
  IF NEW.kind = 'unsorted' THEN RETURN NEW; END IF;
  -- An old name stays as it is: only a name that changes is judged, so a box named before the rule is still moved,
  -- pinned, retired and brought back, and only a rename or a new box meets the rule.
  IF TG_OP = 'UPDATE' AND NEW.label IS NOT DISTINCT FROM OLD.label THEN RETURN NEW; END IF;
  v_label := upper(regexp_replace(btrim(COALESCE(NEW.label, '')), '\s+', ' ', 'g'));
  v_words := public.box_name_words(v_label);
  IF v_words IS NOT NULL THEN
    RAISE EXCEPTION '%', v_words USING ERRCODE = '23514';
  END IF;
  IF NEW.retired_at IS NULL THEN
    -- One of a kind across the site: every job of the development, or the one job. Read as the owner, so a crew's
    -- phone that cannot read the job next door is still held to it.
    SELECT COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—')
      INTO v_clash
    FROM public.job_containers c
    JOIN public.jobs_ledger j ON j.id = c.job_id
    LEFT JOIN public.service_types st ON st.id = j.service_type_id
    WHERE c.id <> NEW.id AND c.retired_at IS NULL
      AND c.job_id IN (SELECT public.on_site_site_job_ids(NEW.job_id))
      AND lower(btrim(c.label)) = lower(v_label)
    ORDER BY c.job_id = NEW.job_id DESC, c.created_at
    LIMIT 1;
    IF v_clash IS NOT NULL THEN
      RAISE EXCEPTION '% is already on this site, on job %. Pick another name.', v_label, v_clash USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.label := v_label;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.job_containers_name_rule() IS 'Materials on site (#351): BEFORE INSERT OR UPDATE OF label on job_containers. For every kind but unsorted, a name that changes must hold to the rule (box_name_words) and be free across the site''s live boxes (on_site_site_job_ids); a label that does not change passes, so an old name is still moved, pinned, retired and brought back. SECURITY DEFINER, so the whole site is read. Refuses with 23514 and the screens'' own words.';
REVOKE EXECUTE ON FUNCTION public.job_containers_name_rule() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_containers_name_rule() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_containers_name_rule() FROM authenticated;

CREATE OR REPLACE TRIGGER job_containers_name_rule BEFORE INSERT OR UPDATE OF label ON public.job_containers
  FOR EACH ROW EXECUTE FUNCTION public.job_containers_name_rule();

-- 2. The carry, with the clash renamed to the site's next free name.
CREATE OR REPLACE FUNCTION public.on_site_carry_job(p_from uuid, p_to uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  r RECORD;
  v_label text;
  v_site_jobs uuid[];
  v_places_merged jsonb := '[]'::jsonb;
  v_labels jsonb := '[]'::jsonb;
  v_unsorted jsonb := NULL;
  v_places int := 0;
  v_containers int := 0;
  v_retired int := 0;
  v_movements int := 0;
  v_moves int := 0;
  v_photos int := 0;
  v_fold_movements int := 0;
  v_fold_moves int := 0;
  v_fold_photos int := 0;
  v_renames int := 0;
  v_runs int := 0;
  v_ties int := 0;
  v_prices int := 0;
  v_to_dev uuid;
  v_ties_dropped jsonb := '[]'::jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RAISE EXCEPTION 'on_site_carry_job: two different jobs are required';
  END IF;

  -- A box's own moves name no job: they go where their box goes. Counted before a fold re-points any.
  SELECT count(*) INTO v_moves
  FROM public.job_container_moves cm
  JOIN public.job_containers c ON c.id = cm.container_id
  WHERE c.job_id = p_from;
  SELECT count(*) INTO v_retired FROM public.job_containers WHERE job_id = p_from AND retired_at IS NOT NULL;

  -- A place the target already has under the same name takes the source's containers and moves, and the source's
  -- place goes.
  FOR r IN
    SELECT s.id AS src_id, t.id AS tgt_id, t.name AS tgt_name,
           (SELECT count(*) FROM public.job_containers c WHERE c.place_id = s.id) AS boxes
    FROM public.job_places s
    JOIN public.job_places t ON t.job_id = p_to AND lower(trim(t.name)) = lower(trim(s.name))
    WHERE s.job_id = p_from
    ORDER BY lower(trim(s.name)), s.id
  LOOP
    UPDATE public.job_containers SET place_id = r.tgt_id WHERE place_id = r.src_id;
    UPDATE public.job_container_moves SET from_place_id = r.tgt_id WHERE from_place_id = r.src_id;
    UPDATE public.job_container_moves SET to_place_id = r.tgt_id WHERE to_place_id = r.src_id;
    DELETE FROM public.job_places WHERE id = r.src_id;
    v_places_merged := v_places_merged || jsonb_build_object('name', r.tgt_name, 'containers', r.boxes);
  END LOOP;
  UPDATE public.job_places SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_places = ROW_COUNT;

  -- A container with the same live label: the job's Unsorted row is the catch-all, so the source's folds into the
  -- target's (its movements, moves and photos re-pointed); a cage or a box keeps its own row, since its code is
  -- printed on its label, and takes the next free name on the target's site instead (punch list #351: a name is one
  -- of a kind across the site, so the clash is read across the target's site, the source's own boxes counted too so
  -- two clashing boxes take two names). Unsorted folds only into the target job's own row.
  SELECT array_agg(DISTINCT s.id) INTO v_site_jobs FROM (SELECT public.on_site_site_job_ids(p_to) AS id UNION SELECT p_from) s;
  FOR r IN
    SELECT s.id AS src_id, s.kind, s.label, s.code, t.id AS tgt_id, t.kind AS tgt_kind, t.code AS tgt_code
    FROM public.job_containers s
    JOIN public.job_containers t
      ON t.job_id = ANY (v_site_jobs) AND t.job_id <> p_from AND t.retired_at IS NULL AND lower(trim(t.label)) = lower(trim(s.label))
     AND (s.kind <> 'unsorted' OR t.job_id = p_to)
    WHERE s.job_id = p_from AND s.retired_at IS NULL
    ORDER BY lower(trim(s.label)), s.id
  LOOP
    IF r.kind = 'unsorted' AND r.tgt_kind = 'unsorted' THEN
      SELECT count(*) INTO v_fold_movements FROM public.job_material_movements
        WHERE from_container_id = r.src_id OR to_container_id = r.src_id;
      UPDATE public.job_material_movements SET from_container_id = r.tgt_id WHERE from_container_id = r.src_id;
      UPDATE public.job_material_movements SET to_container_id = r.tgt_id WHERE to_container_id = r.src_id;
      UPDATE public.job_container_moves SET container_id = r.tgt_id WHERE container_id = r.src_id;
      GET DIAGNOSTICS v_fold_moves = ROW_COUNT;
      UPDATE public.job_box_photos SET container_id = r.tgt_id WHERE container_id = r.src_id;
      GET DIAGNOSTICS v_fold_photos = ROW_COUNT;
      DELETE FROM public.job_containers WHERE id = r.src_id;
      v_unsorted := jsonb_build_object('code', r.code, 'into_code', r.tgt_code,
        'movements', v_fold_movements, 'container_moves', v_fold_moves, 'photos', v_fold_photos);
    ELSE
      -- The site's letters and one past its highest number; a site with no named box yet starts at A1.
      v_label := COALESCE(public.on_site_next_box_name(v_site_jobs, NULL), public.on_site_next_box_name(v_site_jobs, 'A'));
      IF v_label IS NULL THEN
        RAISE EXCEPTION 'on_site_carry_job: no free name left on the target''s site for %', r.label;
      END IF;
      UPDATE public.job_containers SET label = v_label WHERE id = r.src_id;
      v_labels := v_labels || jsonb_build_object('code', r.code, 'kind', r.kind, 'from', r.label, 'to', v_label);
    END IF;
  END LOOP;
  UPDATE public.job_containers SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_containers = ROW_COUNT;
  UPDATE public.job_material_movements SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_movements = ROW_COUNT;
  UPDATE public.job_box_photos SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_photos = ROW_COUNT;

  -- The job's records that name no box (the tables of 2026-11-13). A rename names the ledger rows that just moved,
  -- so it takes the target job and an undo asked against the target finds it. A run printed for the source names
  -- the target, so its blank stickers are read by the target's team. A placed sticker, its events and a box's old
  -- names hang on their container and moved with it.
  UPDATE public.job_part_renames SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_renames = ROW_COUNT;
  UPDATE public.sticker_runs SET job_id = p_to WHERE job_id = p_from;
  GET DIAGNOSTICS v_runs = ROW_COUNT;

  -- A tie or a price scoped to the source job goes to the target's scope: the target job when it is on no site, the
  -- target's development when it is on one, since the site's screen is the one reader of a job on a site and the
  -- store prices a job's lines through its site. A pair both scopes answered keeps the newer answer (one answer per
  -- pair per scope); the older row goes, and the reply says which. A price is read newest first, so every price
  -- moves. A tie or a price scoped to the source's development is the site's, shared with every job on it, and
  -- stays where it is.
  SELECT j.development_id INTO v_to_dev FROM public.jobs_ledger j WHERE j.id = p_to;
  FOR r IN
    SELECT s.id AS src_id, s.at AS src_at, s.a_name, s.b_name, t.id AS tgt_id, t.at AS tgt_at
    FROM public.on_site_part_ties s
    JOIN public.on_site_part_ties t
      ON ((v_to_dev IS NULL AND t.job_id = p_to) OR (v_to_dev IS NOT NULL AND t.development_id = v_to_dev))
     AND LEAST(t.a_key, t.b_key) = LEAST(s.a_key, s.b_key)
     AND GREATEST(t.a_key, t.b_key) = GREATEST(s.a_key, s.b_key)
    WHERE s.job_id = p_from
    ORDER BY LEAST(s.a_key, s.b_key), GREATEST(s.a_key, s.b_key)
  LOOP
    IF r.src_at > r.tgt_at THEN
      DELETE FROM public.on_site_part_ties WHERE id = r.tgt_id;
      v_ties_dropped := v_ties_dropped || jsonb_build_object('a', r.a_name, 'b', r.b_name, 'kept', 'source');
    ELSE
      DELETE FROM public.on_site_part_ties WHERE id = r.src_id;
      v_ties_dropped := v_ties_dropped || jsonb_build_object('a', r.a_name, 'b', r.b_name, 'kept', 'target');
    END IF;
  END LOOP;
  IF v_to_dev IS NULL THEN
    UPDATE public.on_site_part_ties SET job_id = p_to WHERE job_id = p_from;
    GET DIAGNOSTICS v_ties = ROW_COUNT;
    UPDATE public.on_site_prices SET job_id = p_to WHERE job_id = p_from;
    GET DIAGNOSTICS v_prices = ROW_COUNT;
  ELSE
    UPDATE public.on_site_part_ties SET development_id = v_to_dev, job_id = NULL WHERE job_id = p_from;
    GET DIAGNOSTICS v_ties = ROW_COUNT;
    UPDATE public.on_site_prices SET development_id = v_to_dev, job_id = NULL WHERE job_id = p_from;
    GET DIAGNOSTICS v_prices = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'places', v_places,
    'places_merged', v_places_merged,
    'containers', v_containers,
    'retired_containers', v_retired,
    'unsorted_folded', v_unsorted,
    'labels_renamed', v_labels,
    'movements', v_movements,
    'container_moves', v_moves,
    'photos', v_photos,
    'part_renames', v_renames,
    'sticker_runs', v_runs,
    'ties', v_ties,
    'prices', v_prices,
    'ties_into', CASE WHEN v_to_dev IS NULL THEN 'job' ELSE 'site' END,
    'ties_dropped', v_ties_dropped
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.on_site_carry_job(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_site_carry_job(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_carry_job(uuid, uuid) FROM authenticated;

COMMENT ON FUNCTION public.on_site_carry_job(uuid, uuid) IS 'Materials on site (#209, v2.6808; v2.7265 the four tables of 2026-11-13; v2.7276 the name rule): one job''s places, containers, ledger, box moves, box photos, part renames and sticker runs carried to another job, and its job-scoped ties and prices to the target''s scope (the target job, or its development when it is on a site; a pair both scopes answered keeps the newer answer) — the rule both the whole-job combine and the dev seat''s move use. A same-name place becomes one, the source''s Unsorted folds into the target''s, a live name the target''s site already holds takes the site''s next free name (#351), every container keeps its id and code. Returns what it did. No gate of its own and no client grant: its callers are definers that gate first.';

-- 3. The seat's write, add_container held to the rule.
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
  v_words text;
  v_clash text;
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
    -- The name rule (punch list #351, box_name_words): letters and a number, one of a kind across the site.
    v_words := public.box_name_words(v_label);
    IF v_words IS NOT NULL THEN RAISE EXCEPTION 'dev_on_site_write: %', v_words; END IF;
    IF v_kind NOT IN ('cage', 'box', 'loose') THEN RAISE EXCEPTION 'dev_on_site_write: kind must be cage, box or loose (Unsorted is the app''s own row — deliver into it instead)'; END IF;
    IF length(v_where) > 120 THEN RAISE EXCEPTION 'dev_on_site_write: keep where under 120 characters'; END IF;
    IF length(v_place_name) > 80 THEN RAISE EXCEPTION 'dev_on_site_write: keep place under 80 characters'; END IF;
    IF EXISTS (SELECT 1 FROM public.job_containers c WHERE c.job_id = v_job_id AND c.retired_at IS NULL AND lower(btrim(c.label)) = lower(v_label)) THEN
      RAISE EXCEPTION 'dev_on_site_write: % is already a live box on job %. Pick another name, or retire that one first. The next free name on the site is %.', v_label, v_job_label, COALESCE(public.on_site_next_box_name(ARRAY(SELECT public.on_site_site_job_ids(v_job_id)), NULL), 'A1');
    END IF;
    SELECT c.label INTO v_clash FROM public.job_containers c
      WHERE c.job_id IN (SELECT public.on_site_site_job_ids(v_job_id)) AND c.job_id <> v_job_id AND c.retired_at IS NULL AND lower(btrim(c.label)) = lower(v_label) LIMIT 1;
    IF v_clash IS NOT NULL THEN
      RAISE EXCEPTION 'dev_on_site_write: % is already a live box on another job of this site. A name is one of a kind across the site. The next free name is %.', v_label, COALESCE(public.on_site_next_box_name(ARRAY(SELECT public.on_site_site_job_ids(v_job_id)), NULL), 'A1');
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

COMMENT ON FUNCTION public.dev_on_site_write(jsonb, boolean) IS 'Materials on site (#209): the dev seat''s write — plan (dry run) then apply, devs only, never a training account or a twin. Adds a container (its name held to the rule of #351: letters and a number, one of a kind across the site), moves, retires (an empty one) or brings one back, lands a delivery, presses a line (moved, used, returned, taken, cannot_find, damaged) or counts a box, as the screens do, under the caller''s own RLS. Rows are stamped "<agent_label> · MCP as <dev>".';

-- 4. The seat's renames, edit_container's name held to the rule.
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
  v_words text;
  v_clash text;
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
  -- a name on the rule of #351 in capitals that no other live box of the site carries, a kind of cage, box or
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
      -- The name rule (punch list #351, box_name_words): letters and a number, one of a kind across the site. A
      -- box's old name is never judged; only the name it is given here is.
      IF v_label <> v_container.label THEN
        v_words := public.box_name_words(v_label);
        IF v_words IS NOT NULL THEN RAISE EXCEPTION 'dev_on_site_rename: %', v_words; END IF;
        IF EXISTS (SELECT 1 FROM public.job_containers c WHERE c.job_id = v_job_id AND c.id <> v_container.id AND c.retired_at IS NULL AND lower(btrim(c.label)) = lower(v_label)) THEN
          RAISE EXCEPTION 'dev_on_site_rename: % is already a live box on job %. Pick another name, or retire that one first.', v_label, v_job_label;
        END IF;
        SELECT c.label INTO v_clash FROM public.job_containers c
          WHERE c.job_id IN (SELECT public.on_site_site_job_ids(v_job_id)) AND c.job_id <> v_job_id AND c.retired_at IS NULL AND lower(btrim(c.label)) = lower(v_label) LIMIT 1;
        IF v_clash IS NOT NULL THEN
          RAISE EXCEPTION 'dev_on_site_rename: % is already a live box on another job of this site. A name is one of a kind across the site.', v_label;
        END IF;
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

COMMENT ON FUNCTION public.dev_on_site_rename(jsonb, boolean) IS 'Materials on site: the dev seat''s renames — plan (dry run) then apply, devs only, never a training account or a twin, under the caller''s own RLS. edit_container changes a live box''s name (held to the rule of #351: letters and a number, one of a kind across the site), kind and where line by the Edit window''s rules; rename_part fixes a typed part''s name job wide by inserting a job_part_renames row, the plan naming every box and every merge; undo_part_rename puts it back. The records read "<agent_label> · MCP as <dev>".';
