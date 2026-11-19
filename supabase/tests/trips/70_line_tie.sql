-- A trip put back is tied to its line again (migration *_trip_line_tie): the trip's capture is its own and keeps the
-- line it held; a dry run of the save ties nothing; a put back ties the line, and a second press is answered as a
-- duplicate; a line removed while the trip was gone is not made again; a line another trip took meanwhile is left
-- alone; the dev's own restore ties the line too; and a trip that held no line keeps no id. Fixtures are written as
-- postgres; presses run as each user; everything rolls back. Raises on the first failed assertion; ends with
-- "trips line tie PASSED". See scripts/pgtest-trips.sh. Never against prod. Every name and figure here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Marcus is a master and leads the job. Devon is a dev.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000007860a2', 'marcus@triptie.test'),
  ('00000000-0000-0000-0000-0000007860a7', 'devon@triptie.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000007860a2', 'marcus@triptie.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000007860a7', 'devon@triptie.test', 'Devon Dev', 'dev', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA tie;
CREATE FUNCTION tie.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tie.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- An Extra trip on Heron Point with its work on the lodge job.
CREATE FUNCTION tie.payload(p_id uuid, p_purpose text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'id', p_id, 'development_id', '00000000-0000-0000-0000-0000007860d1', 'purpose', p_purpose, 'asked_by', 'them',
    'asked_who', 'Walt, the super', 'asked_how', 'by phone', 'billing', 'extra',
    'people', jsonb_build_array(jsonb_build_object('name', 'Luis Lead', 'days', jsonb_build_object('2026-10-26', 'site', '2026-10-27', 'site'))),
    'job_ids', jsonb_build_array('00000000-0000-0000-0000-0000007860b1'))
$$;
-- What the app sends to put a listed trip back: the trip as trip_save takes it.
CREATE FUNCTION tie.back(p_item jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT (t - 'trip_people' - 'trip_jobs' - 'created_at') || jsonb_build_object(
    'people', COALESCE((SELECT jsonb_agg(jsonb_build_object('person_id', e->'person_id', 'user_id', e->'user_id', 'name', e->>'person_name', 'days', e->'days')) FROM jsonb_array_elements(t->'trip_people') AS e), '[]'::jsonb),
    'job_ids', COALESCE((SELECT jsonb_agg(e->>'job_id') FROM jsonb_array_elements(t->'trip_jobs') AS e), '[]'::jsonb))
  FROM (SELECT p_item->'trip' AS t) AS s
$$;
-- The listed entry of one deleted trip.
CREATE FUNCTION tie.listed(p_trip uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT e FROM jsonb_array_elements(public.trip_deleted_list('00000000-0000-0000-0000-0000007860d1')) AS e WHERE e->'trip'->>'id' = p_trip::text
$$;
-- The lodge job's lines in order, each with the last two characters of the trip it is tied to. Read as postgres.
CREATE FUNCTION tie.lines() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(f.name || CASE WHEN f.trip_id IS NULL THEN '' ELSE ' [' || right(f.trip_id::text, 2) || ']' END, ' | ' ORDER BY f.sequence_order), 'no lines')
  FROM public.jobs_ledger_fixtures f WHERE f.job_id = '00000000-0000-0000-0000-0000007860b1'
$$;
GRANT USAGE ON SCHEMA tie TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tie TO authenticated, anon;

INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000007860d1', '00000000-0000-0000-0000-0000007860a2', 'Heron Point');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000007860f9', 'Trip Tie Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000007860b1', '00000000-0000-0000-0000-0000007860a2', '00000000-0000-0000-0000-0000007860f9', 'Heron Point Lodge', '00000000-0000-0000-0000-0000007860d1');
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, count, sequence_order, line_unit_price, line_kind) VALUES
  ('00000000-0000-0000-0000-0000007860c1', '00000000-0000-0000-0000-0000007860b1', 'Bid price', 1, 0, 90000, 'work');
UPDATE public.jobs_ledger SET revenue = 90000 WHERE id = '00000000-0000-0000-0000-0000007860b1';

-- 0 · The trip's capture is its own now, under the archive's own trigger name.
SELECT tie.same('trips carries its own capture', (SELECT g.tgfoid::regproc::text FROM pg_trigger g WHERE g.tgname = 'zzz_archive_on_delete' AND g.tgrelid = 'public.trips'::regclass), 'trips_archive_on_delete');

-- 1 · Marcus keeps an Extra trip and puts it on the lodge job's lines.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
SELECT tie.same('a trip is kept', (SELECT r->>'did' || ' ' || (r->>'trip_number') FROM public.trip_save(tie.payload('00000000-0000-0000-0000-0000007860e1', 'Reset the riser'), false) AS r), 'added 1');
SELECT tie.same('and put on the job''s lines', (SELECT COALESCE(r->>'duplicate', 'false') FROM public.trip_put_on_job_line('00000000-0000-0000-0000-0000007860e1', '00000000-0000-0000-0000-0000007860b1', 6800, 'Trip 1 line', 'Reset the riser. Asked by Walt, by phone.', false) AS r), 'false');
RESET ROLE;
SELECT tie.same('the line carries the trip', tie.lines(), 'Bid price | Trip 1 line [e1]');

-- 2 · He deletes the trip. The line stays, untied, and the trip's capture keeps the line's id.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007860e1';
RESET ROLE;
SELECT tie.same('the line outlives its trip, untied', tie.lines(), 'Bid price | Trip 1 line');
SELECT tie.same('the trip''s capture keeps the line it held', (SELECT (a.row_data->>'held_line_id' = (SELECT f.id::text FROM public.jobs_ledger_fixtures f WHERE f.name = 'Trip 1 line'))::text FROM public.deleted_records_archive a WHERE a.table_name = 'trips' AND a.record_id = '00000000-0000-0000-0000-0000007860e1' AND a.restored_at IS NULL), 'true');

-- 3 · A dry run of the put back ties nothing.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
SELECT tie.same('a dry run of the put back writes nothing', (SELECT r->>'dry_run' FROM public.trip_save(tie.back(tie.listed('00000000-0000-0000-0000-0000007860e1')), true) AS r), 'true');
RESET ROLE;
SELECT tie.same('and ties nothing', tie.lines(), 'Bid price | Trip 1 line');

-- 4 · Put back: the line is tied again, so a second press is answered as a duplicate and adds no line.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
SELECT tie.same('the trip is put back with its number', (SELECT r->>'did' || ' ' || (r->>'trip_number') FROM public.trip_save(tie.back(tie.listed('00000000-0000-0000-0000-0000007860e1')), false) AS r), 'added 1');
RESET ROLE;
SELECT tie.same('a trip put back is tied to its line again', tie.lines(), 'Bid price | Trip 1 line [e1]');
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
SELECT tie.same('so a second press is a duplicate', (SELECT COALESCE(r->>'duplicate', 'false') FROM public.trip_put_on_job_line('00000000-0000-0000-0000-0000007860e1', '00000000-0000-0000-0000-0000007860b1', 6800, 'Trip 1 line again', 'A second line that must not be.', false) AS r), 'true');
RESET ROLE;
SELECT tie.same('and adds no line', tie.lines(), 'Bid price | Trip 1 line [e1]');

-- 5 · A line removed while the trip was gone is not made again, and the trip is free to be put on a bill.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007860e1';
RESET ROLE;
DELETE FROM public.jobs_ledger_fixtures WHERE name = 'Trip 1 line';
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
SELECT tie.same('the trip goes back though its line is gone', (SELECT r->>'did' FROM public.trip_save(tie.back(tie.listed('00000000-0000-0000-0000-0000007860e1')), false) AS r), 'added');
SELECT tie.same('a dry run of the press says it is no duplicate', (SELECT COALESCE(r->>'duplicate', 'false') FROM public.trip_put_on_job_line('00000000-0000-0000-0000-0000007860e1', '00000000-0000-0000-0000-0000007860b1', 6800, 'Trip 1 second line', 'Reset the riser.', true) AS r), 'false');
RESET ROLE;
SELECT tie.same('a removed line is not made again', tie.lines(), 'Bid price');

-- 6 · A line another trip took while this one was gone is left with that trip.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
SELECT tie.same('the trip is on the lines again', (SELECT COALESCE(r->>'duplicate', 'false') FROM public.trip_put_on_job_line('00000000-0000-0000-0000-0000007860e1', '00000000-0000-0000-0000-0000007860b1', 6800, 'Trip 1 second line', 'Reset the riser.', false) AS r), 'false');
SELECT tie.same('a second trip is kept', (SELECT r->>'did' || ' ' || (r->>'trip_number') FROM public.trip_save(tie.payload('00000000-0000-0000-0000-0000007860e2', 'Move the cleanouts'), false) AS r), 'added 2');
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007860e1';
RESET ROLE;
UPDATE public.jobs_ledger_fixtures SET trip_id = '00000000-0000-0000-0000-0000007860e2' WHERE name = 'Trip 1 second line';
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
SELECT tie.same('the first trip goes back', (SELECT r->>'did' FROM public.trip_save(tie.back(tie.listed('00000000-0000-0000-0000-0000007860e1')), false) AS r), 'added');
RESET ROLE;
SELECT tie.same('a line another trip took is left with that trip', tie.lines(), 'Bid price | Trip 1 second line [e2]');

-- 7 · The dev's own restore ties the line too.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a7');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007860e2';
RESET ROLE;
SELECT tie.same('the second trip is gone and its line untied', tie.lines(), 'Bid price | Trip 1 second line');
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a7');
SET LOCAL ROLE authenticated;
SELECT tie.same('the dev''s restore takes the trip''s bundle', (SELECT r->>'ok' FROM public.restore_deleted_records('00000000-0000-0000-0000-0000007860e2', false) AS r), 'true');
RESET ROLE;
SELECT tie.same('and ties the line again', tie.lines(), 'Bid price | Trip 1 second line [e2]');

-- 8 · A trip that held no line keeps no id.
SELECT tie.as_user('00000000-0000-0000-0000-0000007860a2');
SET LOCAL ROLE authenticated;
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000007860e1';
RESET ROLE;
SELECT tie.same('a trip that held no line keeps no id', (SELECT (a.row_data ? 'held_line_id')::text FROM public.deleted_records_archive a WHERE a.table_name = 'trips' AND a.record_id = '00000000-0000-0000-0000-0000007860e1' AND a.restored_at IS NULL), 'false');

DO $$ BEGIN RAISE NOTICE 'trips line tie PASSED'; END $$;
ROLLBACK;
