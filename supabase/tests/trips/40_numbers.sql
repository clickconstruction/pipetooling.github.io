-- A number for each trip (migration *_trip_numbers, punch list #379): numbers run 1, 2, 3 on a site in the order trips
-- are made; another site starts at 1; a deleted trip's number is never given to another trip; a deleted trip put back
-- under its own id gets its number back; a number nobody handed out is not taken on request; no statement changes a
-- trip's number; the phone's trip takes a number too; a job that holds its own trip counts by itself; nobody
-- reads the counters; and a trip that moves home takes a number there. Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on
-- the first failed assertion; ends with "trips numbers PASSED". See scripts/pgtest-trips.sh. Never against prod.
-- Every name here is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003792a1', 'dana@tripnumbers.test'),
  ('00000000-0000-0000-0000-0000003792a2', 'marcus@tripnumbers.test'),
  ('00000000-0000-0000-0000-0000003792a3', 'luis@tripnumbers.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003792a1', 'dana@tripnumbers.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003792a2', 'marcus@tripnumbers.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003792a3', 'luis@tripnumbers.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA tnb;
CREATE FUNCTION tnb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tnb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF want <> '' AND position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION tnb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Save a one-day trip for Dana on a home, under an id, and hand back the save's reply.
CREATE FUNCTION tnb.save(p_id uuid, p_home jsonb, p_number integer DEFAULT NULL, p_dry boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.trip_save(jsonb_strip_nulls(p_home || jsonb_build_object('id', p_id, 'trip_number', p_number, 'people', jsonb_build_array(jsonb_build_object('name', 'Dana', 'days', jsonb_build_object('2026-10-31', 'site'))))), p_dry)
$$;
CREATE FUNCTION tnb.numbers(p_dev uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(trip_number::text, ',' ORDER BY trip_number), 'none') FROM public.trips WHERE development_id = p_dev
$$;
GRANT USAGE ON SCHEMA tnb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tnb TO authenticated, anon;

INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000003792d1', '00000000-0000-0000-0000-0000003792a2', 'Heron Point'),
  ('00000000-0000-0000-0000-0000003792d2', '00000000-0000-0000-0000-0000003792a2', 'Egret Landing');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003792f9', 'Trip Numbers Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000003792b1', '00000000-0000-0000-0000-0000003792a2', '00000000-0000-0000-0000-0000003792f9', 'Rough-in: lodge and bunkhouse', '00000000-0000-0000-0000-0000003792d1'),
  ('00000000-0000-0000-0000-0000003792b2', '00000000-0000-0000-0000-0000003792a2', '00000000-0000-0000-0000-0000003792f9', 'A far job on no site', NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000003792b1', '00000000-0000-0000-0000-0000003792a3') ON CONFLICT DO NOTHING;

-- 0 · The new table carries its fences, and nobody but the trigger touches it.
SELECT tnb.same('the counters carry their archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_number_counters' AND policyname = 'archived_fence')::text, '1');
SELECT tnb.same('the counters have no policy of their own that lets anyone in', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_number_counters' AND permissive = 'PERMISSIVE')::text, '0');
SELECT tnb.same('and no grant to a signed-in user', (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'trip_number_counters' AND grantee IN ('anon', 'authenticated'))::text, '0');

SELECT tnb.as_user('00000000-0000-0000-0000-0000003792a1');
SET LOCAL ROLE authenticated;
-- 1 · A dry run of a new trip names no number, and takes none.
SELECT tnb.same('a dry run of a new trip names no number', (SELECT (r ? 'trip_number')::text || ' ' || coalesce(r->>'trip_number', 'none') FROM tnb.save('00000000-0000-0000-0000-0000003792e1', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}', NULL, true) AS r), 'true none');
-- 2 · Numbers run 1, 2, 3 on a site in the order trips are made; another site starts at 1.
SELECT tnb.same('the first trip on a site is Trip 1', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e1', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}') AS r), '1');
SELECT tnb.same('the second is Trip 2', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e2', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}') AS r), '2');
SELECT tnb.same('the third is Trip 3', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e3', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}') AS r), '3');
SELECT tnb.same('another site starts at 1', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e9', '{"development_id": "00000000-0000-0000-0000-0000003792d2"}') AS r), '1');
SELECT tnb.same('a change keeps the trip''s number', (SELECT (r->>'did') || ' ' || (r->>'trip_number') FROM tnb.save('00000000-0000-0000-0000-0000003792e2', '{"development_id": "00000000-0000-0000-0000-0000003792d1", "purpose": "Lift stations"}') AS r), 'changed 2');
SELECT tnb.same('a dry run of a trip that exists names its number', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e2', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}', NULL, true) AS r), '2');
-- 3 · No statement changes a number.
UPDATE public.trips SET trip_number = 77 WHERE id = '00000000-0000-0000-0000-0000003792e1';
SELECT tnb.same('an update that names another number leaves it as it was', tnb.numbers('00000000-0000-0000-0000-0000003792d1'), '1,2,3');
-- 4 · A deleted trip's number is never given to another trip, the highest included.
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003792e3';
SELECT tnb.same('a new trip after the highest was deleted takes the next number, not the freed one', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e4', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}') AS r), '4');
-- 5 · A deleted trip put back under its own id, asking for its number, gets it back.
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003792e2';
SELECT tnb.same('the numbers after the delete', tnb.numbers('00000000-0000-0000-0000-0000003792d1'), '1,4');
SELECT tnb.same('the trip put back has its number again', (SELECT (r->>'did') || ' ' || (r->>'trip_number') FROM tnb.save('00000000-0000-0000-0000-0000003792e2', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}', 2) AS r), 'added 2');
-- 6 · A number asked for that the site never handed out, or that a trip holds, is not taken on request.
SELECT tnb.same('a number never handed out is not taken on request', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e5', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}', 99) AS r), '5');
SELECT tnb.same('a number a trip holds is not taken on request', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e6', '{"development_id": "00000000-0000-0000-0000-0000003792d1"}', 1) AS r), '6');
SELECT tnb.same('the site''s numbers, each once', tnb.numbers('00000000-0000-0000-0000-0000003792d1'), '1,2,4,5,6');
-- 7 · A job that holds its own trip counts by itself.
SELECT tnb.same('a job on no site starts its own count', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792e7', '{"job_id": "00000000-0000-0000-0000-0000003792b2"}') AS r), '1');
SELECT tnb.refused('reading the counters', $q$SELECT count(*) FROM public.trip_number_counters$q$, 'permission denied');
RESET ROLE;

-- 8 · The phone's trip takes the next number, and the phone is told it.
SELECT tnb.as_user('00000000-0000-0000-0000-0000003792a3');
SET LOCAL ROLE authenticated;
SELECT tnb.same('a trip started on the phone', (SELECT r->>'did' FROM public.trip_phone('{"action": "start", "job_id": "00000000-0000-0000-0000-0000003792b1"}'::jsonb) AS r), 'started');
SELECT tnb.same('takes the site''s next number, and the phone is told it', (SELECT s->'mine'->>'trip_number' FROM public.trip_phone_state('00000000-0000-0000-0000-0000003792b1') AS s), '7');
RESET ROLE;
SELECT tnb.same('the counters hold the last number each home handed out', (SELECT string_agg(last_number::text, ',' ORDER BY last_number) FROM public.trip_number_counters WHERE development_id IN ('00000000-0000-0000-0000-0000003792d1', '00000000-0000-0000-0000-0000003792d2') OR job_id = '00000000-0000-0000-0000-0000003792b2'), '1,1,7');

-- 9 · A trip that moves home takes a number there (*_combine_carries_job_held_trip: the combine moves a trip a job
-- holds). It keeps its own when the new home never handed that number out, and takes the next one otherwise.
UPDATE public.trips SET development_id = '00000000-0000-0000-0000-0000003792d2', job_id = NULL WHERE id = '00000000-0000-0000-0000-0000003792e7';
SELECT tnb.same('a trip moved to a site that has handed out its number takes the next one there', (SELECT trip_number::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003792e7'), '2');
UPDATE public.trips SET development_id = '00000000-0000-0000-0000-0000003792d2' WHERE id = '00000000-0000-0000-0000-0000003792e6';
SELECT tnb.same('a trip moved to a site that never handed out its number keeps it', (SELECT trip_number::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003792e6'), '6');
SELECT tnb.as_user('00000000-0000-0000-0000-0000003792a1');
SET LOCAL ROLE authenticated;
SELECT tnb.same('and that site counts on from it', (SELECT r->>'trip_number' FROM tnb.save('00000000-0000-0000-0000-0000003792ec', '{"development_id": "00000000-0000-0000-0000-0000003792d2"}') AS r), '7');
RESET ROLE;
UPDATE public.trips SET development_id = NULL, job_id = '00000000-0000-0000-0000-0000003792b2' WHERE id = '00000000-0000-0000-0000-0000003792e9';
SELECT tnb.same('a trip moved onto a job that has handed out its number takes the job''s next one', (SELECT trip_number::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003792e9'), '2');
UPDATE public.trips SET job_id = '00000000-0000-0000-0000-0000003792b1', purpose = 'Still Trip 1' WHERE id = '00000000-0000-0000-0000-0000003792e1';
SELECT tnb.same('a trip that stays on its site keeps its number, whatever else changes', (SELECT trip_number::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003792e1'), '1');
SELECT tnb.same('the site the trips left keeps its other numbers, and its count', tnb.numbers('00000000-0000-0000-0000-0000003792d1') || ' / ' || (SELECT last_number::text FROM public.trip_number_counters WHERE development_id = '00000000-0000-0000-0000-0000003792d1'), '1,2,4,5,7 / 7');
SELECT tnb.same('the site they moved to holds each number once', tnb.numbers('00000000-0000-0000-0000-0000003792d2'), '2,6,7');

DO $$ BEGIN RAISE NOTICE 'trips numbers PASSED'; END $$;
ROLLBACK;
