-- Stickers before boxes, punch list #329, design section 10, PR 7 (v2.7312): a run that names its boxes.
--
-- The owner, 2026-11-15: print stickers that already say G1 to G200, or G78 to G300, so the sticker on the cage is the
-- name painted on it. A sticker keeps its number (one company-wide count, the identity a typed scan and the CSV use,
-- the thing that survives a rename) and gains a name, a promise of the box's name, printed large where the number
-- prints today. The box's row is still made on the first scan, so an unused sticker leaves nothing behind.
--
-- What changes:
--   1. sticker_runs.names text[]         — the run's names in print order, null for a numbered-only run; name_first
--                                          and name_last read from it, so a list and a title need no scan of the array.
--   2. box_stickers.box_name text        — each sticker's name, written by the mint trigger and by nothing else.
--   3. sticker_runs_stamp                — a named run's names hold to the box rule (box_name_words, #351), are as many
--                                          as its stickers and name each box once; refused in words before a number is
--                                          taken.
--   4. sticker_runs_mint                 — each sticker takes its name from the run, in number order.
--   5. box_sticker_facts                 — answers box_name, so sticker_by_code and the scan read it.
--   6. mint_sticker_run(job, count, copies, names) — the old three-argument shape dropped and remade with the names
--                                          optional, so the client of today keeps calling it.
--   7. place_sticker                     — a new box typed no name takes the sticker's own name; the number as before
--                                          only when the sticker has none.
--
-- The names come from the client's range parser (src/lib/materials/stickerNames.ts: G78-300, A1-D50, G78B-D,
-- G1-100C) as a plain list. The database does not read ranges: two parsers would drift on the shorthand, and what it
-- must hold it can check on the list itself. The mint refuses nothing about names the site already carries: a name
-- that is a live box is the backfill, and the window's two notices (PR 8) say so before the press.
--
-- No table is created, so no fence call is owed. Additive and idempotent. The client calls nothing new until PR 8, so
-- this push can follow the merge at leisure.

SET lock_timeout = '3s';

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The run's names.
-- ---------------------------------------------------------------------------------------------------------------

ALTER TABLE public.sticker_runs ADD COLUMN IF NOT EXISTS names text[];
ALTER TABLE public.sticker_runs ADD COLUMN IF NOT EXISTS name_first text GENERATED ALWAYS AS (names[1]) STORED;
ALTER TABLE public.sticker_runs ADD COLUMN IF NOT EXISTS name_last text GENERATED ALWAYS AS (names[array_length(names, 1)]) STORED;
COMMENT ON COLUMN public.sticker_runs.names IS 'Stickers before boxes (#329, section 10): the run''s box names in print order, G78 to G300, each under the box rule and one of a kind in the run; null for a run that carries numbers only.';
COMMENT ON COLUMN public.sticker_runs.name_first IS 'The first of names, for a title; null for a numbered-only run.';
COMMENT ON COLUMN public.sticker_runs.name_last IS 'The last of names, for a title; null for a numbered-only run.';

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sticker_runs_names_count_check' AND conrelid = 'public.sticker_runs'::regclass) THEN
    ALTER TABLE public.sticker_runs ADD CONSTRAINT sticker_runs_names_count_check
      CHECK (names IS NULL OR array_length(names, 1) = sticker_count);
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. The sticker's name.
-- ---------------------------------------------------------------------------------------------------------------

ALTER TABLE public.box_stickers ADD COLUMN IF NOT EXISTS box_name text;
COMMENT ON COLUMN public.box_stickers.box_name IS 'Stickers before boxes (#329, section 10): the name printed large on the sticker, G78, a promise of its box''s name under the box rule (#351). Written by the mint trigger from the run''s names and by nothing else; null on a sticker that carries its number only. Never the box''s own label: that is job_containers.label, and a rename leaves this as the tape reads.';
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'box_stickers_box_name_check' AND conrelid = 'public.box_stickers'::regclass) THEN
    ALTER TABLE public.box_stickers ADD CONSTRAINT box_stickers_box_name_check
      CHECK (box_name IS NULL OR box_name ~ '^[A-Z]{1,3}[1-9][0-9]{0,2}[A-Z]?$');
  END IF;
END
$do$;
-- The window's second notice (PR 8) asks for names printed and not yet on a box; the scan sheet (PR 9) for a blank
-- sticker by its name.
CREATE INDEX IF NOT EXISTS box_stickers_blank_name_idx ON public.box_stickers (box_name)
  WHERE container_id IS NULL AND lost_at IS NULL AND box_name IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The stamp: who prints a run, and a named run's names, refused in words before a number is taken.
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sticker_runs_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_names text[];
  v_name text;
  v_words text;
  v_i integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to print a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot print a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot print a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sticker_can_mint() THEN
    RAISE EXCEPTION 'Only the office, a primary or a superintendent prints a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF NEW.job_id IS NULL THEN
    RAISE EXCEPTION 'A run names the job its new boxes go on.';
  END IF;
  IF NEW.sticker_count IS NULL OR NEW.sticker_count < 1 OR NEW.sticker_count > 500 THEN
    RAISE EXCEPTION 'A run is 1 to 500 stickers.';
  END IF;
  NEW.copies := COALESCE(NEW.copies, 1);
  IF NEW.copies < 1 OR NEW.copies > 6 THEN
    RAISE EXCEPTION 'Copies of each is 1 to 6.';
  END IF;
  -- A named run (section 10): as many names as stickers, each under the box rule, each box named once. The names are
  -- kept as the rule saves them, in capitals and trimmed. An empty list is a numbered-only run.
  IF NEW.names IS NOT NULL AND array_length(NEW.names, 1) IS NULL THEN
    NEW.names := NULL;
  END IF;
  IF NEW.names IS NOT NULL THEN
    IF array_length(NEW.names, 1) <> NEW.sticker_count THEN
      RAISE EXCEPTION 'A run''s names are as many as its stickers: % names for % stickers.', array_length(NEW.names, 1), NEW.sticker_count;
    END IF;
    v_names := ARRAY[]::text[];
    FOR v_i IN 1..array_length(NEW.names, 1) LOOP
      v_name := upper(btrim(COALESCE(NEW.names[v_i], '')));
      v_words := public.box_name_words(v_name);
      IF v_words IS NOT NULL THEN
        RAISE EXCEPTION '%', v_words;
      END IF;
      IF v_name = ANY (v_names) THEN
        RAISE EXCEPTION 'A run names each box once. % is in it twice.', v_name;
      END IF;
      v_names := v_names || v_name;
    END LOOP;
    NEW.names := v_names;
  END IF;
  NEW.first_number := NULL;
  NEW.last_number := NULL;
  NEW.printed_by := auth.uid();
  NEW.printed_by_name := public.box_sticker_caller_name();
  NEW.printed_at := now();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.sticker_runs_stamp() IS 'Stickers before boxes (#329): BEFORE INSERT on sticker_runs. Refuses in words anyone who may not print a run, holds a named run''s names to the box rule, as many as its stickers and each once (section 10), and fills who and when from the session.';
REVOKE EXECUTE ON FUNCTION public.sticker_runs_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_stamp() FROM authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. The mint: each sticker takes its name from the run, in number order.
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sticker_runs_mint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_first integer;
  v_last integer;
  v_n integer;
  v_id uuid;
  v_code text;
  v_tries integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('box_sticker_numbers'));
  v_first := nextval('public.box_sticker_number_seq');
  v_last := v_first + NEW.sticker_count - 1;
  PERFORM setval('public.box_sticker_number_seq', v_last);
  FOR v_n IN v_first..v_last LOOP
    v_tries := 0;
    LOOP
      v_id := gen_random_uuid();
      v_code := upper(left(replace(v_id::text, '-', ''), 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.job_containers c WHERE c.code = v_code)
            AND NOT EXISTS (SELECT 1 FROM public.box_stickers s WHERE s.code = v_code);
      v_tries := v_tries + 1;
      IF v_tries >= 20 THEN
        RAISE EXCEPTION 'No free code for sticker %. Print the run again.', public.box_sticker_number_words(v_n);
      END IF;
    END LOOP;
    INSERT INTO public.box_stickers (id, run_id, number, box_name)
    VALUES (v_id, NEW.id, v_n, CASE WHEN NEW.names IS NULL THEN NULL ELSE NEW.names[v_n - v_first + 1] END);
  END LOOP;
  UPDATE public.sticker_runs SET first_number = v_first, last_number = v_last WHERE id = NEW.id;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.sticker_runs_mint() IS 'Stickers before boxes (#329): AFTER INSERT on sticker_runs. Takes the run''s block of numbers under a lock and makes its box_stickers rows, each with its name from the run''s names in order (section 10), cutting a new id for any code a box or a sticker already carries.';
REVOKE EXECUTE ON FUNCTION public.sticker_runs_mint() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_mint() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_mint() FROM authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. One sticker's facts, with its name. sticker_by_code answers through this and needs no change.
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.box_sticker_facts(p_sticker_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', s.id,
    'number', s.number,
    'code', s.code,
    'box_name', s.box_name,
    'state', CASE WHEN s.lost_at IS NOT NULL THEN 'lost' WHEN s.container_id IS NOT NULL THEN 'on_box' ELSE 'blank' END,
    'container_id', s.container_id,
    'container_label', c.label,
    'container_kind', c.kind,
    'container_retired_at', c.retired_at,
    'job_id', c.job_id,
    'placed_by_name', NULLIF(s.placed_by_name, ''),
    'placed_at', s.placed_at,
    'lost_at', s.lost_at,
    'run_id', s.run_id,
    'run_job_id', r.job_id
  )
  FROM public.box_stickers s
  JOIN public.sticker_runs r ON r.id = s.run_id
  LEFT JOIN public.job_containers c ON c.id = s.container_id
  WHERE s.id = p_sticker_id
$fn$;
COMMENT ON FUNCTION public.box_sticker_facts(uuid) IS 'Stickers before boxes (#329): one sticker by its id. Its number, its printed name or null (section 10), blank / on_box / lost, the box it is on with its name, kind and job, who put it there and when, and the job its run was printed for. Null when there is none. Signed-in callers only.';
REVOKE EXECUTE ON FUNCTION public.box_sticker_facts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.box_sticker_facts(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.box_sticker_facts(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Print a run, with or without names. The three-argument shape is dropped first: two shapes side by side would
--    leave PostgREST to choose between them on every call, and the new one with its default answers the old call.
-- ---------------------------------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.mint_sticker_run(uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.mint_sticker_run(p_job_id uuid, p_count integer, p_copies integer DEFAULT 1, p_names text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid := gen_random_uuid();
  v_run jsonb;
  v_stickers jsonb;
BEGIN
  IF p_job_id IS NULL OR NOT public.on_site_can_touch_job(p_job_id) THEN
    RAISE EXCEPTION 'That job is not one you can reach.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.sticker_runs (id, job_id, sticker_count, copies, names)
  VALUES (v_id, p_job_id, p_count, COALESCE(p_copies, 1), p_names);
  SELECT to_jsonb(r) INTO v_run
  FROM (
    SELECT id, job_id, sticker_count, first_number, last_number, copies, printed_by, printed_by_name, printed_at, names, name_first, name_last
    FROM public.sticker_runs WHERE id = v_id
  ) r;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'code', s.code, 'box_name', s.box_name) ORDER BY s.number), '[]'::jsonb)
    INTO v_stickers
  FROM public.box_stickers s WHERE s.run_id = v_id;
  RETURN jsonb_build_object('run', v_run, 'stickers', v_stickers);
END;
$fn$;
COMMENT ON FUNCTION public.mint_sticker_run(uuid, integer, integer, text[]) IS 'Stickers before boxes (#329): print a run. Inserts the sticker_runs row as the caller (the office, a primary or a superintendent, on a job they can reach), with p_names the boxes'' names in print order for a named run (section 10) or null for numbers only, and answers { run, stickers: [{ id, number, code, box_name }] } in number order. SECURITY INVOKER.';
REVOKE EXECUTE ON FUNCTION public.mint_sticker_run(uuid, integer, integer, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mint_sticker_run(uuid, integer, integer, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.mint_sticker_run(uuid, integer, integer, text[]) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Put a blank sticker on a box: restated whole from 20261113020000 with one change, a new box typed no name takes
--    the sticker's own name (section 10), and the number as before only when the sticker has none.
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.place_sticker(
  p_sticker_id uuid,
  p_container_id uuid DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_kind text DEFAULT 'cage',
  p_where_note text DEFAULT '',
  p_place_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_facts jsonb;
  v_id uuid;
  v_label text;
  v_kind text := COALESCE(NULLIF(btrim(p_kind), ''), 'cage');
  v_created boolean := false;
  v_constraint text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to put a sticker on a box.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot put a sticker on a box.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot put a sticker on a box.' USING ERRCODE = '42501';
  END IF;

  v_facts := public.box_sticker_facts(p_sticker_id);
  IF v_facts IS NULL THEN
    RAISE EXCEPTION 'That sticker is not one the app printed.';
  END IF;
  -- Twice is once.
  IF v_facts ->> 'state' = 'on_box' AND p_container_id IS NOT NULL AND (v_facts ->> 'container_id')::uuid = p_container_id THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'created', false, 'container_id', p_container_id, 'sticker', v_facts);
  END IF;
  IF v_facts ->> 'state' <> 'blank' THEN
    RETURN jsonb_build_object('ok', false, 'sticker', v_facts);
  END IF;

  BEGIN
    IF p_job_id IS NOT NULL THEN
      IF NOT public.on_site_can_touch_job(p_job_id) THEN
        RAISE EXCEPTION 'That job is not one you can reach. Ask the office to add you to its team.' USING ERRCODE = '42501';
      END IF;
      v_label := regexp_replace(btrim(COALESCE(p_label, '')), '\s+', ' ', 'g');
      IF v_label = '' THEN
        -- The name the sticker was printed with (section 10); a sticker with numbers only keeps the number, which the
        -- box rule refuses, so a screen always sends a name for one of those.
        v_label := COALESCE(v_facts ->> 'box_name', public.box_sticker_number_words((v_facts ->> 'number')::integer));
      END IF;
      IF length(v_label) > 24 THEN
        RAISE EXCEPTION 'A box''s name is 24 characters at most.';
      END IF;
      IF v_kind NOT IN ('cage', 'box', 'loose') THEN
        RAISE EXCEPTION 'A sticker goes on a cage, a box or a pile.';
      END IF;
      IF p_place_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.job_places p WHERE p.id = p_place_id AND p.job_id = p_job_id) THEN
        RAISE EXCEPTION 'That place is not on this job.';
      END IF;
      v_id := COALESCE(p_container_id, gen_random_uuid());
      BEGIN
        INSERT INTO public.job_containers (id, job_id, label, kind, where_note, place_id)
        VALUES (v_id, p_job_id, v_label, v_kind, left(btrim(COALESCE(p_where_note, '')), 120), p_place_id);
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'job_containers_live_label_key' THEN
          RAISE EXCEPTION 'A box on this job is already named %. Type another name.', v_label USING ERRCODE = '23505';
        END IF;
        RAISE;
      END;
      v_created := true;
    ELSE
      IF p_container_id IS NULL THEN
        RAISE EXCEPTION 'Name the box, or the job a new box goes on.';
      END IF;
      -- Under the caller's own RLS: a box on a job they cannot touch is not there for them.
      SELECT c.id INTO v_id FROM public.job_containers c WHERE c.id = p_container_id;
      IF v_id IS NULL THEN
        RAISE EXCEPTION 'That box is not on a job you can reach.' USING ERRCODE = '42501';
      END IF;
    END IF;
    INSERT INTO public.box_sticker_events (sticker_id, kind, to_container_id) VALUES (p_sticker_id, 'placed', v_id);
  EXCEPTION WHEN SQLSTATE 'P0STK' THEN
    -- Someone took the sticker between the read and the write. This block's new box is undone with it.
    RETURN jsonb_build_object('ok', false, 'sticker', public.box_sticker_facts(p_sticker_id));
  END;

  RETURN jsonb_build_object('ok', true, 'already', false, 'created', v_created, 'container_id', v_id, 'sticker', public.box_sticker_facts(p_sticker_id));
END;
$fn$;
COMMENT ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) IS 'Stickers before boxes (#329): put a blank sticker on a box. p_job_id makes a new box there first (p_container_id its id when the client made one, p_label its name, else the sticker''s printed name, else its number); without it the sticker goes on the known box p_container_id. One transaction, a blank sticker only: otherwise { ok: false, sticker } says where it is. SECURITY INVOKER, so the gate and every policy judge the caller.';
REVOKE EXECUTE ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) TO authenticated;
