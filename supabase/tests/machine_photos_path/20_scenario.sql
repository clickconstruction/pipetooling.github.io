-- The photos table's update policy (v2.6578, migration *_machine_check_photos_update_policy): the person who took a
-- machine check's photo records the bucket path on their own row, changes nothing once the sweep has filed it, and
-- cannot mark it filed themself; another signed-in person updates nothing. Fixtures are written as postgres; the tries
-- run as each account under RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "machine_photos_path PASSED". See scripts/pgtest-machine-photos-path.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Mateo walked the machine and took the photos; Carla is in the office.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000271a0a1', 'mateo@photos.test'),
  ('00000000-0000-0000-0000-00000271a0a2', 'carla@photos.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000271a0a1', 'mateo@photos.test', 'Mateo Walks', 'helpers', false, false),
  ('00000000-0000-0000-0000-00000271a0a2', 'carla@photos.test', 'Carla Office', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.vehicles (id, make, model, kind, unit_label) VALUES
  ('00000000-0000-0000-0000-00000271a0e1', 'Kubota', 'KX040', 'machine', 'E-12');
INSERT INTO public.machine_checks (id, vehicle_id, kind, work_date, by_user_id, by_name) VALUES
  ('00000000-0000-0000-0000-00000271a0c1', '00000000-0000-0000-0000-00000271a0e1', 'pre', current_date, '00000000-0000-0000-0000-00000271a0a1', 'Mateo Walks');
INSERT INTO public.machine_check_photos (id, check_id, vehicle_id, shot, file_name, by_user_id) VALUES
  ('00000000-0000-0000-0000-00000271a0f1', '00000000-0000-0000-0000-00000271a0c1', '00000000-0000-0000-0000-00000271a0e1', 'agreement', 'Mateo Walks · E-12 pre-use agreement.jpg', '00000000-0000-0000-0000-00000271a0a1'),
  ('00000000-0000-0000-0000-00000271a0f2', '00000000-0000-0000-0000-00000271a0c1', '00000000-0000-0000-0000-00000271a0e1', 'front', 'Mateo Walks · E-12 pre-use front.jpg', '00000000-0000-0000-0000-00000271a0a1');
-- The sweep (the service role) filed the front already.
UPDATE public.machine_check_photos
  SET storage_path = '00000000-0000-0000-0000-00000271a0e1/00000000-0000-0000-0000-00000271a0f2.jpg', drive_file_id = 'drive-front', filed_at = now()
  WHERE id = '00000000-0000-0000-0000-00000271a0f2';

CREATE SCHEMA photos_bed;
GRANT USAGE ON SCHEMA photos_bed TO authenticated;
CREATE FUNCTION photos_bed.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION photos_bed.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What a statement does under RLS: 'ok', or the sqlstate it raised.
CREATE FUNCTION photos_bed.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA photos_bed TO authenticated;

-- The structure: the policy is there, for UPDATE, on authenticated, permissive.
SELECT photos_bed.same('the update policy exists on the photos table', (
  SELECT permissive || ' ' || cmd || ' ' || roles::text FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'machine_check_photos' AND policyname = 'machine_check_photos update'
), 'PERMISSIVE UPDATE {authenticated}');

-- Mateo, who took them: records the path on his own unfiled photo, changes nothing on the filed one, cannot mark one filed.
SET ROLE authenticated;
SELECT photos_bed.sign_in('00000000-0000-0000-0000-00000271a0a1');
UPDATE public.machine_check_photos
  SET storage_path = '00000000-0000-0000-0000-00000271a0e1/00000000-0000-0000-0000-00000271a0f1.jpg'
  WHERE id = '00000000-0000-0000-0000-00000271a0f1';
SELECT photos_bed.same('the taker records the path on their own photo', (
  SELECT coalesce(storage_path, '') FROM public.machine_check_photos WHERE id = '00000000-0000-0000-0000-00000271a0f1'
), '00000000-0000-0000-0000-00000271a0e1/00000000-0000-0000-0000-00000271a0f1.jpg');
UPDATE public.machine_check_photos SET storage_path = 'moved.jpg' WHERE id = '00000000-0000-0000-0000-00000271a0f2';
SELECT photos_bed.same('the taker changes nothing once the sweep has filed it', (
  SELECT storage_path FROM public.machine_check_photos WHERE id = '00000000-0000-0000-0000-00000271a0f2'
), '00000000-0000-0000-0000-00000271a0e1/00000000-0000-0000-0000-00000271a0f2.jpg');
SELECT photos_bed.same('the taker cannot mark their photo filed themself', photos_bed.try(
  $q$UPDATE public.machine_check_photos SET filed_at = now() WHERE id = '00000000-0000-0000-0000-00000271a0f1'$q$
), '42501');
SELECT photos_bed.same('the refused mark left the row unfiled', (
  SELECT (filed_at IS NULL)::text FROM public.machine_check_photos WHERE id = '00000000-0000-0000-0000-00000271a0f1'
), 'true');

-- Carla, in the office: updates nothing of Mateo's.
SELECT photos_bed.sign_in('00000000-0000-0000-0000-00000271a0a2');
UPDATE public.machine_check_photos SET storage_path = 'carla.jpg' WHERE id = '00000000-0000-0000-0000-00000271a0f1';
SELECT photos_bed.same('another person updates nothing', (
  SELECT storage_path FROM public.machine_check_photos WHERE id = '00000000-0000-0000-0000-00000271a0f1'
), '00000000-0000-0000-0000-00000271a0e1/00000000-0000-0000-0000-00000271a0f1.jpg');
RESET ROLE;

SELECT 'machine_photos_path PASSED';
ROLLBACK;
