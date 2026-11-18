-- Paint a map, a job's own list of places (v2.7792, punch list #393 reading C, migration *_painted_map_job_list): a
-- painted map can be marked as its job's list. The mark opens no new door: whoever may paint a map for a job may
-- start its list, anyone on the crew adds a place to it, and it is renamed, unmarked and thrown away by its maker
-- and the office alone. The table holds a job to no count of lists, so a second one is kept, and a job that goes
-- leaves its list standing on no job. Fixtures are written as postgres; the tries run as each account under RLS;
-- everything rolls back. Raises on the first failed assertion; ends with "painted_map_job_list PASSED". See
-- scripts/pgtest-painted-maps.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the master of the job. Mia and Hal are helpers on the lot's crew, and Mia painted the lot's map
-- before a map could be a list. Hank is a helper on no crew.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00003931a001', 'dee@paintedlist.test'),
  ('00000000-0000-0000-0000-00003931a002', 'mia@paintedlist.test'),
  ('00000000-0000-0000-0000-00003931a003', 'hal@paintedlist.test'),
  ('00000000-0000-0000-0000-00003931a004', 'hank@paintedlist.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00003931a001', 'dee@paintedlist.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00003931a002', 'mia@paintedlist.test', 'Mia Maker', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00003931a003', 'hal@paintedlist.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00003931a004', 'hank@paintedlist.test', 'Hank Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-00003931f001', 'Painted list bed work', 'PJ');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-00003931b001', '00000000-0000-0000-0000-00003931a001', '00000000-0000-0000-0000-00003931f001', 'List bed lot', '3941');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-00003931b001', '00000000-0000-0000-0000-00003931a002'),
  ('00000000-0000-0000-0000-00003931b001', '00000000-0000-0000-0000-00003931a003');
INSERT INTO public.painted_maps (id, name, job_id, created_by) VALUES
  ('00000000-0000-0000-0000-00003931c001', 'Lot way in', '00000000-0000-0000-0000-00003931b001', '00000000-0000-0000-0000-00003931a002');

CREATE SCHEMA pmj;
GRANT USAGE ON SCHEMA pmj TO authenticated, anon;
CREATE FUNCTION pmj.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION pmj.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (42501 is a refusal).
CREATE FUNCTION pmj.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The lists the caller reads, by name and how many places each holds: 'none' for no list.
CREATE FUNCTION pmj.lists() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(m.name || ' ' || (SELECT count(*) FROM public.painted_map_places p WHERE p.map_id = m.id)::text, ', ' ORDER BY m.name, m.id), 'none')
  FROM public.painted_maps m WHERE m.job_list
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmj TO authenticated, anon;

-- The structure.
SELECT pmj.same('the mark is a yes or no that starts at no', (
  SELECT data_type || ' ' || is_nullable || ' ' || column_default FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'painted_maps' AND column_name = 'job_list'
), 'boolean NO false');
SELECT pmj.same('a map painted before the column is not a list', (
  SELECT job_list::text FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00003931c001'
), 'false');

-- Hal, on the crew, starts the job's list and sets a place on it.
SET LOCAL ROLE authenticated;
SELECT pmj.sign_in('00000000-0000-0000-0000-00003931a003');
SELECT pmj.same('Hal starts the job''s list', pmj.try($q$
  INSERT INTO public.painted_maps (id, name, job_id, created_by, job_list)
  VALUES ('00000000-0000-0000-0000-00003931c002', 'Places on this job', '00000000-0000-0000-0000-00003931b001', '00000000-0000-0000-0000-00003931a003', true)
$q$), 'rows 1');
SELECT pmj.same('Hal sets a place on it', pmj.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003931c002', 'Truck gate', 'gate', 29.5, -98.2, '00000000-0000-0000-0000-00003931a003')
$q$), 'rows 1');

-- Mia, also on the crew, adds to the list Hal started. It is not hers to rename, unmark or throw away.
SELECT pmj.sign_in('00000000-0000-0000-0000-00003931a002');
SELECT pmj.same('Mia reads the list', pmj.lists(), 'Places on this job 1');
SELECT pmj.same('Mia adds a place of her own to it', pmj.try($q$
  INSERT INTO public.painted_map_places (map_id, name, kind, lat, lng, set_by)
  VALUES ('00000000-0000-0000-0000-00003931c002', 'Open trench', 'hazard', 29.5001, -98.2001, '00000000-0000-0000-0000-00003931a002')
$q$), 'rows 1');
SELECT pmj.same('Mia cannot rename Hal''s list', pmj.try($q$
  UPDATE public.painted_maps SET name = 'Mine now' WHERE id = '00000000-0000-0000-0000-00003931c002'
$q$), 'rows 0');
SELECT pmj.same('Mia cannot turn Hal''s list back into a plain map', pmj.try($q$
  UPDATE public.painted_maps SET job_list = false WHERE id = '00000000-0000-0000-0000-00003931c002'
$q$), 'rows 0');
SELECT pmj.same('Mia cannot throw Hal''s list away', pmj.try($q$
  DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00003931c002'
$q$), 'rows 0');
-- The table holds a job to no count of lists: two phones that start one at the same moment both land.
SELECT pmj.same('a second list on the same job is kept, not refused', pmj.try($q$
  INSERT INTO public.painted_maps (id, name, job_id, created_by, job_list)
  VALUES ('00000000-0000-0000-0000-00003931c003', 'Places on this job', '00000000-0000-0000-0000-00003931b001', '00000000-0000-0000-0000-00003931a002', true)
$q$), 'rows 1');
SELECT pmj.same('Mia reads both', pmj.lists(), 'Places on this job 2, Places on this job 0');

-- Hank is on no crew: the mark opens no door for him.
SELECT pmj.sign_in('00000000-0000-0000-0000-00003931a004');
SELECT pmj.same('Hank cannot start a list on a job he is not on', pmj.try($q$
  INSERT INTO public.painted_maps (name, job_id, created_by, job_list)
  VALUES ('Places on this job', '00000000-0000-0000-0000-00003931b001', '00000000-0000-0000-0000-00003931a004', true)
$q$), '42501');
SELECT pmj.same('Hank reads no list', pmj.lists(), 'none');

-- The office reads every list, and may change another person's.
SELECT pmj.sign_in('00000000-0000-0000-0000-00003931a001');
SELECT pmj.same('Dee reads both lists', pmj.lists(), 'Places on this job 2, Places on this job 0');
SELECT pmj.same('Dee throws the empty second list away', pmj.try($q$
  DELETE FROM public.painted_maps WHERE id = '00000000-0000-0000-0000-00003931c003'
$q$), 'rows 1');
RESET ROLE;

-- A job that goes sets its maps' job to null. The list stands, marked, on no job: no check refuses it.
UPDATE public.painted_maps SET job_id = NULL WHERE job_id = '00000000-0000-0000-0000-00003931b001';
SELECT pmj.same('with its job gone the list stands on no job, with its places', (
  SELECT (m.job_id IS NULL)::text || ' ' || m.job_list::text || ' ' || (SELECT count(*) FROM public.painted_map_places p WHERE p.map_id = m.id)::text
  FROM public.painted_maps m WHERE m.id = '00000000-0000-0000-0000-00003931c002'
), 'true true 2');

SELECT 'painted_map_job_list PASSED';
ROLLBACK;
