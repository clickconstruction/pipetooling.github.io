SET lock_timeout = '3s';

-- Materials on site: what a teammate may change (v2.7240, punch list #344 PR 5).
--
-- The gate on the on-site tables, on_site_can_touch_job, says WHICH JOB a person may write. It never said WHICH
-- COLUMNS. The review of 2026-11-13 found four things the tables let anyone on a job's team do by hand, none of them
-- from a screen:
--
--   1. A box photo's row could be pointed at any Drive file. The taker may update their own row, every column of it,
--      drive_file_id among them, and the public box page streams whatever file that id names through the app's own
--      service account. storage_path was as free: it could name another job's object in the bucket, which the page
--      would stream and the sweep would file under this job and delete.
--   2. A box's job_id could be changed by a direct update, leaving its ledger rows under the old job: the split
--      v2.6808 closed for every other door.
--   3. The ledger's who and when were whatever the phone sent. by_user_id and by_name could name a teammate, and a
--      clock that ran ahead put a row after presses made later, where a count would swallow them.
--   4. Nothing recorded when a row reached the office, which is not when it was pressed once a press can wait on the
--      phone for signal (v2.7173).
--
-- This file adds triggers, one nullable column and one helper. It creates no table and changes no policy. Each guard
-- speaks only to a direct caller (current_user is authenticated or anon, the stage checklists' own test): the photo
-- sweep and the box page run as the service role, a combine and a job move run inside definer functions, and none of
-- them is touched. Idempotent: CREATE OR REPLACE throughout, ADD COLUMN IF NOT EXISTS.
--
--   on_site_caller_name()                      the signed-in caller's own name from users, for the who of a row
--   job_material_movements.recorded_at         when the row reached the office; null on rows from before this file
--   job_material_movements_stamp               BEFORE INSERT: recorded_at for everyone; for a direct caller the who
--                                              is the caller and a time ahead of the server's is the server's
--   job_container_moves_stamp                  BEFORE INSERT: the same who and when for a box's own move
--   job_box_photos_guard                       BEFORE INSERT OR UPDATE: the who is the caller; only the sweep files a
--                                              photo; the bucket path is the photo's own
--   job_containers_keep_job                    BEFORE UPDATE OF job_id: a box changes job through a combine or the
--                                              office's move, never by a direct update
--
-- A dev's by_name is kept as sent: the dev seat writes "<agent> · MCP as <dev>" through dev_on_site_write, which
-- runs as the dev, so the crew's History says an agent made the row. Its by_user_id is still the dev.

-- ---------------------------------------------------------------------------------------------------------------
-- 0. The caller's own name.
CREATE OR REPLACE FUNCTION public.on_site_caller_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE((SELECT left(btrim(u.name), 120) FROM public.users u WHERE u.id = auth.uid()), '')
$fn$;
COMMENT ON FUNCTION public.on_site_caller_name() IS 'Materials on site (#344): the signed-in caller''s own name, for the who of a ledger row, a box move and a box photo. Definer, so a role that cannot read users still gets its own name and nothing else.';
REVOKE EXECUTE ON FUNCTION public.on_site_caller_name() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_caller_name() FROM anon;
GRANT EXECUTE ON FUNCTION public.on_site_caller_name() TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The ledger: when a row reached the office, and who made it.
ALTER TABLE public.job_material_movements ADD COLUMN IF NOT EXISTS recorded_at timestamptz;
COMMENT ON COLUMN public.job_material_movements.recorded_at IS
  'Materials on site (#344): when the row reached the office, stamped by the database. `at` is when it was pressed, which is earlier for a press that waited on the phone for signal. Null on rows written before 2026-11-13.';

CREATE OR REPLACE FUNCTION public.on_site_stamp_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_name text;
BEGIN
  NEW.recorded_at := now();
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.by_user_id := auth.uid();
    -- A press that waited on the phone carries its own, earlier time, and keeps it. A time ahead of the server's is a
    -- phone whose clock runs fast: left alone it sorts after presses made later, and a count there swallows them.
    IF NEW.at IS NULL OR NEW.at > now() THEN
      NEW.at := now();
    END IF;
    IF NOT public.is_dev() THEN
      v_name := public.on_site_caller_name();
      IF v_name <> '' THEN
        NEW.by_name := v_name;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.on_site_stamp_movement() IS 'Materials on site (#344): a new ledger row is stamped with when it reached the office. From a direct caller its by_user_id is the caller, its by_name the caller''s own name (a dev''s is kept, for the dev seat''s agent label), and a time ahead of the server''s becomes the server''s.';
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_movement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_movement() FROM authenticated;

CREATE OR REPLACE TRIGGER job_material_movements_stamp BEFORE INSERT ON public.job_material_movements
  FOR EACH ROW EXECUTE FUNCTION public.on_site_stamp_movement();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A box's own move: the same who and when.
CREATE OR REPLACE FUNCTION public.on_site_stamp_box_move()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_name text;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.by_user_id := auth.uid();
    IF NEW.at IS NULL OR NEW.at > now() THEN
      NEW.at := now();
    END IF;
    IF NOT public.is_dev() THEN
      v_name := public.on_site_caller_name();
      IF v_name <> '' THEN
        NEW.by_name := v_name;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.on_site_stamp_box_move() IS 'Materials on site (#344): from a direct caller a box move''s by_user_id is the caller, its by_name the caller''s own name (a dev''s is kept), and a time ahead of the server''s becomes the server''s.';
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_box_move() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_box_move() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_box_move() FROM authenticated;

CREATE OR REPLACE TRIGGER job_container_moves_stamp BEFORE INSERT ON public.job_container_moves
  FOR EACH ROW EXECUTE FUNCTION public.on_site_stamp_box_move();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. A box photo: the phone writes that a shot exists, where its bytes wait and how it stands. The sweep writes the
--    rest. The bucket path is the photo's own: <a job's id>/<this photo's id>.jpg, so it can name no other shot.
CREATE OR REPLACE FUNCTION public.on_site_guard_box_photo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_name text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.by_user_id := auth.uid();
    IF NOT public.is_dev() THEN
      v_name := public.on_site_caller_name();
      IF v_name <> '' THEN
        NEW.by_name := v_name;
      END IF;
    END IF;
    IF NEW.drive_file_id IS NOT NULL OR NEW.filed_at IS NOT NULL OR NEW.status = 'filed' THEN
      RAISE EXCEPTION 'A box photo is filed in Drive by the app, never by the phone.' USING ERRCODE = '42501';
    END IF;
    NEW.fail_why := NULL;
    NEW.refile_due_at := NULL;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.container_id IS DISTINCT FROM OLD.container_id
       OR NEW.by_user_id IS DISTINCT FROM OLD.by_user_id THEN
      RAISE EXCEPTION 'A box photo keeps its box, its job and who took it.' USING ERRCODE = '42501';
    END IF;
    IF NEW.drive_file_id IS DISTINCT FROM OLD.drive_file_id
       OR NEW.filed_at IS DISTINCT FROM OLD.filed_at
       OR NEW.refile_due_at IS DISTINCT FROM OLD.refile_due_at
       OR NEW.fail_why IS DISTINCT FROM OLD.fail_why
       OR (NEW.status = 'filed' AND OLD.status IS DISTINCT FROM 'filed') THEN
      RAISE EXCEPTION 'A box photo is filed in Drive by the app, never by the phone.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.storage_path IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.storage_path IS DISTINCT FROM OLD.storage_path)
     AND NEW.storage_path !~ ('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' || NEW.id::text || '\.jpg$') THEN
    RAISE EXCEPTION 'A box photo''s place in the bucket is its own: a job''s id, then the photo''s id.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.on_site_guard_box_photo() IS 'Materials on site (#344): what a direct caller may write on a box photo. The who is the caller. Its box, its job and its taker never change. drive_file_id, filed_at, refile_due_at, fail_why and the status filed are the sweep''s. storage_path is <a job id>/<this photo''s id>.jpg. The service role and definer functions pass untouched.';
REVOKE EXECUTE ON FUNCTION public.on_site_guard_box_photo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_guard_box_photo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_site_guard_box_photo() FROM authenticated;

CREATE OR REPLACE TRIGGER job_box_photos_guard BEFORE INSERT OR UPDATE ON public.job_box_photos
  FOR EACH ROW EXECUTE FUNCTION public.on_site_guard_box_photo();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. A box keeps its job. on_site_carry_job, inside the whole-job combine and the dev seat's move, is the one way a
--    box changes job, and it takes the box's ledger, moves and photos with it.
CREATE OR REPLACE FUNCTION public.on_site_keep_container_job()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.job_id IS DISTINCT FROM OLD.job_id THEN
    RAISE EXCEPTION 'A box changes job only when its job is combined or moved by the office.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.on_site_keep_container_job() IS 'Materials on site (#344): a direct update cannot change a cage''s or a box''s job, which would leave its ledger under the old one. on_site_carry_job, inside the combine and the dev seat''s move, still does.';
REVOKE EXECUTE ON FUNCTION public.on_site_keep_container_job() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_keep_container_job() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_site_keep_container_job() FROM authenticated;

CREATE OR REPLACE TRIGGER job_containers_keep_job BEFORE UPDATE OF job_id ON public.job_containers
  FOR EACH ROW EXECUTE FUNCTION public.on_site_keep_container_job();
