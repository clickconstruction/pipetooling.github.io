-- Stickers before boxes: These are on boxes (punch list #329 section 10 PR 10). Through RLS as a signed-in dev on a
-- site of two jobs: a range placed in one call makes a box for each name the site has none of, with the kind, the
-- place and the where line, and puts the name's sticker on it; a name that is a live box on the site's other job
-- takes its sticker and is not made again; a name printed twice puts both stickers on the one box; a name whose
-- sticker is on a box already is left and said; a name no sticker was printed with makes nothing and is said; a
-- second call of the same range changes nothing; a name whose box the rule refuses is held with its reason while the
-- rest go on; the list is held to the box rule and to 500; a helper who is not on the job is refused; a training
-- account is refused. Fixtures made as postgres; everything inside one transaction that rolls back. Raises on the
-- first failed assertion; ends with "sticker_names PASSED". See scripts/pgtest-sticker-names.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA spr;
CREATE FUNCTION spr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION spr.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION spr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION spr.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
CREATE TABLE spr.answers (label text PRIMARY KEY, answer jsonb);
CREATE FUNCTION spr.range(label text, p_job uuid, p_names text[], p_kind text, p_place uuid, p_where text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO spr.answers VALUES (label, public.place_sticker_range(p_job, p_names, p_kind, p_place, p_where));
END $$;
GRANT USAGE ON SCHEMA spr TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA spr TO authenticated, service_role;
GRANT ALL ON spr.answers TO authenticated, service_role;

-- Who: a dev, a helper on no job, a training account. Where: a development of two jobs. Job A has a place, Arena,
-- and a live box G12. Job B has a live box G80.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000732d1', 'dev@stickerrange.test'),
  ('00000000-0000-0000-0000-0000000732d2', 'helper@stickerrange.test'),
  ('00000000-0000-0000-0000-0000000732d3', 'trainee@stickerrange.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000732d1', 'dev@stickerrange.test', 'Range Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000732d2', 'helper@stickerrange.test', 'Range Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000732d3', 'trainee@stickerrange.test', 'Range Trainee', 'dev', true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000732f1', 'Sticker range bed work', 'JR');
INSERT INTO public.developments (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000732e1', 'Range site', '00000000-0000-0000-0000-0000000732d1');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, development_id) VALUES
  ('00000000-0000-0000-0000-0000000732a1', '00000000-0000-0000-0000-0000000732d1', '00000000-0000-0000-0000-0000000732f1', 'Range job A', '7321', '00000000-0000-0000-0000-0000000732e1'),
  ('00000000-0000-0000-0000-0000000732a2', '00000000-0000-0000-0000-0000000732d1', '00000000-0000-0000-0000-0000000732f1', 'Range job B', '7322', '00000000-0000-0000-0000-0000000732e1');
INSERT INTO public.job_places (id, job_id, name) VALUES ('00000000-0000-0000-0000-0000000732b1', '00000000-0000-0000-0000-0000000732a1', 'Arena');
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a7320c01-0000-0000-0000-0000000732c1', '00000000-0000-0000-0000-0000000732a1', 'G12', 'cage'),
  ('a7320c02-0000-0000-0000-0000000732c2', '00000000-0000-0000-0000-0000000732a2', 'G80', 'cage');

SELECT spr.as_user('00000000-0000-0000-0000-0000000732d1');
SET LOCAL ROLE authenticated;

-- The stickers: a run G78 to G82 on job A, and a second run on job B that prints G79 again.
SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000732a1', 5, 1, ARRAY['G78', 'G79', 'G80', 'G81', 'G82']);
SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000732a2', 1, 1, ARRAY['G79']);

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The refusals before anything is written.
SELECT spr.refused('no names is refused in words', $q$SELECT public.place_sticker_range('00000000-0000-0000-0000-0000000732a1', ARRAY[]::text[])$q$, 'Name the stickers that are on boxes');
SELECT spr.refused('a name off the rule is refused by the box rule', $q$SELECT public.place_sticker_range('00000000-0000-0000-0000-0000000732a1', ARRAY['G78', 'G0'])$q$, 'G0 is not a name');
SELECT spr.refused('more than 500 names is refused', $q$SELECT public.place_sticker_range('00000000-0000-0000-0000-0000000732a1', ARRAY(SELECT 'A' || g FROM generate_series(1, 501) g))$q$, 'A range is 500 names at most. This one is 501.');
SELECT spr.refused('a kind that is not one is refused', $q$SELECT public.place_sticker_range('00000000-0000-0000-0000-0000000732a1', ARRAY['G78'], 'crate')$q$, 'A sticker goes on a cage, a box or a pile.');
SELECT spr.refused('a place of another job is refused', $q$SELECT public.place_sticker_range('00000000-0000-0000-0000-0000000732a2', ARRAY['G78'], 'cage', '00000000-0000-0000-0000-0000000732b1')$q$, 'That place is not on this job.');
SELECT spr.same('the refusals wrote nothing', spr.one($q$SELECT count(*)::text FROM public.job_containers WHERE job_id IN ('00000000-0000-0000-0000-0000000732a1', '00000000-0000-0000-0000-0000000732a2')$q$), '2');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. One press: G78 to G81 and G90, cages, Arena. G78 and G81 are made. G79 is made once and takes both its
--    stickers. G80 is a live box on job B and takes its sticker. G90 was never printed.
SELECT spr.range('first', '00000000-0000-0000-0000-0000000732a1', ARRAY['g78', ' G79', 'G80', 'G81', 'G90', 'G78'], 'cage', '00000000-0000-0000-0000-0000000732b1', 'by the north stair');
SELECT spr.same('the answer is ok', (SELECT answer ->> 'ok' FROM spr.answers WHERE label = 'first'), 'true');
SELECT spr.same('three names made a box, in the order handed', (SELECT (answer -> 'made')::text FROM spr.answers WHERE label = 'first'), '["G78", "G79", "G81"]');
SELECT spr.same('the live box took its sticker', (SELECT (answer -> 'took')::text FROM spr.answers WHERE label = 'first'), '["G80"]');
SELECT spr.same('nothing was already on a box', (SELECT (answer -> 'already')::text FROM spr.answers WHERE label = 'first'), '[]');
SELECT spr.same('the name never printed is said', (SELECT (answer -> 'no_sticker')::text FROM spr.answers WHERE label = 'first'), '["G90"]');
SELECT spr.same('nothing was held', (SELECT (answer -> 'held')::text FROM spr.answers WHERE label = 'first'), '[]');
SELECT spr.same('five stickers went on boxes', (SELECT answer ->> 'stickers' FROM spr.answers WHERE label = 'first'), '5');
SELECT spr.same('the new boxes are on the job, cages at the place with the where line', spr.one($q$SELECT string_agg(label, ',' ORDER BY label) FROM public.job_containers WHERE job_id = '00000000-0000-0000-0000-0000000732a1' AND kind = 'cage' AND place_id = '00000000-0000-0000-0000-0000000732b1' AND where_note = 'by the north stair' AND retired_at IS NULL$q$), 'G78,G79,G81');
SELECT spr.same('G80 was not made again', spr.one($q$SELECT count(*)::text FROM public.job_containers WHERE upper(label) = 'G80'$q$), '1');
SELECT spr.same('G80''s sticker is on job B''s box', spr.one($q$SELECT container_id::text FROM public.box_stickers WHERE box_name = 'G80'$q$), 'a7320c02-0000-0000-0000-0000000732c2');
SELECT spr.same('both G79 stickers are on the one box', spr.one($q$SELECT count(DISTINCT container_id)::text || ' box, ' || count(*)::text || ' stickers' FROM public.box_stickers WHERE box_name = 'G79' AND container_id IS NOT NULL$q$), '1 box, 2 stickers');
SELECT spr.same('no box was made for G90', spr.one($q$SELECT count(*)::text FROM public.job_containers WHERE upper(label) = 'G90'$q$), '0');
SELECT spr.same('G82 was not in the range and is still blank', spr.one($q$SELECT (container_id IS NULL)::text FROM public.box_stickers WHERE box_name = 'G82'$q$), 'true');
SELECT spr.same('each placing is on record', spr.one($q$SELECT count(*)::text FROM public.box_sticker_events e JOIN public.box_stickers s ON s.id = e.sticker_id WHERE e.kind = 'placed' AND s.box_name IN ('G78', 'G79', 'G80', 'G81')$q$), '5');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The same range again changes nothing and says so; G82 with it is made.
SELECT spr.range('again', '00000000-0000-0000-0000-0000000732a1', ARRAY['G78', 'G79', 'G80', 'G81', 'G82'], 'box', NULL, '');
SELECT spr.same('the four placed are left as they are', (SELECT (answer -> 'already')::text FROM spr.answers WHERE label = 'again'), '["G78", "G79", "G80", "G81"]');
SELECT spr.same('the one left is made', (SELECT (answer -> 'made')::text FROM spr.answers WHERE label = 'again'), '["G82"]');
SELECT spr.same('one sticker went', (SELECT answer ->> 'stickers' FROM spr.answers WHERE label = 'again'), '1');
SELECT spr.same('a box already made keeps its kind', spr.one($q$SELECT kind FROM public.job_containers WHERE label = 'G78' AND retired_at IS NULL$q$), 'cage');
SELECT spr.same('the new one takes the kind of this call', spr.one($q$SELECT kind FROM public.job_containers WHERE label = 'G82' AND retired_at IS NULL$q$), 'box');

-- ---------------------------------------------------------------------------------------------------------------
-- 4. A name held while the rest go on. R1 and R2 are printed, and the bed refuses R1's box with a trigger of its own,
--    standing in for any rule the database may hold against one box: R1 is undone and said, and R2 is made.
SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000732a1', 2, 1, ARRAY['R1', 'R2']);
RESET ROLE;
CREATE FUNCTION spr.refuse_r1() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.label = 'R1' THEN RAISE EXCEPTION 'The bed refuses R1.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER spr_refuse_r1 BEFORE INSERT ON public.job_containers FOR EACH ROW EXECUTE FUNCTION spr.refuse_r1();
SET LOCAL ROLE authenticated;
SELECT spr.range('held', '00000000-0000-0000-0000-0000000732a1', ARRAY['R1', 'R2'], 'cage', NULL, '');
SELECT spr.same('the refused name is held with the database''s words', (SELECT answer -> 'held' -> 0 ->> 'name' || ': ' || (answer -> 'held' -> 0 ->> 'why') FROM spr.answers WHERE label = 'held'), 'R1: The bed refuses R1.');
SELECT spr.same('the rest went on', (SELECT (answer -> 'made')::text FROM spr.answers WHERE label = 'held'), '["R2"]');
SELECT spr.same('the held name''s sticker is still blank', spr.one($q$SELECT (container_id IS NULL)::text FROM public.box_stickers WHERE box_name = 'R1'$q$), 'true');
SELECT spr.same('only the placed sticker is counted', (SELECT answer ->> 'stickers' FROM spr.answers WHERE label = 'held'), '1');
RESET ROLE;
DROP TRIGGER spr_refuse_r1 ON public.job_containers;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Who: a helper on no job is refused at the gate, and a training account is refused.
SELECT spr.as_user('00000000-0000-0000-0000-0000000732d2');
SET LOCAL ROLE authenticated;
SELECT spr.refused('a helper who is not on the job is refused', $q$SELECT public.place_sticker_range('00000000-0000-0000-0000-0000000732a1', ARRAY['R1'])$q$, 'That job is not one you can reach');
RESET ROLE;
SELECT spr.as_user('00000000-0000-0000-0000-0000000732d3');
SET LOCAL ROLE authenticated;
SELECT spr.refused('a training account is refused', $q$SELECT public.place_sticker_range('00000000-0000-0000-0000-0000000732a1', ARRAY['R1'])$q$, 'A training account cannot put a sticker on a box.');
RESET ROLE;

SELECT 'sticker_names PASSED' AS result;
ROLLBACK;
