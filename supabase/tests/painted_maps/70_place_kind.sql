-- Paint a map, a place's kind (v2.7775, punch list #393 reading B, migration *_painted_place_kind): a place can say
-- what kind of thing it is, as a short lowercase word, or nothing at all. The list of kinds is the app's, so the
-- column keeps any short lowercase word and refuses the rest. The column opens no new door: whoever may set or
-- change a place may set or change its kind, and nobody else. Fixtures are written as postgres; the tries run as
-- each account under RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "painted_place_kind PASSED". See scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of the job. Mia and Hal are helpers on the lot's crew: Mia painted the lot's map and
-- set its first place, before a place had a kind.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00003930a001', 'dee@paintedkind.test'),
  ('00000000-0000-0000-0000-00003930a002', 'mia@paintedkind.test'),
  ('00000000-0000-0000-0000-00003930a003', 'hal@paintedkind.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00003930a001', 'dee@paintedkind.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00003930a002', 'mia@paintedkind.test', 'Mia Maker', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00003930a003', 'hal@paintedkind.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-00003930f001', 'Painted kind bed work', 'PK');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-00003930b001', '00000000-0000-0000-0000-00003930a001', '00000000-0000-0000-0000-00003930f001', 'Kind bed lot', '3931');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00003930b001', '00000000-0000-0000-0000-00003930a002'),
  ('00000000-0000-0000-0000-00003930b001', '00000000-0000-0000-0000-00003930a003');
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-00003930c001', 'Lot way in', '00000000-0000-0000-0000-00003930b001', '00000000-0000-0000-0000-00003930a002');
INSERT INTO public.painted_map_places (id, map_id, name, lat, lng, set_by) VALUES
  ('00000000-0000-0000-0000-00003930e001', '00000000-0000-0000-0000-00003930c001', 'Truck gate', 29.5, -98.2, '00000000-0000-0000-0000-00003930a002');

CREATE SCHEMA pmk;
GRANT USAGE ON SCHEMA pmk TO authenticated, anon;
CREATE FUNCTION pmk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION pmk.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (23514 is a check, 42501 a refusal).
CREATE FUNCTION pmk.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmk TO authenticated, anon;

-- The structure.
SELECT pmk.same('a place''s kind is a text column that may be empty, with no default', (
  SELECT data_type || ' ' || is_nullable || ' ' || coalesce(column_default, 'no default') FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'painted_map_places' AND column_name = 'kind'
), 'text YES no default');
SELECT pmk.same('one check holds it, by its own name', (
  SELECT count(*)::text FROM pg_constraint
  WHERE conrelid = 'public.painted_map_places'::regclass AND conname = 'painted_map_places_kind_check' AND contype = 'c'
), '1');
SELECT pmk.same('a place from before the column has no kind', (
  SELECT coalesce(kind, 'none') FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00003930e001'
), 'none');

-- Hal, on the crew, sets places of his own.
SET LOCAL ROLE authenticated;
SELECT pmk.sign_in('00000000-0000-0000-0000-00003930a003');
SELECT pmk.same('Hal sets a place with a kind', pmk.try($q$
  INSERT INTO public.painted_map_places (id, map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930e002', '00000000-0000-0000-0000-00003930c001', 'Main shutoff', 'shutoff', 29.5001, -98.2001, '00000000-0000-0000-0000-00003930a003')
$q$), 'rows 1');
SELECT pmk.same('and reads the kind back', (
  SELECT kind FROM public.painted_map_places WHERE id = '00000000-0000-0000-0000-00003930e002'
), 'shutoff');
SELECT pmk.same('a place with no kind is still a place', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'The slab', 29.5002, -98.2002, '00000000-0000-0000-0000-00003930a003')
$q$), 'rows 1');
SELECT pmk.same('a kind the app does not know yet is kept, being a short lowercase word', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'Hydrant', 'fire_hydrant', 29.5003, -98.2003, '00000000-0000-0000-0000-00003930a003')
$q$), 'rows 1');

-- The check.
SELECT pmk.same('a kind with a capital is refused', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'Bad one', 'Gate', 29.5, -98.2, '00000000-0000-0000-0000-00003930a003')
$q$), '23514');
SELECT pmk.same('a kind of two words is refused', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'Bad one', 'truck gate', 29.5, -98.2, '00000000-0000-0000-0000-00003930a003')
$q$), '23514');
SELECT pmk.same('an empty kind is refused: no kind is null', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'Bad one', '', 29.5, -98.2, '00000000-0000-0000-0000-00003930a003')
$q$), '23514');
SELECT pmk.same('a kind of one letter is refused', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'Bad one', 'g', 29.5, -98.2, '00000000-0000-0000-0000-00003930a003')
$q$), '23514');
SELECT pmk.same('a kind of twenty-five letters is refused', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'Bad one', 'abcdefghijklmnopqrstuvwxy', 29.5, -98.2, '00000000-0000-0000-0000-00003930a003')
$q$), '23514');
SELECT pmk.same('a kind of twenty-four letters is kept', pmk.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003930c001', 'Long one', 'abcdefghijklmnopqrstuvwx', 29.5004, -98.2004, '00000000-0000-0000-0000-00003930a003')
$q$), 'rows 1');

-- The column opens no new door.
SELECT pmk.same('Hal changes the kind of his own place', pmk.try($q$
  UPDATE public.painted_map_places SET kind = 'hazard' WHERE id = '00000000-0000-0000-0000-00003930e002'
$q$), 'rows 1');
SELECT pmk.same('Hal takes the kind off again', pmk.try($q$
  UPDATE public.painted_map_places SET kind = NULL WHERE id = '00000000-0000-0000-0000-00003930e002'
$q$), 'rows 1');
SELECT pmk.same('Hal cannot give Mia''s place a kind', pmk.try($q$
  UPDATE public.painted_map_places SET kind = 'gate' WHERE id = '00000000-0000-0000-0000-00003930e001'
$q$), 'rows 0');
SELECT pmk.sign_in('00000000-0000-0000-0000-00003930a002');
SELECT pmk.same('Mia gives her own place a kind', pmk.try($q$
  UPDATE public.painted_map_places SET kind = 'gate' WHERE id = '00000000-0000-0000-0000-00003930e001'
$q$), 'rows 1');
SELECT pmk.sign_in('00000000-0000-0000-0000-00003930a001');
SELECT pmk.same('the office changes the kind of another person''s place', pmk.try($q$
  UPDATE public.painted_map_places SET kind = 'door' WHERE id = '00000000-0000-0000-0000-00003930e001'
$q$), 'rows 1');
RESET ROLE;

SELECT pmk.same('what the map keeps', (
  SELECT string_agg(name || ' ' || coalesce(kind, 'none'), ', ' ORDER BY name) FROM public.painted_map_places
  WHERE map_id = '00000000-0000-0000-0000-00003930c001'
), 'Hydrant fire_hydrant, Long one abcdefghijklmnopqrstuvwx, Main shutoff none, The slab none, Truck gate door');

SELECT 'painted_place_kind PASSED';
ROLLBACK;
