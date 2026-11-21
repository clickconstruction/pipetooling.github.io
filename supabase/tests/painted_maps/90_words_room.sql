-- Paint a map, room for a description (v2.8186, punch list #413 step 0, migration *_painted_place_words_room): a
-- place's words hold up to 4,000 characters, where the table held them to 200. One check holds the cap, under a name
-- of its own, and the old one is gone. The change opens no new door: whoever may set or change a place may write its
-- words, and nobody else. Fixtures are written as postgres; the tries run as each account under RLS; everything rolls
-- back. Raises on the first failed assertion; ends with "painted_place_words_room PASSED". See
-- scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of the job. Mia and Hal are helpers on the lot's crew: Mia painted the lot's map and
-- set its first place with one line of words.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00004130a001', 'dee@paintedwords.test'),
  ('00000000-0000-0000-0000-00004130a002', 'mia@paintedwords.test'),
  ('00000000-0000-0000-0000-00004130a003', 'hal@paintedwords.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00004130a001', 'dee@paintedwords.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00004130a002', 'mia@paintedwords.test', 'Mia Maker', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00004130a003', 'hal@paintedwords.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-00004130f001', 'Painted words bed work', 'PW');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-00004130b001', '00000000-0000-0000-0000-00004130a001', '00000000-0000-0000-0000-00004130f001', 'Words bed lot', '4131');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00004130b001', '00000000-0000-0000-0000-00004130a002'),
  ('00000000-0000-0000-0000-00004130b001', '00000000-0000-0000-0000-00004130a003');
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-00004130c001', 'Lot way in', '00000000-0000-0000-0000-00004130b001', '00000000-0000-0000-0000-00004130a002');
INSERT INTO public.painted_map_places (id, map_id, name, words, lat, lng, set_by) VALUES
  ('00000000-0000-0000-0000-00004130e001', '00000000-0000-0000-0000-00004130c001', 'Truck gate', 'Close it behind you', 29.5, -98.2, '00000000-0000-0000-0000-00004130a002');

CREATE SCHEMA pmw;
GRANT USAGE ON SCHEMA pmw TO authenticated, anon;
CREATE FUNCTION pmw.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION pmw.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (23514 is a check, 42501 a refusal).
CREATE FUNCTION pmw.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmw TO authenticated, anon;

-- The structure.
SELECT pmw.same('one check holds a place''s words, by its own name', (
  SELECT string_agg(conname, ', ' ORDER BY conname) FROM pg_constraint
  WHERE conrelid = 'public.painted_map_places'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ~ 'length\(words\)'
), 'painted_map_places_words_room');
SELECT pmw.same('and it lets 4,000 characters through', (
  SELECT (pg_get_constraintdef(oid) ~ '4000')::text FROM pg_constraint
  WHERE conrelid = 'public.painted_map_places'::regclass AND conname = 'painted_map_places_words_room'
), 'true');
SELECT pmw.same('the words are still required, and empty when nobody wrote any', (
  SELECT is_nullable || ' ' || column_default FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'painted_map_places' AND column_name = 'words'
), 'NO ''''::text');
SELECT pmw.same('a place from before keeps its one line', (
  SELECT words FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004130e001'
), 'Close it behind you');

-- Hal, on the crew, describes places of his own.
SET LOCAL ROLE authenticated;
SELECT pmw.sign_in('00000000-0000-0000-0000-00004130a003');
SELECT pmw.same('a description of 201 characters is kept, where the table refused it', pmw.try($q$
  INSERT INTO public.painted_map_places (id, map_id, name, words, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00004130e002', '00000000-0000-0000-0000-00004130c001', 'Buried sewer line', repeat('a', 201), 29.5001, -98.2001, '00000000-0000-0000-0000-00004130a003')
$q$), 'rows 1');
SELECT pmw.same('and reads back whole', (
  SELECT length(words)::text FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00004130e002'
), '201');
SELECT pmw.same('a description of 4,000 characters is kept', pmw.try($q$
  INSERT INTO public.painted_map_places (map_id, name, words, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00004130c001', 'Long one', repeat('b', 4000), 29.5002, -98.2002, '00000000-0000-0000-0000-00004130a003')
$q$), 'rows 1');
SELECT pmw.same('one of 4,001 is refused', pmw.try($q$
  INSERT INTO public.painted_map_places (map_id, name, words, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00004130c001', 'Too long', repeat('c', 4001), 29.5003, -98.2003, '00000000-0000-0000-0000-00004130a003')
$q$), '23514');
SELECT pmw.same('a place with no words is still a place', pmw.try($q$
  INSERT INTO public.painted_map_places (map_id, name, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00004130c001', 'The slab', 29.5004, -98.2004, '00000000-0000-0000-0000-00004130a003')
$q$), 'rows 1');

-- The room opens no new door.
SELECT pmw.same('Hal lengthens the words of his own place', pmw.try($q$
  UPDATE public.painted_map_places SET words = repeat('d', 1200) WHERE id = '00000000-0000-0000-0000-00004130e002'
$q$), 'rows 1');
SELECT pmw.same('Hal cannot write over Mia''s words', pmw.try($q$
  UPDATE public.painted_map_places SET words = repeat('e', 300) WHERE id = '00000000-0000-0000-0000-00004130e001'
$q$), 'rows 0');
SELECT pmw.same('nor past the cap on his own', pmw.try($q$
  UPDATE public.painted_map_places SET words = repeat('f', 4001) WHERE id = '00000000-0000-0000-0000-00004130e002'
$q$), '23514');
SELECT pmw.sign_in('00000000-0000-0000-0000-00004130a002');
SELECT pmw.same('Mia lengthens her own', pmw.try($q$
  UPDATE public.painted_map_places SET words = repeat('g', 300) WHERE id = '00000000-0000-0000-0000-00004130e001'
$q$), 'rows 1');
SELECT pmw.sign_in('00000000-0000-0000-0000-00004130a001');
SELECT pmw.same('the office changes the words of another person''s place', pmw.try($q$
  UPDATE public.painted_map_places SET words = repeat('h', 2500) WHERE id = '00000000-0000-0000-0000-00004130e001'
$q$), 'rows 1');
RESET ROLE;

SELECT pmw.same('what the map keeps', (
  SELECT string_agg(name || ' ' || length(words), ', ' ORDER BY name) FROM public.painted_map_places
  WHERE map_id = '00000000-0000-0000-0000-00004130c001'
), 'Buried sewer line 1200, Long one 4000, The slab 0, Truck gate 2500');

SELECT 'painted_place_words_room PASSED';
ROLLBACK;
