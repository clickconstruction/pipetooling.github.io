SET lock_timeout = '3s';

-- Materials on site (punch list #209, v2.7305): the office's press for moving everything a job holds on site to
-- another job.
--
-- Since v2.6808 a whole job's on-site records change job through on_site_carry_job, called by the whole-job combine
-- and by the dev seat's dev_on_site_move_job (20261109160000; the four tables of 2026-11-13 since 20261114070000).
-- The map left the office with no press for it on purpose, until the office asked a second time; on 2026-11-14 the
-- owner asked, looking at the Materials desk's site row for a site whose material sat under a paid job from July and
-- the working job. This file opens the same move to the roles that may combine two jobs, with the seat's door kept
-- as it is. CREATE OR REPLACE throughout; no table, column, index, policy or trigger is made, so no fence call is
-- owed and nothing waits on a table lock.
--
--   1. on_site_move_job_run(p, p_dry_run, p_door) — the move's body, dev_on_site_move_job's since 20261114070000
--                                                   with its gate lifted out: the parse, the refusals, the carry,
--                                                   the add-up check, the words, the note on both jobs and the dry
--                                                   run's unwind. SECURITY DEFINER (the carry is nobody's to call),
--                                                   and callable by nobody but the two doors: EXECUTE revoked from
--                                                   PUBLIC, anon and authenticated. p_door names the caller in every
--                                                   refusal, so a reader knows which door said no.
--   2. dev_on_site_move_job(p, p_dry_run)        — the seat's door, unchanged in what it admits (an active dev's
--                                                   own session, a training account and a twin refused in words),
--                                                   now one PERFORM into the body.
--   3. on_site_move_job(p, p_dry_run)            — the office's door: a dev, a master technician, an assistant or a
--                                                   controller, the roles migrate_job_ledger_costs_and_delete lets
--                                                   combine two jobs (20261103054522), who can open both jobs as the
--                                                   combine reads them; a training account, a digital twin and an
--                                                   archived caller are refused in words. The plan is the seat's.
--
-- The client's press (JobsMaterialsTab, OnSiteMoveJobModal) calls on_site_move_job twice: p_dry_run = true draws the
-- plan as a confirm window, p_dry_run = false applies it.

-- 1. The body.
CREATE OR REPLACE FUNCTION public.on_site_move_job_run(p jsonb, p_dry_run boolean, p_door text)
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
  v_by_name text;
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '%: sign in to move materials on site', p_door USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(NULLIF(btrim(u.name), ''), u.email, 'the office') INTO v_by_name FROM public.users u WHERE u.id = auth.uid();

  IF COALESCE(p->>'from_job', '') !~ '^[0-9a-fA-F-]{36}$' OR COALESCE(p->>'to_job', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION '%: from_job and to_job are required (each a jobs_ledger.id — find_job)', p_door;
  END IF;
  v_from := (p->>'from_job')::uuid;
  v_to := (p->>'to_job')::uuid;
  IF v_from = v_to THEN
    RAISE EXCEPTION '%: from_job and to_job are the same job — nothing to move', p_door;
  END IF;

  -- Each job as the app names it (JP972): the service type's job prefix, else J, then the HCP number, else the Click
  -- number — src/lib/ledgerDisplayPrefixes.ts formatJobLedgerNumberLabel, as dev_on_site_write names a job.
  SELECT COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, '')
    INTO v_from_label, v_from_name
  FROM public.jobs_ledger j LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = v_from;
  IF v_from_label IS NULL THEN RAISE EXCEPTION '%: from_job % not found', p_door, v_from; END IF;
  SELECT COALESCE(NULLIF(btrim(st.ledger_job_prefix), ''), 'J') || COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'), COALESCE(j.job_name, ''), d.name
    INTO v_to_label, v_to_name, v_to_site
  FROM public.jobs_ledger j
  LEFT JOIN public.service_types st ON st.id = j.service_type_id
  LEFT JOIN public.developments d ON d.id = j.development_id
  WHERE j.id = v_to;
  IF v_to_label IS NULL THEN RAISE EXCEPTION '%: to_job % not found', p_door, v_to; END IF;

  v_before_from := public.on_site_job_counts(v_from);
  v_before_to := public.on_site_job_counts(v_to);
  IF (v_before_from->>'places')::int = 0 AND (v_before_from->>'containers')::int = 0
     AND (v_before_from->>'movements')::int = 0 AND (v_before_from->>'photos')::int = 0
     AND (v_before_from->>'part_renames')::int = 0 AND (v_before_from->>'sticker_runs')::int = 0
     AND (v_before_from->>'ties')::int = 0 AND (v_before_from->>'prices')::int = 0 THEN
    RAISE EXCEPTION '%: % has nothing on site to move — no place, cage, box, ledger row, photo, part rename, sticker run, Same part? answer or price', p_door, v_from_label;
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
        RAISE EXCEPTION '%: % still holds % % after the move — nothing written', p_door, v_from_label, v_after_from->>v_key, v_key;
      END IF;
    END LOOP;
    IF (v_after_to->>'movements')::int <> (v_before_from->>'movements')::int + (v_before_to->>'movements')::int
       OR (v_after_to->>'container_moves')::int <> (v_before_from->>'container_moves')::int + (v_before_to->>'container_moves')::int
       OR (v_after_to->>'photos')::int <> (v_before_from->>'photos')::int + (v_before_to->>'photos')::int
       OR (v_after_to->>'containers')::int <> (v_before_from->>'containers')::int + (v_before_to->>'containers')::int - v_folded
       OR (v_after_to->>'places')::int <> (v_before_from->>'places')::int + (v_before_to->>'places')::int - jsonb_array_length(v_carried->'places_merged')
       OR (v_after_to->>'part_renames')::int <> (v_before_from->>'part_renames')::int + (v_before_to->>'part_renames')::int
       OR (v_after_to->>'sticker_runs')::int <> (v_before_from->>'sticker_runs')::int + (v_before_to->>'sticker_runs')::int THEN
      RAISE EXCEPTION '%: the rows on % after the move do not add up to both jobs'' rows — nothing written', p_door, v_to_label;
    END IF;
    IF v_carried->>'ties_into' = 'site' THEN
      IF (v_after_to->>'ties')::int <> (v_before_to->>'ties')::int
         OR (v_after_to->>'prices')::int <> (v_before_to->>'prices')::int
         OR (v_after_to->>'site_ties')::int <> (v_before_to->>'site_ties')::int + (v_before_from->>'ties')::int - v_dropped
         OR (v_after_to->>'site_prices')::int <> (v_before_to->>'site_prices')::int + (v_before_from->>'prices')::int THEN
        RAISE EXCEPTION '%: the Same part? answers and prices on %''s site after the move do not add up — nothing written', p_door, v_to_label;
      END IF;
    ELSE
      IF (v_after_to->>'ties')::int <> (v_before_from->>'ties')::int + (v_before_to->>'ties')::int - v_dropped
         OR (v_after_to->>'prices')::int <> (v_before_from->>'prices')::int + (v_before_to->>'prices')::int THEN
        RAISE EXCEPTION '%: the Same part? answers and prices on % after the move do not add up — nothing written', p_door, v_to_label;
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
      'by', v_by_name,
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
                      ELSE 'The parts on hand do not add up: ' || (v_before_from->>'parts_on_hand') || ' from ' || v_from_label || ' and ' || (v_before_to->>'parts_on_hand') || ' already on ' || v_to_label || ' read ' || (v_after_to->>'parts_on_hand') || ' after. A count now resets a line that rows from the other job fed: two Unsorted piles that became one, or a row that named the other job''s box. '
                        || CASE WHEN p_door = 'dev_on_site_move_job' THEN 'Read both jobs with read_on_site before applying.' ELSE 'Read both jobs'' boxes before you move.' END END),
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

REVOKE ALL ON FUNCTION public.on_site_move_job_run(jsonb, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_site_move_job_run(jsonb, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.on_site_move_job_run(jsonb, boolean, text) FROM authenticated;

COMMENT ON FUNCTION public.on_site_move_job_run(jsonb, boolean, text) IS 'Materials on site (#209, v2.7305): the body of the whole-job move, dev_on_site_move_job''s since v2.7265 with its gate lifted out — { from_job, to_job } parsed and refused in words, on_site_carry_job, the add-up check on every table, the words, a note on both jobs in the caller''s name, and the dry run that does the move, reads both jobs and unwinds, returning the plan. p_door names the calling door in every refusal. SECURITY DEFINER; callable by nobody but its two doors, dev_on_site_move_job and on_site_move_job, which gate first.';

-- 2. The seat's door: the gate as it was, then the body.
CREATE OR REPLACE FUNCTION public.dev_on_site_move_job(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
  RETURN public.on_site_move_job_run(p, p_dry_run, 'dev_on_site_move_job');
END;
$fn$;

REVOKE ALL ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.dev_on_site_move_job(jsonb, boolean) IS 'dev-mcp (v2.6808, punch list #209; v2.7265 the four tables of 2026-11-13; v2.7305 the body shared with the office''s on_site_move_job): a signed-in dev moves everything one job holds on site to another job — { from_job, to_job } — through on_site_carry_job, the rule the whole-job combine uses, every container keeping its id and printed code; the job''s part renames and sticker runs go with it, and its own Same part? answers and prices to the target job or its site; a note lands on both jobs. p_dry_run = true (default) performs the move, reads both jobs and unwinds, returning the plan: the counts moved, the places that became one, the labels renumbered, where the photos'' files are, where the answers and prices land and the pairs that kept the newer answer, and the row counts and parts on hand on both jobs before and after. Devs only; a training account and a twin are refused.';

-- 3. The office's door.
CREATE OR REPLACE FUNCTION public.on_site_move_job(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_from text;
  v_to text;
BEGIN
  -- Who may move: the roles that may combine two jobs (migrate_job_ledger_costs_and_delete, 20261103054522), from
  -- their own session, not in training mode, not a twin, not archived.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'on_site_move_job: sign in to move materials on site' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')) THEN
    RAISE EXCEPTION 'on_site_move_job: only a dev, a master technician, an assistant or a controller moves everything a job holds on site to another job — the roles that may combine two jobs' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'on_site_move_job: a training account (read_only) cannot move materials on site' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'on_site_move_job: a digital twin cannot move materials on site' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'on_site_move_job: an archived account cannot move materials on site' USING ERRCODE = '42501';
  END IF;
  -- Both jobs must be ones the caller can open, as the combine reads them; a malformed id is left to the body's refusal.
  v_from := COALESCE(p->>'from_job', '');
  v_to := COALESCE(p->>'to_job', '');
  IF v_from ~ '^[0-9a-fA-F-]{36}$' AND v_to ~ '^[0-9a-fA-F-]{36}$' AND v_from <> v_to THEN
    IF EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = v_from::uuid)
       AND NOT EXISTS (
         SELECT 1 FROM public.jobs_ledger jl
         WHERE jl.id = v_from::uuid
           AND (jl.master_user_id = auth.uid() OR public.is_dev() OR public.is_office_or_estimator() OR public.assistants_share_master(auth.uid(), jl.master_user_id))
       ) THEN
      RAISE EXCEPTION 'on_site_move_job: the job the material is recorded under is not one you can open' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = v_to::uuid)
       AND NOT EXISTS (
         SELECT 1 FROM public.jobs_ledger jl
         WHERE jl.id = v_to::uuid
           AND (jl.master_user_id = auth.uid() OR public.is_dev() OR public.is_office_or_estimator() OR public.assistants_share_master(auth.uid(), jl.master_user_id))
       ) THEN
      RAISE EXCEPTION 'on_site_move_job: the job the material belongs on is not one you can open' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN public.on_site_move_job_run(p, p_dry_run, 'on_site_move_job');
END;
$fn$;

REVOKE ALL ON FUNCTION public.on_site_move_job(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_site_move_job(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.on_site_move_job(jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.on_site_move_job(jsonb, boolean) IS 'Materials on site (#209, v2.7305): the office''s door to the whole-job move — Move everything on site to another job… on a job''s Materials page and the desk''s site row. { from_job, to_job }; p_dry_run = true (default) does the move, reads both jobs and unwinds, returning the plan the window draws (the counts moved per table, the places that became one, the labels renumbered, where the photos'' files are, each job''s rows and parts on hand before and after); p_dry_run = false applies it and leaves a note on both jobs in the caller''s name. Open to a dev, a master technician, an assistant or a controller — the roles that may combine two jobs — who can open both jobs; a training account, a digital twin and an archived caller are refused in words. The same body as the dev seat''s dev_on_site_move_job (on_site_move_job_run).';
