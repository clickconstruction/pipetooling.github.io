SET lock_timeout = '3s';

-- Materials on site (punch list #209, v2.7265): a move or a combine leaves nothing of a job's on-site records behind.
--
-- on_site_carry_job (20261109160000) carries a job's places, cages and boxes, ledger, box moves and photos to another
-- job; the whole-job combine and the dev seat's move both call it. It was written before the tables of 2026-11-13,
-- and a read of the code on 2026-11-14 found that a move or a combine left those rows on the source job:
--
--   * job_part_renames (20261113230000) names the job's typed ledger rows, which moved. A rename left on the source
--     fails the judge's job_id match when its undo is asked against the target, so a name fixed on the wrong job
--     could never be put back.
--   * on_site_part_ties (20261113040000) and on_site_prices (20261113160000) scoped to one job on no site were
--     stranded on the source — and a combine deletes the source, so its answers went with it (ON DELETE CASCADE).
--   * sticker_runs (20261113020000) printed for the source kept naming it, so its blank stickers were read by the
--     old job's team, or lost their job when a combine deleted it (ON DELETE SET NULL).
--
-- This file restates three functions. CREATE OR REPLACE throughout; no table, column, index, policy or trigger is
-- made, so no fence call is owed and nothing waits on a table lock.
--
--   1. on_site_carry_job(from, to)       — the same body with four tables more, after the photos:
--                                            - job_part_renames and sticker_runs take the target job;
--                                            - a tie or a price scoped to the source job goes to the target's scope:
--                                              the target job when it is on no site, else the target's development,
--                                              since the site's screen is the one reader of a job on a site. A pair
--                                              both scopes answered keeps the newer answer; the older row goes.
--                                            A tie or a price scoped to the source's development is the site's,
--                                            shared with every job on it, and stays. The reply gains part_renames,
--                                            sticker_runs, ties, prices, ties_into ('job' | 'site') and
--                                            ties_dropped [{ a, b, kept }].
--   2. on_site_job_counts(job)           — the four tables counted on the job (job-scoped ties and prices), and the
--                                            job's site's ties and prices (site_ties, site_prices), so a plan can
--                                            hold the fold into a site to the same arithmetic.
--   3. dev_on_site_move_job(p, p_dry_run) — the refusal of a source with nothing on site reads the four tables too;
--                                            the add-up check holds every one of them (the source ends empty of all
--                                            four; the target holds both jobs' renames and runs; the ties and prices
--                                            land on the target job or on its site, less the answers a pair lost);
--                                            the words, the plan's `moved` and the note on both jobs name them, and
--                                            the reply gains `ties` { into, dropped, words }.
--
-- The combine (migrate_job_ledger_costs_and_delete) is not restated: it calls the carry and gets the four tables
-- with it. Every row keeps its id; only the scope it sits under changes. on_site_part_ties and on_site_prices are
-- insert-and-delete tables for every client; this is their one update, made by the carry alone, as the ledger's
-- job_id is.

-- 1. The carry, with the four tables of 2026-11-13.
CREATE OR REPLACE FUNCTION public.on_site_carry_job(p_from uuid, p_to uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  r RECORD;
  v_n int;
  v_suffix text;
  v_label text;
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
  -- printed on its label, and takes a numbered label instead.
  FOR r IN
    SELECT s.id AS src_id, s.kind, s.label, s.code, t.id AS tgt_id, t.kind AS tgt_kind, t.code AS tgt_code
    FROM public.job_containers s
    JOIN public.job_containers t
      ON t.job_id = p_to AND t.retired_at IS NULL AND lower(trim(t.label)) = lower(trim(s.label))
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
      v_n := 2;
      LOOP
        v_suffix := ' (' || v_n || ')';
        v_label := left(trim(r.label), 24 - length(v_suffix)) || v_suffix;
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.job_containers c
          WHERE c.job_id IN (p_from, p_to) AND c.retired_at IS NULL AND lower(trim(c.label)) = lower(trim(v_label))
        );
        v_n := v_n + 1;
        IF v_n > 99 THEN
          RAISE EXCEPTION 'on_site_carry_job: no free numbered label left for %', r.label;
        END IF;
      END LOOP;
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

COMMENT ON FUNCTION public.on_site_carry_job(uuid, uuid) IS 'Materials on site (#209, v2.6808; v2.7265 the four tables of 2026-11-13): one job''s places, containers, ledger, box moves, box photos, part renames and sticker runs carried to another job, and its job-scoped ties and prices to the target''s scope (the target job, or its development when it is on a site; a pair both scopes answered keeps the newer answer) — the rule both the whole-job combine and the dev seat''s move use. A same-name place becomes one, the source''s Unsorted folds into the target''s, a live label the target already holds takes a numbered label, every container keeps its id and code. Returns what it did. No gate of its own and no client grant: its callers are definers that gate first.';

-- 2. A job's on-site rows, counted, with the four tables and the job's site's ties and prices.
CREATE OR REPLACE FUNCTION public.on_site_job_counts(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'places', (SELECT count(*) FROM public.job_places WHERE job_id = p_job_id),
    'containers', (SELECT count(*) FROM public.job_containers WHERE job_id = p_job_id),
    'retired_containers', (SELECT count(*) FROM public.job_containers WHERE job_id = p_job_id AND retired_at IS NOT NULL),
    'movements', (SELECT count(*) FROM public.job_material_movements WHERE job_id = p_job_id),
    'container_moves', (SELECT count(*) FROM public.job_container_moves cm JOIN public.job_containers c ON c.id = cm.container_id WHERE c.job_id = p_job_id),
    'photos', (SELECT count(*) FROM public.job_box_photos WHERE job_id = p_job_id),
    'part_renames', (SELECT count(*) FROM public.job_part_renames WHERE job_id = p_job_id),
    'sticker_runs', (SELECT count(*) FROM public.sticker_runs WHERE job_id = p_job_id),
    'ties', (SELECT count(*) FROM public.on_site_part_ties WHERE job_id = p_job_id),
    'prices', (SELECT count(*) FROM public.on_site_prices WHERE job_id = p_job_id),
    'site_ties', (SELECT count(*) FROM public.on_site_part_ties t WHERE t.development_id IS NOT NULL AND t.development_id = d.development_id),
    'site_prices', (SELECT count(*) FROM public.on_site_prices x WHERE x.development_id IS NOT NULL AND x.development_id = d.development_id),
    'lines_on_hand', (SELECT count(*) FROM jsonb_array_elements(s.summary->'lines') l WHERE (l->>'on_hand')::int <> 0),
    'parts_on_hand', (SELECT COALESCE(sum((l->>'on_hand')::int), 0) FROM jsonb_array_elements(s.summary->'lines') l)
  )
  FROM (SELECT public.on_site_job_summary(p_job_id) AS summary) s,
       (SELECT j.development_id FROM public.jobs_ledger j WHERE j.id = p_job_id) d
$fn$;

REVOKE ALL ON FUNCTION public.on_site_job_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_site_job_counts(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.on_site_job_counts(uuid) TO authenticated;

COMMENT ON FUNCTION public.on_site_job_counts(uuid) IS 'Materials on site (#209, v2.6808; v2.7265 the four tables): a job''s on-site rows counted — places, containers (and the retired among them), ledger rows, box moves, photos, part renames, sticker runs, the job-scoped ties and prices, and its site''s ties and prices (site_ties, site_prices; 0 for a job on no site) — with the lines and parts on hand from on_site_job_summary. The figures a move''s plan commits to on both jobs. Runs as the caller.';

-- 3. The dev seat's move: the refusal, the add-up check, the words and the note name the four tables.
CREATE OR REPLACE FUNCTION public.dev_on_site_move_job(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from uuid;
  v_to uuid;
  v_from_label text;
  v_from_name text;
  v_to_label text;
  v_to_name text;
  v_to_site text;
  v_dev_name text;
  v_before_from jsonb;
  v_before_to jsonb;
  v_after_from jsonb;
  v_after_to jsonb;
  v_carried jsonb;
  v_folded int := 0;
  v_dropped int := 0;
  v_photos_in_drive int := 0;
  v_photos_waiting int := 0;
  v_photo_words text;
  v_ties_words text;
  v_what text;
  v_holds boolean;
  v_note_from text;
  v_note_to text;
  v_key text;
  v_out jsonb;
BEGIN
  -- Who may move: a dev, with their own key, not in training mode, not a twin.
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_on_site_move_job: devs only' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'dev_on_site_move_job: a training account (read_only) cannot move materials on site' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'dev_on_site_move_job: a digital twin cannot move materials on site' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(NULLIF(btrim(u.name), ''), u.email, 'the dev') INTO v_dev_name FROM public.users u WHERE u.id = auth.uid();

  IF COALESCE(p->>'from_job', '') !~ '^[0-9a-fA-F-]{36}$' OR COALESCE(p->>'to_job', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_on_site_move_job: from_job and to_job are required (each a jobs_ledger.id — find_job)';
  END IF;
  v_from := (p->>'from_job')::uuid;
  v_to := (p->>'to_job')::uuid;
  IF v_from = v_to THEN
    RAISE EXCEPTION 'dev_on_site_move_job: from_job and to_job are the same job — nothing to move';
  END IF;

  -- Each job as the app names it (JP972): the service type's job prefix, else J, then the HCP number, else the Click
  -- number — src/lib/ledgerDisplayPrefixes.ts formatJobLedgerNumberLabel, as dev_on_site_write names a job.
  SELECT COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, '')
    INTO v_from_label, v_from_name
  FROM public.jobs_ledger j LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = v_from;
  IF v_from_label IS NULL THEN RAISE EXCEPTION 'dev_on_site_move_job: from_job % not found', v_from; END IF;
  SELECT COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, ''), d.name
    INTO v_to_label, v_to_name, v_to_site
  FROM public.jobs_ledger j
  LEFT JOIN public.service_types st ON st.id = j.service_type_id
  LEFT JOIN public.developments d ON d.id = j.development_id
  WHERE j.id = v_to;
  IF v_to_label IS NULL THEN RAISE EXCEPTION 'dev_on_site_move_job: to_job % not found', v_to; END IF;

  v_before_from := public.on_site_job_counts(v_from);
  v_before_to := public.on_site_job_counts(v_to);
  IF (v_before_from->>'places')::int = 0 AND (v_before_from->>'containers')::int = 0
     AND (v_before_from->>'movements')::int = 0 AND (v_before_from->>'photos')::int = 0
     AND (v_before_from->>'part_renames')::int = 0 AND (v_before_from->>'sticker_runs')::int = 0
     AND (v_before_from->>'ties')::int = 0 AND (v_before_from->>'prices')::int = 0 THEN
    RAISE EXCEPTION 'dev_on_site_move_job: % has nothing on site to move — no place, cage, box, ledger row, photo, part rename, sticker run, Same part? answer or price', v_from_label;
  END IF;

  -- Where the photos' files are. A row moves with its box; a file already in Drive stays in the folder it was filed in.
  SELECT count(*) FILTER (WHERE drive_file_id IS NOT NULL),
         count(*) FILTER (WHERE drive_file_id IS NULL AND storage_path IS NOT NULL)
    INTO v_photos_in_drive, v_photos_waiting
  FROM public.job_box_photos WHERE job_id = v_from;

  BEGIN
    v_carried := public.on_site_carry_job(v_from, v_to);
    v_folded := CASE WHEN v_carried->'unsorted_folded' IS NULL OR jsonb_typeof(v_carried->'unsorted_folded') = 'null' THEN 0 ELSE 1 END;
    v_dropped := jsonb_array_length(v_carried->'ties_dropped');

    v_after_from := public.on_site_job_counts(v_from);
    v_after_to := public.on_site_job_counts(v_to);

    -- The rows must add up, or nothing is written: the source ends empty, and the target holds both jobs' rows less
    -- the places that became one and an Unsorted row that folded. The ties and prices land on the target job, or on
    -- its site when it is on one, less the answers a pair lost.
    FOREACH v_key IN ARRAY ARRAY['places', 'containers', 'movements', 'container_moves', 'photos', 'part_renames', 'sticker_runs', 'ties', 'prices'] LOOP
      IF (v_after_from->>v_key)::int <> 0 THEN
        RAISE EXCEPTION 'dev_on_site_move_job: % still holds % % after the move — nothing written', v_from_label, v_after_from->>v_key, v_key;
      END IF;
    END LOOP;
    IF (v_after_to->>'movements')::int <> (v_before_from->>'movements')::int + (v_before_to->>'movements')::int
       OR (v_after_to->>'container_moves')::int <> (v_before_from->>'container_moves')::int + (v_before_to->>'container_moves')::int
       OR (v_after_to->>'photos')::int <> (v_before_from->>'photos')::int + (v_before_to->>'photos')::int
       OR (v_after_to->>'containers')::int <> (v_before_from->>'containers')::int + (v_before_to->>'containers')::int - v_folded
       OR (v_after_to->>'places')::int <> (v_before_from->>'places')::int + (v_before_to->>'places')::int - jsonb_array_length(v_carried->'places_merged')
       OR (v_after_to->>'part_renames')::int <> (v_before_from->>'part_renames')::int + (v_before_to->>'part_renames')::int
       OR (v_after_to->>'sticker_runs')::int <> (v_before_from->>'sticker_runs')::int + (v_before_to->>'sticker_runs')::int THEN
      RAISE EXCEPTION 'dev_on_site_move_job: the rows on % after the move do not add up to both jobs'' rows — nothing written', v_to_label;
    END IF;
    IF v_carried->>'ties_into' = 'site' THEN
      IF (v_after_to->>'ties')::int <> (v_before_to->>'ties')::int
         OR (v_after_to->>'prices')::int <> (v_before_to->>'prices')::int
         OR (v_after_to->>'site_ties')::int <> (v_before_to->>'site_ties')::int + (v_before_from->>'ties')::int - v_dropped
         OR (v_after_to->>'site_prices')::int <> (v_before_to->>'site_prices')::int + (v_before_from->>'prices')::int THEN
        RAISE EXCEPTION 'dev_on_site_move_job: the Same part? answers and prices on %''s site after the move do not add up — nothing written', v_to_label;
      END IF;
    ELSE
      IF (v_after_to->>'ties')::int <> (v_before_from->>'ties')::int + (v_before_to->>'ties')::int - v_dropped
         OR (v_after_to->>'prices')::int <> (v_before_from->>'prices')::int + (v_before_to->>'prices')::int THEN
        RAISE EXCEPTION 'dev_on_site_move_job: the Same part? answers and prices on % after the move do not add up — nothing written', v_to_label;
      END IF;
    END IF;
    -- The parts on hand are the same parts, so the sums should add up. They can read differently only where a count
    -- now resets a line that rows from the other job fed: two Unsorted piles that became one, or a row that named
    -- the other job's box. The reply says which way it went and the reader decides; nothing is refused for it.
    v_holds := (v_after_to->>'parts_on_hand')::int = (v_before_from->>'parts_on_hand')::int + (v_before_to->>'parts_on_hand')::int;

    v_what := (v_carried->>'containers') || CASE WHEN (v_carried->>'containers')::int = 1 THEN ' cage or box' ELSE ' cages and boxes' END
      || CASE WHEN (v_carried->>'retired_containers')::int > 0 THEN ' (' || (v_carried->>'retired_containers') || ' retired)' ELSE '' END
      || ', ' || (v_before_from->>'places') || CASE WHEN (v_before_from->>'places')::int = 1 THEN ' place' ELSE ' places' END
      || ', ' || (v_carried->>'movements') || CASE WHEN (v_carried->>'movements')::int = 1 THEN ' ledger row' ELSE ' ledger rows' END
      || ', ' || (v_carried->>'container_moves') || CASE WHEN (v_carried->>'container_moves')::int = 1 THEN ' box move' ELSE ' box moves' END
      || ', ' || (v_carried->>'photos') || CASE WHEN (v_carried->>'photos')::int = 1 THEN ' photo' ELSE ' photos' END
      -- The four tables are named only when the job has rows in them, so a plain move reads as it did.
      || CASE WHEN (v_carried->>'part_renames')::int > 0 THEN ', ' || (v_carried->>'part_renames') || CASE WHEN (v_carried->>'part_renames')::int = 1 THEN ' part rename' ELSE ' part renames' END ELSE '' END
      || CASE WHEN (v_carried->>'sticker_runs')::int > 0 THEN ', ' || (v_carried->>'sticker_runs') || CASE WHEN (v_carried->>'sticker_runs')::int = 1 THEN ' sticker run' ELSE ' sticker runs' END ELSE '' END
      || CASE WHEN (v_carried->>'ties')::int > 0 THEN ', ' || (v_carried->>'ties') || CASE WHEN (v_carried->>'ties')::int = 1 THEN ' Same part? answer' ELSE ' Same part? answers' END ELSE '' END
      || CASE WHEN (v_carried->>'prices')::int > 0 THEN ', ' || (v_carried->>'prices') || CASE WHEN (v_carried->>'prices')::int = 1 THEN ' price' ELSE ' prices' END ELSE '' END;

    v_photo_words := CASE
      WHEN (v_carried->>'photos')::int = 0 THEN 'No photos to move.'
      ELSE 'Every photo''s row moves with its box.'
        || CASE WHEN v_photos_in_drive > 0 THEN ' ' || v_photos_in_drive || CASE WHEN v_photos_in_drive = 1 THEN ' file is' ELSE ' files are' END
             || ' already in Drive and ' || CASE WHEN v_photos_in_drive = 1 THEN 'stays' ELSE 'stay' END || ' in ' || v_from_label
             || '''s photo folder: each row keeps its own Drive id, so a photo that showed on its box still does, but '
             || v_to_label || '''s Drive folder will not list ' || CASE WHEN v_photos_in_drive = 1 THEN 'it' ELSE 'them' END || '.'
           ELSE '' END
        || CASE WHEN v_photos_waiting > 0 THEN ' ' || v_photos_waiting || CASE WHEN v_photos_waiting = 1 THEN ' is' ELSE ' are' END
             || ' still waiting for the photo sweep, which files by the row''s job: into ' || v_to_label || '''s photo folder.'
           ELSE '' END
    END;

    -- Where the job's Same part? answers and prices land, and which answers a pair lost.
    v_ties_words := CASE
      WHEN (v_carried->>'ties')::int = 0 AND (v_carried->>'prices')::int = 0 THEN 'No Same part? answers or prices of the job''s own to move.'
      WHEN v_carried->>'ties_into' = 'site' THEN 'The job''s ' || (v_carried->>'ties') || CASE WHEN (v_carried->>'ties')::int = 1 THEN ' Same part? answer and ' ELSE ' Same part? answers and ' END
        || (v_carried->>'prices') || CASE WHEN (v_carried->>'prices')::int = 1 THEN ' price now belong to ' ELSE ' prices now belong to ' END
        || v_to_label || '''s site' || CASE WHEN COALESCE(v_to_site, '') <> '' THEN ', ' || v_to_site ELSE '' END
        || ', where every job on it reads them.'
      ELSE 'The job''s ' || (v_carried->>'ties') || CASE WHEN (v_carried->>'ties')::int = 1 THEN ' Same part? answer and ' ELSE ' Same part? answers and ' END
        || (v_carried->>'prices') || CASE WHEN (v_carried->>'prices')::int = 1 THEN ' price now belong to ' ELSE ' prices now belong to ' END
        || v_to_label || ', which is on no site.'
    END
    || CASE WHEN v_dropped > 0 THEN ' ' || v_dropped || CASE WHEN v_dropped = 1 THEN ' pair was' ELSE ' pairs were' END
         || ' answered on both sides; the newer answer stands: '
         || (SELECT string_agg((d->>'a') || ' and ' || (d->>'b') || ' (' || CASE WHEN d->>'kept' = 'source' THEN v_from_label ELSE v_to_label END || '''s)', ', ') FROM jsonb_array_elements(v_carried->'ties_dropped') d)
         || '.'
       ELSE '' END;

    -- A line on each job's notes, as a combine leaves one, so the office reads where the boxes went and came from.
    v_note_to := left('Materials on site moved here from ' || v_from_label || CASE WHEN v_from_name <> '' THEN ' (' || v_from_name || ')' ELSE '' END
      || ', where the count was recorded: ' || v_what || '. Every box keeps its printed code.'
      || CASE WHEN jsonb_array_length(v_carried->'labels_renamed') > 0
           THEN ' ' || jsonb_array_length(v_carried->'labels_renamed') || ' took a numbered label because this job already had that stencil: '
             || (SELECT string_agg((l->>'from') || ' is now ' || (l->>'to'), ', ') FROM jsonb_array_elements(v_carried->'labels_renamed') l) || '.'
           ELSE '' END
      || CASE WHEN (v_carried->>'ties')::int > 0 OR (v_carried->>'prices')::int > 0 THEN ' ' || v_ties_words ELSE '' END, 2000);
    v_note_from := left('Materials on site moved to ' || v_to_label || CASE WHEN v_to_name <> '' THEN ' (' || v_to_name || ')' ELSE '' END
      || ', the job the material belongs to: ' || v_what || '. Nothing on site is left on this job.', 2000);
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES (v_to, auth.uid(), v_note_to);
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES (v_from, auth.uid(), v_note_from);

    v_out := jsonb_build_object(
      'ok', true,
      'dry_run', p_dry_run,
      'from', jsonb_build_object('id', v_from, 'label', v_from_label, 'name', v_from_name),
      'to', jsonb_build_object('id', v_to, 'label', v_to_label, 'name', v_to_name),
      'by', v_dev_name,
      'words', 'Everything on site on ' || v_from_label || ' moves to ' || v_to_label || ': ' || v_what
        || '. Every cage and box keeps its id and the code printed on its label; no ledger row is rewritten, only the job it sits under.',
      'moved', v_carried - 'places_merged' - 'unsorted_folded' - 'labels_renamed' - 'ties_into' - 'ties_dropped',
      'places_merged', v_carried->'places_merged',
      'unsorted_folded', v_carried->'unsorted_folded',
      'labels_renamed', v_carried->'labels_renamed',
      'photos', jsonb_build_object('rows', (v_carried->>'photos')::int, 'in_drive', v_photos_in_drive, 'waiting', v_photos_waiting, 'words', v_photo_words),
      'ties', jsonb_build_object('into', v_carried->>'ties_into', 'dropped', v_carried->'ties_dropped', 'words', v_ties_words),
      'on_hand', jsonb_build_object(
        'holds', v_holds,
        'words', CASE WHEN v_holds THEN 'The parts on hand add up: ' || (v_before_from->>'parts_on_hand') || ' from ' || v_from_label || ' and ' || (v_before_to->>'parts_on_hand') || ' already on ' || v_to_label || ' read ' || (v_after_to->>'parts_on_hand') || ' after.'
                      ELSE 'The parts on hand do not add up: ' || (v_before_from->>'parts_on_hand') || ' from ' || v_from_label || ' and ' || (v_before_to->>'parts_on_hand') || ' already on ' || v_to_label || ' read ' || (v_after_to->>'parts_on_hand') || ' after. A count now resets a line that rows from the other job fed: two Unsorted piles that became one, or a row that named the other job''s box. Read both jobs with read_on_site before applying.' END),
      'before', jsonb_build_object('from', v_before_from, 'to', v_before_to),
      'after', jsonb_build_object('from', v_after_from, 'to', v_after_to),
      'notes', jsonb_build_object('from', v_note_from, 'to', v_note_to),
      'next', 'A phone that still has ' || v_from_label || ' open on the On site tab should open ' || v_to_label || ' instead: a press it sends lands on the box''s job now, and is refused for anyone who is not on ' || v_to_label || '''s team.'
    );
    IF p_dry_run THEN
      -- unwind every write above; v_out survives the exception
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;
    RETURN v_out;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_out;
  END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) IS 'dev-mcp (v2.6808, punch list #209; v2.7265 the four tables of 2026-11-13): a signed-in dev moves everything one job holds on site to another job — { from_job, to_job } — through on_site_carry_job, the rule the whole-job combine uses, every container keeping its id and printed code; the job''s part renames and sticker runs go with it, and its own Same part? answers and prices to the target job or its site; a note lands on both jobs. p_dry_run = true (default) performs the move, reads both jobs and unwinds, returning the plan: the counts moved, the places that became one, the labels renumbered, where the photos'' files are, where the answers and prices land and the pairs that kept the newer answer, and the row counts and parts on hand on both jobs before and after. Devs only; a training account and a twin are refused.';
