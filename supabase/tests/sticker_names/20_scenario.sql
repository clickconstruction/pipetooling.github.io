-- Stickers before boxes: a run that names its boxes (v2.7312, punch list #329 section 10 PR 7). Through RLS as a
-- signed-in dev: a run of numbers only is as before; a named run gives each sticker its name in number order and the
-- run its first and last; names are saved as the box rule saves them; a run whose names are too few, off the rule or
-- doubled is refused in words before a number is taken; an empty list is a numbered run; the three-hundred names of
-- G1 to G100C land in print order; a blank sticker typed no name makes a box of its own name, a name the site already
-- holds is refused by the box rule (the screen sends the known box instead), and a numbered sticker typed no name is
-- refused by the rule too. Fixtures made as postgres; everything inside one transaction that rolls back. Raises on the
-- first failed assertion; ends with "sticker_names PASSED". See scripts/pgtest-sticker-names.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA stn;
CREATE FUNCTION stn.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION stn.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() and auth.role() read).
CREATE FUNCTION stn.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the bed reads past RLS (as postgres).
CREATE FUNCTION stn.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
-- A mint, its answer kept for the asserts.
CREATE TABLE stn.answers (label text PRIMARY KEY, answer jsonb);
CREATE FUNCTION stn.mint(label text, p_job uuid, p_count integer, p_names text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v jsonb;
BEGIN
  v := public.mint_sticker_run(p_job, p_count, 1, p_names);
  INSERT INTO stn.answers VALUES (label, v);
END $$;
GRANT USAGE ON SCHEMA stn TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA stn TO authenticated, service_role;
GRANT ALL ON stn.answers TO authenticated, service_role;

-- Who: a dev. Where: one job with one live box, G12, under the box rule, and a place.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000731d1', 'dev@stickernames.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000731d1', 'dev@stickernames.test', 'Names Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000731f1', 'Sticker names bed work', 'JN');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000731a1', '00000000-0000-0000-0000-0000000731d1', '00000000-0000-0000-0000-0000000731f1', 'Names job', '731');
INSERT INTO public.job_places (id, job_id, name) VALUES ('00000000-0000-0000-0000-0000000731b1', '00000000-0000-0000-0000-0000000731a1', 'Arena');
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a7310c01-0000-0000-0000-0000000731c1', '00000000-0000-0000-0000-0000000731a1', 'G12', 'cage');

SELECT stn.as_user('00000000-0000-0000-0000-0000000731d1');
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. A run of numbers only, as before: no names anywhere, the old three-argument call still answers.
SELECT stn.mint('numbered', '00000000-0000-0000-0000-0000000731a1', 3, NULL);
SELECT stn.same('a numbered run has no names', (SELECT (answer -> 'run' ->> 'names') FROM stn.answers WHERE label = 'numbered'), NULL);
SELECT stn.same('a numbered run has no first name', (SELECT (answer -> 'run' ->> 'name_first') FROM stn.answers WHERE label = 'numbered'), NULL);
SELECT stn.same('a numbered sticker has no name', (SELECT (answer -> 'stickers' -> 0 ->> 'box_name') FROM stn.answers WHERE label = 'numbered'), NULL);
SELECT stn.same('a numbered run has its three stickers', (SELECT jsonb_array_length(answer -> 'stickers')::text FROM stn.answers WHERE label = 'numbered'), '3');
SELECT stn.same('the old call shape still answers', (SELECT jsonb_array_length(public.mint_sticker_run('00000000-0000-0000-0000-0000000731a1', 2, 1) -> 'stickers')::text), '2');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A named run: each sticker its name in number order, the run its first and last, names saved in capitals.
SELECT stn.mint('named', '00000000-0000-0000-0000-0000000731a1', 3, ARRAY['G78', ' g79', 'G80B ']);
SELECT stn.same('the run reads its first name', (SELECT answer -> 'run' ->> 'name_first' FROM stn.answers WHERE label = 'named'), 'G78');
SELECT stn.same('the run reads its last name', (SELECT answer -> 'run' ->> 'name_last' FROM stn.answers WHERE label = 'named'), 'G80B');
SELECT stn.same('the run keeps its names as the rule saves them', (SELECT (answer -> 'run' -> 'names')::text FROM stn.answers WHERE label = 'named'), '["G78", "G79", "G80B"]');
SELECT stn.same('the stickers carry their names in number order', (
  SELECT string_agg(s ->> 'box_name', ',' ORDER BY (s ->> 'number')::integer) FROM stn.answers a, jsonb_array_elements(a.answer -> 'stickers') s WHERE a.label = 'named'
), 'G78,G79,G80B');
SELECT stn.same('the numbers are one unbroken block after the numbered runs', (
  SELECT string_agg(s ->> 'number', ',' ORDER BY (s ->> 'number')::integer) FROM stn.answers a, jsonb_array_elements(a.answer -> 'stickers') s WHERE a.label = 'named'
), '6,7,8');
SELECT stn.same('sticker_by_code answers the name', (
  SELECT public.sticker_by_code(answer -> 'stickers' -> 0 ->> 'code') ->> 'box_name' FROM stn.answers WHERE label = 'named'
), 'G78');
SELECT stn.same('box_sticker_facts answers the name', (
  SELECT public.box_sticker_facts((answer -> 'stickers' -> 1 ->> 'id')::uuid) ->> 'box_name' FROM stn.answers WHERE label = 'named'
), 'G79');
SELECT stn.same('the blank-name index holds the three', stn.one($q$SELECT count(*)::text FROM public.box_stickers WHERE container_id IS NULL AND lost_at IS NULL AND box_name IS NOT NULL$q$), '3');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Refused in words before a number is taken.
SELECT stn.refused('too few names', $q$SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000731a1', 3, 1, ARRAY['G90', 'G91'])$q$, 'A run''s names are as many as its stickers: 2 names for 3 stickers.');
SELECT stn.refused('a name off the rule', $q$SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000731a1', 2, 1, ARRAY['G90', 'G0'])$q$, 'G0 is not a name. A name is one to three letters and a number from 1 to 999, like R76.');
SELECT stn.refused('a name of words', $q$SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000731a1', 1, 1, ARRAY['GATE 1'])$q$, 'is not a name');
SELECT stn.refused('a name twice', $q$SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000731a1', 3, 1, ARRAY['G90', 'G91', 'g90'])$q$, 'A run names each box once. G90 is in it twice.');
SELECT stn.same('a refused run took no number', stn.one($q$SELECT max(number)::text FROM public.box_stickers$q$), '8');
SELECT stn.same('an empty list is a numbered run', (SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000731a1', 1, 1, ARRAY[]::text[]) -> 'run' ->> 'names'), NULL);

-- ---------------------------------------------------------------------------------------------------------------
-- 4. G1 to G100C: every spot plain, then B, then C, three hundred names in print order.
SELECT stn.mint('grid', '00000000-0000-0000-0000-0000000731a1', 300, ARRAY(SELECT 'G' || n || t FROM generate_series(1, 100) n, unnest(ARRAY['', 'B', 'C']) t ORDER BY n, t));
SELECT stn.same('three hundred stickers', (SELECT jsonb_array_length(answer -> 'stickers')::text FROM stn.answers WHERE label = 'grid'), '300');
SELECT stn.same('the first seven read plain, B, C', (
  SELECT string_agg(s ->> 'box_name', ',' ORDER BY (s ->> 'number')::integer) FROM (
    SELECT s FROM stn.answers a, jsonb_array_elements(a.answer -> 'stickers') s WHERE a.label = 'grid' ORDER BY (s ->> 'number')::integer LIMIT 7
  ) x(s)
), 'G1,G1B,G1C,G2,G2B,G2C,G3');
SELECT stn.same('the last is G100C', (SELECT answer -> 'run' ->> 'name_last' FROM stn.answers WHERE label = 'grid'), 'G100C');
SELECT stn.same('the names column holds the count', stn.one($q$SELECT array_length(names, 1)::text FROM public.sticker_runs WHERE name_last = 'G100C'$q$), '300');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Placing: a blank sticker typed no name makes a box of its own name; a name the site holds is refused by the box
--    rule, so the screen sends the known box for the backfill; a numbered sticker typed no name is refused by the rule.
SELECT stn.same('a named sticker typed no name makes a box of its name', (
  SELECT public.place_sticker((answer -> 'stickers' -> 0 ->> 'id')::uuid, NULL, '00000000-0000-0000-0000-0000000731a1', NULL, 'cage', '', '00000000-0000-0000-0000-0000000731b1') -> 'sticker' ->> 'container_label'
  FROM stn.answers WHERE label = 'named'
), 'G78');
SELECT stn.same('the box is live on the job under its name', stn.one($q$SELECT label FROM public.job_containers WHERE job_id = '00000000-0000-0000-0000-0000000731a1' AND label = 'G78' AND retired_at IS NULL$q$), 'G78');
SELECT stn.same('a typed name still wins over the sticker''s', (
  SELECT public.place_sticker((answer -> 'stickers' -> 1 ->> 'id')::uuid, NULL, '00000000-0000-0000-0000-0000000731a1', 'G91', 'cage', '', NULL) -> 'sticker' ->> 'container_label'
  FROM stn.answers WHERE label = 'named'
), 'G91');
SELECT stn.same('the sticker still reads its printed name after that', (
  SELECT public.box_sticker_facts((answer -> 'stickers' -> 1 ->> 'id')::uuid) ->> 'box_name' FROM stn.answers WHERE label = 'named'
), 'G79');
-- G12 of the grid run: the site has a G12 already.
SELECT stn.refused('a name the site holds is refused by the box rule', (
  SELECT format($q$SELECT public.place_sticker(%L::uuid, NULL, '00000000-0000-0000-0000-0000000731a1', NULL, 'cage', '', NULL)$q$, s ->> 'id')
  FROM stn.answers a, jsonb_array_elements(a.answer -> 'stickers') s WHERE a.label = 'grid' AND s ->> 'box_name' = 'G12'
), 'G12 is already on this site');
SELECT stn.same('the refusal undid the box', stn.one($q$SELECT count(*)::text FROM public.job_containers WHERE label = 'G12'$q$), '1');
SELECT stn.same('the known box takes the sticker instead', (
  SELECT public.place_sticker(s_id, 'a7310c01-0000-0000-0000-0000000731c1', NULL, NULL, 'cage', '', NULL) ->> 'ok'
  FROM (SELECT (s ->> 'id')::uuid AS s_id FROM stn.answers a, jsonb_array_elements(a.answer -> 'stickers') s WHERE a.label = 'grid' AND s ->> 'box_name' = 'G12') x
), 'true');
SELECT stn.refused('a numbered sticker typed no name is refused by the box rule', (
  SELECT format($q$SELECT public.place_sticker(%L::uuid, NULL, '00000000-0000-0000-0000-0000000731a1', NULL, 'cage', '', NULL)$q$, answer -> 'stickers' -> 0 ->> 'id')
  FROM stn.answers WHERE label = 'numbered'
), 'is not a name');

RESET ROLE;
SELECT 'sticker_names PASSED' AS result;
ROLLBACK;
