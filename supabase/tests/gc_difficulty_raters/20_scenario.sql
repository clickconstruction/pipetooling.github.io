-- GC difficulty rating (punch list #357, v2.7468; migration *_gc_difficulty_raters_from_price_list): the rating's
-- insert rule asks the Bid Board's published price list who may rate, and the price list names the estimators.
--
-- The migration ran twice. Version 2 of the price list is version 1's numbers with the estimators named, once. Then
-- every role tries the same save: under version 2 a dev, the owner, an assistant, a controller and an estimator rate,
-- and a primary, a superintendent, a sub, a helper and someone signed out are refused. gc_difficulty_can_rate()
-- answers the same for each. The list is obeyed both ways: with only the estimators named the office and the owner
-- are refused, with nobody named only a dev rates, and with no published list every group may. The fences stand: an
-- estimator in training, a digital twin and an archived estimator are refused though the list names the estimators.
-- A rating is still written once, stamped with who wrote it, and only a dev deletes one.
-- The fixture is made as postgres; each save runs as its user through RLS; everything rolls back. Raises on the
-- first failed assertion; ends with "gc_difficulty_raters PASSED". See scripts/pgtest-gc-difficulty-raters.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
\set dev '00000000-0000-0000-0000-0000003570d1'
\set owner '00000000-0000-0000-0000-0000003570d2'
\set assistant '00000000-0000-0000-0000-0000003570d3'
\set controller '00000000-0000-0000-0000-0000003570d4'
\set estimator '00000000-0000-0000-0000-0000003570d5'
\set primary '00000000-0000-0000-0000-0000003570d6'
\set super '00000000-0000-0000-0000-0000003570d7'
\set sub '00000000-0000-0000-0000-0000003570d8'
\set helper '00000000-0000-0000-0000-0000003570d9'
\set training '00000000-0000-0000-0000-0000003570da'
\set twin '00000000-0000-0000-0000-0000003570db'
\set gone '00000000-0000-0000-0000-0000003570dc'
\set gc '00000000-0000-0000-0000-0000003570c1'
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  (:'dev', 'dev@gdr.test'), (:'owner', 'owner@gdr.test'), (:'assistant', 'assistant@gdr.test'),
  (:'controller', 'controller@gdr.test'), (:'estimator', 'estimator@gdr.test'), (:'primary', 'primary@gdr.test'),
  (:'super', 'super@gdr.test'), (:'sub', 'sub@gdr.test'), (:'helper', 'helper@gdr.test'),
  (:'training', 'training@gdr.test'), (:'twin', 'twin@gdr.test'), (:'gone', 'gone@gdr.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  (:'dev', 'dev@gdr.test', 'Dev', 'dev', false, false, NULL),
  (:'owner', 'owner@gdr.test', 'Owner', 'master_technician', false, false, NULL),
  (:'assistant', 'assistant@gdr.test', 'Assistant', 'assistant', false, false, NULL),
  (:'controller', 'controller@gdr.test', 'Controller', 'controller', false, false, NULL),
  (:'estimator', 'estimator@gdr.test', 'Estimator', 'estimator', false, false, NULL),
  (:'primary', 'primary@gdr.test', 'Primary', 'primary', false, false, NULL),
  (:'super', 'super@gdr.test', 'Super', 'superintendent', false, false, NULL),
  (:'sub', 'sub@gdr.test', 'Sub', 'subcontractor', false, false, NULL),
  (:'helper', 'helper@gdr.test', 'Helper', 'helpers', false, false, NULL),
  (:'training', 'training@gdr.test', 'Training', 'estimator', true, false, NULL),
  (:'twin', 'twin@gdr.test', 'Twin', 'estimator', false, true, NULL),
  (:'gone', 'gone@gdr.test', 'Gone', 'estimator', false, false, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

INSERT INTO public.customers (id, name, master_user_id) VALUES (:'gc', 'Hill Country GC', :'dev');

CREATE SCHEMA gdr;
CREATE FUNCTION gdr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gdr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION gdr.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- The one save every role tries: a rating of the GC under the newest published criteria, one field point and what
-- happened. 'saved' when the row lands, 'refused' when a rule turns the row away, 'training' when training mode's
-- statement block does (its writes go with the refusal); any other error fails the bed.
-- The same statement lands for the roles that may, so a refusal is the rule's and not the statement's.
CREATE FUNCTION gdr.try_rate(p_user uuid, p_customer uuid, p_criteria uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_user IS NULL THEN PERFORM gdr.signed_out(); ELSE PERFORM gdr.as_user(p_user); END IF;
  BEGIN
    INSERT INTO public.gc_difficulty_ratings (customer_id, criteria_version_id, picks, note)
    VALUES (p_customer, p_criteria, '{"field": 1}'::jsonb, 'The site was not ready twice.');
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RETURN 'refused';
    WHEN raise_exception THEN
      -- Training mode's statement trigger speaks before the row is weighed.
      IF SQLERRM LIKE 'Read-only (training) mode%' THEN RETURN 'training'; END IF;
      RAISE;
  END;
  RETURN 'saved';
END $$;
-- Every role's answer in one line, in a fixed order: who saved, and what gc_difficulty_can_rate() told them.
CREATE FUNCTION gdr.who_rates(p_customer uuid, p_criteria uuid, VARIADIC p_people text[]) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  out text := '';
  i integer;
  v_user uuid;
  v_can boolean;
BEGIN
  FOR i IN 1..array_length(p_people, 1) BY 2 LOOP
    v_user := NULLIF(p_people[i + 1], '')::uuid;
    IF v_user IS NULL THEN PERFORM gdr.signed_out(); ELSE PERFORM gdr.as_user(v_user); END IF;
    v_can := public.gc_difficulty_can_rate();
    out := out || p_people[i] || '=' || gdr.try_rate(v_user, p_customer, p_criteria) || CASE WHEN v_can THEN '/yes' ELSE '/no' END || ' ';
  END LOOP;
  RETURN btrim(out);
END $$;
GRANT USAGE ON SCHEMA gdr TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gdr TO anon, authenticated;

SELECT id AS criteria FROM public.difficulty_criteria_versions WHERE status = 'published' ORDER BY version DESC LIMIT 1 \gset

-- 0 · The migration ran twice. Version 2 is version 1's numbers with the estimators named, once, as the app's; no
-- draft is left; the insert rule is the new one and the old one is gone; the function is not for someone signed out
-- of the API role.
SELECT gdr.same('two published versions, no draft',
  (SELECT count(*) FILTER (WHERE status = 'published') || ':' || count(*) FILTER (WHERE status = 'draft') FROM public.difficulty_price_versions), '2:0');
SELECT gdr.same('version 1 as it was seeded',
  (SELECT body->>'raters' FROM public.difficulty_price_versions WHERE version = 1 AND status = 'published'), '["office", "master"]');
SELECT gdr.same('version 2 names the estimators, in the sheet''s order',
  (SELECT body->>'raters' FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published'), '["office", "estimator", "master"]');
SELECT gdr.same('version 2 keeps every number of version 1',
  (SELECT (v2.body - 'raters' = v1.body - 'raters')::text
   FROM public.difficulty_price_versions v1, public.difficulty_price_versions v2
   WHERE v1.version = 1 AND v1.status = 'published' AND v2.version = 2 AND v2.status = 'published'), 'true');
SELECT gdr.same('version 2 is the app''s, with its reason',
  (SELECT published_by_name || ' · ' || (published_by IS NULL)::text || ' · ' || (note LIKE 'Version 1''s numbers, with the estimators added%')::text
   FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published'), 'the app · true · true');
SELECT gdr.same('the insert rules on the ratings',
  (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'gc_difficulty_ratings' AND cmd = 'INSERT' AND permissive = 'PERMISSIVE'),
  'gc_difficulty_ratings_insert_raters');
SELECT gdr.same('the fences are on the table',
  (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'gc_difficulty_ratings' AND permissive = 'RESTRICTIVE'
     AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'read_only_users_cannot_insert')),
  'archived_fence,digital_twin_write_fence_insert,read_only_users_cannot_insert');
SELECT gdr.same('who may call the function',
  has_function_privilege('authenticated', 'public.gc_difficulty_can_rate()', 'EXECUTE') || ':' || has_function_privilege('anon', 'public.gc_difficulty_can_rate()', 'EXECUTE'),
  'true:false');

SET LOCAL ROLE authenticated;

-- 1 · Under version 2 (the list as the migration leaves it): the office, the owner and the estimator rate; the rest
-- are refused. The function and the save agree for every one.
SELECT gdr.same('under version 2',
  gdr.who_rates(:'gc', :'criteria', 'dev', :'dev', 'owner', :'owner', 'assistant', :'assistant', 'controller', :'controller', 'estimator', :'estimator',
    'primary', :'primary', 'super', :'super', 'sub', :'sub', 'helper', :'helper', 'signed-out', ''),
  'dev=saved/yes owner=saved/yes assistant=saved/yes controller=saved/yes estimator=saved/yes primary=refused/no super=refused/no sub=refused/no helper=refused/no signed-out=refused/no');

-- The guard still stamps who and when: the estimator's rating is the newest and carries their name.
SELECT gdr.as_user(:'estimator');
SELECT gdr.same('five ratings, the estimator''s the newest of its own',
  (SELECT count(*) || ' · ' || count(*) FILTER (WHERE rated_by = :'estimator' AND rated_by_name = 'Estimator') FROM public.gc_difficulty_ratings WHERE customer_id = :'gc'),
  '5 · 1');

-- 2 · The fences stand though the list names the estimators: training mode, a digital twin, an archived account.
-- The function reads the role alone, so it answers yes for the first two; the fence is what refuses the row.
SELECT gdr.same('an estimator in training, a twin, an archived estimator',
  gdr.who_rates(:'gc', :'criteria', 'training', :'training', 'twin', :'twin', 'gone', :'gone'),
  'training=training/yes twin=refused/yes gone=refused/yes');

-- 3 · A rating is written once, and only a dev deletes one.
SELECT gdr.as_user(:'estimator');
DO $$
BEGIN
  BEGIN
    UPDATE public.gc_difficulty_ratings SET note = 'Changed.' WHERE rated_by = auth.uid();
    IF FOUND THEN RAISE EXCEPTION 'an estimator changed a rating'; END IF;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  DELETE FROM public.gc_difficulty_ratings WHERE rated_by = auth.uid();
  IF FOUND THEN RAISE EXCEPTION 'an estimator deleted a rating'; END IF;
  RAISE NOTICE 'ok: an estimator neither changes nor deletes a rating';
END $$;

-- 4 · The list is obeyed both ways. Version 3 names only the estimators: the office and the owner are refused and
-- the estimator rates. A dev always may. (The bed writes each version as the database, signed out, the way the
-- migration seeds one: the guard refuses a published row inserted by a person.)
RESET ROLE;
SELECT gdr.signed_out();
INSERT INTO public.difficulty_price_versions (version, status, body, note, published_by_name, published_at)
SELECT 3, 'published', jsonb_set(body, '{raters}', '["estimator"]'::jsonb), 'Bed: only the estimators.', 'the bed', now()
FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published';
SET LOCAL ROLE authenticated;
SELECT gdr.same('only the estimators named',
  gdr.who_rates(:'gc', :'criteria', 'dev', :'dev', 'owner', :'owner', 'assistant', :'assistant', 'controller', :'controller', 'estimator', :'estimator', 'sub', :'sub'),
  'dev=saved/yes owner=refused/no assistant=refused/no controller=refused/no estimator=saved/yes sub=refused/no');

-- Version 4 as version 1 had it, the office and the masters: the estimator reads and is refused, as before v2.7468's
-- list, and now the database says so too.
RESET ROLE;
SELECT gdr.signed_out();
INSERT INTO public.difficulty_price_versions (version, status, body, note, published_by_name, published_at)
SELECT 4, 'published', jsonb_set(body, '{raters}', '["office", "master"]'::jsonb), 'Bed: the office and the masters.', 'the bed', now()
FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published';
SET LOCAL ROLE authenticated;
SELECT gdr.same('the office and the masters named',
  gdr.who_rates(:'gc', :'criteria', 'dev', :'dev', 'owner', :'owner', 'assistant', :'assistant', 'controller', :'controller', 'estimator', :'estimator'),
  'dev=saved/yes owner=saved/yes assistant=saved/yes controller=saved/yes estimator=refused/no');

-- Version 5 names nobody (the sheet refuses to publish that; the database does not): only a dev rates.
RESET ROLE;
SELECT gdr.signed_out();
INSERT INTO public.difficulty_price_versions (version, status, body, note, published_by_name, published_at)
SELECT 5, 'published', jsonb_set(body, '{raters}', '[]'::jsonb), 'Bed: nobody.', 'the bed', now()
FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published';
SET LOCAL ROLE authenticated;
SELECT gdr.same('nobody named',
  gdr.who_rates(:'gc', :'criteria', 'dev', :'dev', 'owner', :'owner', 'assistant', :'assistant', 'estimator', :'estimator'),
  'dev=saved/yes owner=refused/no assistant=refused/no estimator=refused/no');

-- Version 6 carries no list of raters at all: every group may, as the client reads a list with none.
RESET ROLE;
SELECT gdr.signed_out();
INSERT INTO public.difficulty_price_versions (version, status, body, note, published_by_name, published_at)
SELECT 6, 'published', body - 'raters', 'Bed: no raters key.', 'the bed', now()
FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published';
SET LOCAL ROLE authenticated;
SELECT gdr.same('no list of raters',
  gdr.who_rates(:'gc', :'criteria', 'owner', :'owner', 'assistant', :'assistant', 'estimator', :'estimator', 'sub', :'sub'),
  'owner=saved/yes assistant=saved/yes estimator=saved/yes sub=refused/no');

-- 5 · A draft never decides: the owner's half-typed draft naming nobody leaves the published list in force.
RESET ROLE;
SELECT gdr.signed_out();
INSERT INTO public.difficulty_price_versions (version, status, body, note, published_by_name, published_at)
SELECT 7, 'published', body, 'Bed: version 2 again.', 'the bed', now()
FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published';
INSERT INTO public.difficulty_price_versions (status, body, note)
SELECT 'draft', jsonb_set(body, '{raters}', '[]'::jsonb), 'Bed: a draft.' FROM public.difficulty_price_versions WHERE version = 2 AND status = 'published';
SET LOCAL ROLE authenticated;
SELECT gdr.same('a draft naming nobody changes nothing',
  gdr.who_rates(:'gc', :'criteria', 'owner', :'owner', 'estimator', :'estimator'),
  'owner=saved/yes estimator=saved/yes');

-- 6 · Only a dev deletes: the dev clears the bed's ratings and the count says so.
SELECT gdr.as_user(:'dev');
DELETE FROM public.gc_difficulty_ratings WHERE customer_id = :'gc';
SELECT gdr.same('the dev deleted them', (SELECT count(*)::text FROM public.gc_difficulty_ratings WHERE customer_id = :'gc'), '0');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'gc_difficulty_raters PASSED'; END $$;
ROLLBACK;
