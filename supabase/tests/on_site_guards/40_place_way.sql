-- Materials on site: a place carries the way to it (punch list #372, step 4). Here, through RLS as a signed-in helper
-- on the job's crew unless it says otherwise: the way is set to a map of the place's own job and to a map of the job's
-- development; a map of another job, a map on no job and a map the writer cannot open are each refused with their
-- reason; a place's name cannot be changed by a direct update, while the way can be cleared; a new place may be made
-- with a way under the same rule; a helper on no crew of the job changes nothing; a map thrown away leaves the place
-- standing with no way; and the office's own code still renames a place. Fixtures made as postgres; everything runs
-- inside one transaction that rolls back. Raises on the first failed assertion; ends with "on_site_guards PASSED".
-- See scripts/pgtest-on-site-guards.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA osw;
CREATE FUNCTION osw.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION osw.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION osw.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the bed reads past RLS (as postgres): the way of a place, by the map's last two characters.
CREATE FUNCTION osw.way(p_place uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT name || ' · ' || COALESCE('map ' || right(painted_map_id::text, 2), 'no way') FROM public.job_places WHERE id = p_place
$$;
GRANT USAGE ON SCHEMA osw TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA osw TO authenticated, service_role;

-- Who: a dev, a helper on both jobs' crews, a helper on no crew.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003724d1', 'dev@way.test'),
  ('00000000-0000-0000-0000-0000003724d2', 'helper@way.test'),
  ('00000000-0000-0000-0000-0000003724d3', 'outsider@way.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000003724d1', 'dev@way.test', 'Way Dev', 'dev'),
  ('00000000-0000-0000-0000-0000003724d2', 'helper@way.test', 'Way Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000003724d3', 'outsider@way.test', 'Way Outsider', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- Where: job A is in a development, job B is in none.
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000003724f1', 'Way bed work', 'JW');
INSERT INTO public.developments (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000003724e1', '00000000-0000-0000-0000-0000003724d1', 'Way Bed Ridge');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, development_id) VALUES
  ('00000000-0000-0000-0000-0000003724a1', '00000000-0000-0000-0000-0000003724d1', '00000000-0000-0000-0000-0000003724f1', 'Way job A', '37241', '00000000-0000-0000-0000-0000003724e1'),
  ('00000000-0000-0000-0000-0000003724a2', '00000000-0000-0000-0000-0000003724d1', '00000000-0000-0000-0000-0000003724f1', 'Way job B', '37242', NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000003724a1', '00000000-0000-0000-0000-0000003724d2'),
  ('00000000-0000-0000-0000-0000003724a2', '00000000-0000-0000-0000-0000003724d2');
INSERT INTO public.job_places (id, job_id, name) VALUES ('00000000-0000-0000-0000-0000003724b1', '00000000-0000-0000-0000-0000003724a1', 'Yard');
-- The maps: on job A, on job B, on job A's development, the helper's own on no job, the dev's own on no job.
INSERT INTO public.painted_maps (id, name, job_id, development_id, created_by) VALUES
  ('00000000-0000-0000-0000-0000003724c1', 'The way to Yard', '00000000-0000-0000-0000-0000003724a1', NULL, '00000000-0000-0000-0000-0000003724d1'),
  ('00000000-0000-0000-0000-0000003724c2', 'Job B way in', '00000000-0000-0000-0000-0000003724a2', NULL, '00000000-0000-0000-0000-0000003724d1'),
  ('00000000-0000-0000-0000-0000003724c3', 'The site gate', NULL, '00000000-0000-0000-0000-0000003724e1', '00000000-0000-0000-0000-0000003724d1'),
  ('00000000-0000-0000-0000-0000003724c4', 'Helper loose map', NULL, NULL, '00000000-0000-0000-0000-0000003724d2'),
  ('00000000-0000-0000-0000-0000003724c5', 'Dev loose map', NULL, NULL, '00000000-0000-0000-0000-0000003724d1');
SELECT osw.same('a place starts with no way', osw.way('00000000-0000-0000-0000-0000003724b1'), 'Yard · no way');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The helper on the crew sets the way.
SELECT osw.as_user('00000000-0000-0000-0000-0000003724d2');
SET LOCAL ROLE authenticated;
UPDATE public.job_places SET painted_map_id = '00000000-0000-0000-0000-0000003724c1' WHERE id = '00000000-0000-0000-0000-0000003724b1';
SELECT osw.same('the way is a map of the place''s own job', osw.way('00000000-0000-0000-0000-0000003724b1'), 'Yard · map c1');
UPDATE public.job_places SET painted_map_id = '00000000-0000-0000-0000-0000003724c3' WHERE id = '00000000-0000-0000-0000-0000003724b1';
SELECT osw.same('or a map of the job''s development', osw.way('00000000-0000-0000-0000-0000003724b1'), 'Yard · map c3');
SELECT osw.refused('a map of another job as the way', $q$UPDATE public.job_places SET painted_map_id = '00000000-0000-0000-0000-0000003724c2' WHERE id = '00000000-0000-0000-0000-0000003724b1'$q$, 'a map of its own job or of its development');
SELECT osw.refused('a map on no job as the way', $q$UPDATE public.job_places SET painted_map_id = '00000000-0000-0000-0000-0000003724c4' WHERE id = '00000000-0000-0000-0000-0000003724b1'$q$, 'a map of its own job or of its development');
SELECT osw.refused('a map the writer cannot open as the way', $q$UPDATE public.job_places SET painted_map_id = '00000000-0000-0000-0000-0000003724c5' WHERE id = '00000000-0000-0000-0000-0000003724b1'$q$, 'not a map you can open');
SELECT osw.refused('renaming a place by a direct update', $q$UPDATE public.job_places SET name = 'Somewhere else' WHERE id = '00000000-0000-0000-0000-0000003724b1'$q$, 'keeps its name and its job');
SELECT osw.refused('moving a place to another job by a direct update', $q$UPDATE public.job_places SET job_id = '00000000-0000-0000-0000-0000003724a2' WHERE id = '00000000-0000-0000-0000-0000003724b1'$q$, 'keeps its name and its job');
SELECT osw.same('no refused write landed', osw.way('00000000-0000-0000-0000-0000003724b1'), 'Yard · map c3');
-- A new place made with a way takes the same rule.
SELECT osw.refused('a new place with another job''s map as its way', $q$INSERT INTO public.job_places (id, job_id, name, painted_map_id) VALUES ('00000000-0000-0000-0000-0000003724b2', '00000000-0000-0000-0000-0000003724a1', 'Roof', '00000000-0000-0000-0000-0000003724c2')$q$, 'a map of its own job or of its development');
INSERT INTO public.job_places (id, job_id, name, painted_map_id) VALUES ('00000000-0000-0000-0000-0000003724b2', '00000000-0000-0000-0000-0000003724a1', 'Roof', '00000000-0000-0000-0000-0000003724c1');
SELECT osw.same('a new place may be made with a way', osw.way('00000000-0000-0000-0000-0000003724b2'), 'Roof · map c1');
-- The way can be cleared.
UPDATE public.job_places SET painted_map_id = NULL WHERE id = '00000000-0000-0000-0000-0000003724b1';
SELECT osw.same('the way can be taken off', osw.way('00000000-0000-0000-0000-0000003724b1'), 'Yard · no way');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A helper on no crew of the job reaches no row.
SELECT osw.as_user('00000000-0000-0000-0000-0000003724d3');
UPDATE public.job_places SET painted_map_id = '00000000-0000-0000-0000-0000003724c1' WHERE id = '00000000-0000-0000-0000-0000003724b1';
RESET ROLE;
SELECT osw.same('a helper on no crew of the job changes nothing', osw.way('00000000-0000-0000-0000-0000003724b1'), 'Yard · no way');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. A map thrown away leaves its places standing, and the office's own code still renames a place.
DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-0000003724c1';
SELECT osw.same('a map thrown away leaves the place with no way', osw.way('00000000-0000-0000-0000-0000003724b2'), 'Roof · no way');
UPDATE public.job_places SET name = 'Roof deck' WHERE id = '00000000-0000-0000-0000-0000003724b2';
SELECT osw.same('the office''s own code still renames a place', osw.way('00000000-0000-0000-0000-0000003724b2'), 'Roof deck · no way');

DO $$ BEGIN RAISE NOTICE 'on_site_guards PASSED'; END $$;
ROLLBACK;
