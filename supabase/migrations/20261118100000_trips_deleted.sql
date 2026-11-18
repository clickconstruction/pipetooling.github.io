SET lock_timeout = '3s';

-- Deleted trips are kept, and the office can read a site's own (v2.7800).
--
-- A deleted trip was gone for good after the one minute of Undo its toast gave: `trips` was never among the tables
-- the deleted-records archive covers (20260716120000), and the Undo lived in the browser that pressed it. A trip is
-- the record of work past the price (who went, which days, who asked), and since Put on a bill a customer's line can
-- come from one, so one confirm by any of five roles must not be the end of it.
--
-- Four pieces, no new table:
--   1. `trips` joins the archive through its own generic capture, grouped by the trip.
--   2. `trip_people` and `trip_jobs` are captured only when their trip itself went. `trip_save` rewrites both on every
--      save (delete, then insert), and a deleted job takes its trip_jobs rows: neither is a deleted trip, and neither
--      is kept. The test is the trip's own row: on a cascade from the trip it is already gone.
--   3. A trip made again under its own id (the Undo, Put back, the dev's own restore) settles its archive rows, so
--      nothing lists a living trip as deleted.
--   4. `trip_deleted_list(site)`, for the trips office: the site's deleted trips, each whole, in the shape the app
--      reads a trip, with who deleted it and when. Putting one back is `trip_save` under the trip's own id, the same
--      door the Undo uses, so there is no new write.
--
-- The archive's own rules hold: a capture never blocks a delete, rows are to_jsonb(OLD) so the dev's
-- restore_deleted_records works on a trip's bundle, and the daily purge takes rows past 90 days. Additive and
-- idempotent. The live client calls none of this, so the push can come any time after the merge.

-- 1. The trip's own row.
DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.trips;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record();

-- 2. Its people and its jobs, when the trip itself went.
CREATE OR REPLACE FUNCTION public.trip_child_archive_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  j jsonb;
BEGIN
  BEGIN
    -- A cascade from the trip runs after the trip's row is gone. A save that rewrites the rows, and a deleted job
    -- that takes its link, both find the trip still there.
    IF NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = OLD.trip_id) THEN
      j := to_jsonb(OLD);
      INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
      VALUES (TG_TABLE_NAME, j ->> 'id', OLD.trip_id::text, j, auth.uid());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block a delete because archiving failed.
    RAISE WARNING 'trip_child_archive_on_delete failed for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
  END;
  RETURN OLD;
END
$fn$;
ALTER FUNCTION public.trip_child_archive_on_delete() OWNER TO postgres;
COMMENT ON FUNCTION public.trip_child_archive_on_delete() IS 'Trips: BEFORE DELETE on trip_people and trip_jobs. Snapshots the row into deleted_records_archive under its trip, only when the trip itself is gone, so a save that rewrites the rows and a deleted job leave nothing. Never raises.';
REVOKE EXECUTE ON FUNCTION public.trip_child_archive_on_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.trip_people;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.trip_people
  FOR EACH ROW EXECUTE FUNCTION public.trip_child_archive_on_delete();
DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.trip_jobs;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.trip_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trip_child_archive_on_delete();

-- 3. A trip made again settles what the archive holds of it.
CREATE OR REPLACE FUNCTION public.trips_settle_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  BEGIN
    UPDATE public.deleted_records_archive
       SET restored_at = now(), restored_by = auth.uid()
     WHERE group_key = NEW.id::text
       AND table_name IN ('trips', 'trip_people', 'trip_jobs')
       AND restored_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Never block a save because the archive could not be marked.
    RAISE WARNING 'trips_settle_archive failed for trip %: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END
$fn$;
ALTER FUNCTION public.trips_settle_archive() OWNER TO postgres;
COMMENT ON FUNCTION public.trips_settle_archive() IS 'Trips: AFTER INSERT on trips. A trip made again under its own id (the Undo of a delete, Put back, a restore) marks its archive rows restored, so no list offers a living trip. Never raises.';
REVOKE EXECUTE ON FUNCTION public.trips_settle_archive() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trips_settle_archive ON public.trips;
CREATE TRIGGER trips_settle_archive AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_settle_archive();

-- 4. A site's deleted trips, for the trips office.
CREATE OR REPLACE FUNCTION public.trip_deleted_list(p_development_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  -- A definer stands behind the tables' fences, so it holds them itself, as trip_phone does.
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin reads no deleted trip.' USING ERRCODE = '42501';
  END IF;
  -- The roles that read and change every trip. A person on a trip reads that trip, and no deleted one.
  IF NOT public.trips_office() THEN
    RAISE EXCEPTION 'Only the office reads a site''s deleted trips.' USING ERRCODE = '42501';
  END IF;
  IF p_development_id IS NULL THEN
    RAISE EXCEPTION 'Name the site.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(x.item ORDER BY x.deleted_at DESC, x.record_id), '[]'::jsonb)
    INTO v_out
  FROM (
    SELECT d.record_id, d.deleted_at,
      jsonb_build_object(
        'deleted_at', d.deleted_at,
        'deleted_by_name', (SELECT u.name FROM public.users u WHERE u.id = d.deleted_by),
        -- A job the trip named that has since been deleted is left out of the trip, and counted here.
        'jobs_gone', (
          SELECT count(*) FROM public.deleted_records_archive j
          WHERE j.table_name = 'trip_jobs' AND j.group_key = d.record_id AND j.deleted_at = d.deleted_at AND j.restored_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = (j.row_data ->> 'job_id')::uuid)
        ),
        'trip', jsonb_build_object(
          'id', d.record_id,
          'trip_number', d.row_data -> 'trip_number',
          'development_id', d.row_data -> 'development_id',
          'job_id', d.row_data -> 'job_id',
          'purpose', d.row_data -> 'purpose',
          'asked_by', d.row_data -> 'asked_by',
          'asked_who', d.row_data -> 'asked_who',
          'asked_how', d.row_data -> 'asked_how',
          'outcome', d.row_data -> 'outcome',
          'billing', d.row_data -> 'billing',
          'via', d.row_data -> 'via',
          'created_at', d.row_data -> 'created_at',
          -- A roster row or a login that is gone since is a name alone, so the save does not trip on it.
          'trip_people', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                     'person_id', (SELECT pe.id FROM public.people pe WHERE pe.id = NULLIF(p.row_data ->> 'person_id', '')::uuid),
                     'user_id', (SELECT u.id FROM public.users u WHERE u.id = NULLIF(p.row_data ->> 'user_id', '')::uuid),
                     'person_name', p.row_data ->> 'person_name',
                     'days', COALESCE(p.row_data -> 'days', '{}'::jsonb))
                   ORDER BY p.row_data ->> 'person_name', p.record_id)
            FROM public.deleted_records_archive p
            WHERE p.table_name = 'trip_people' AND p.group_key = d.record_id AND p.deleted_at = d.deleted_at AND p.restored_at IS NULL
          ), '[]'::jsonb),
          'trip_jobs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('job_id', j.row_data ->> 'job_id') ORDER BY j.row_data ->> 'job_id')
            FROM public.deleted_records_archive j
            WHERE j.table_name = 'trip_jobs' AND j.group_key = d.record_id AND j.deleted_at = d.deleted_at AND j.restored_at IS NULL
              AND EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = (j.row_data ->> 'job_id')::uuid)
          ), '[]'::jsonb)
        )
      ) AS item
    FROM (
      -- One row a trip: its newest delete that nothing has put back, and only while no trip holds its id.
      -- Its people and jobs above are the ones nothing has put back either: a trip made again settles every row
      -- of its older deletes, so what is left under its id belongs to this delete.
      SELECT DISTINCT ON (a.record_id) a.record_id, a.row_data, a.deleted_at, a.deleted_by
      FROM public.deleted_records_archive a
      WHERE a.table_name = 'trips'
        AND a.restored_at IS NULL
        AND a.record_id IS NOT NULL
        AND a.row_data ->> 'development_id' = p_development_id::text
        AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = a.record_id::uuid)
      ORDER BY a.record_id, a.deleted_at DESC
    ) d
    ORDER BY d.deleted_at DESC
    LIMIT 50
  ) x;

  RETURN v_out;
END
$fn$;
ALTER FUNCTION public.trip_deleted_list(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.trip_deleted_list(uuid) IS 'Trips: a site''s deleted trips that nothing has put back, newest first, at most 50, for the trips office (dev, master_technician, assistant, controller, primary). Each is { deleted_at, deleted_by_name, jobs_gone, trip }, the trip whole in the shape the app reads one (trip_people, trip_jobs), with a job, a roster row or a login that is gone since left out. Read from deleted_records_archive, which keeps a row 90 days. Refuses an archived caller and a digital twin itself. Putting a trip back is trip_save under its own id.';
REVOKE EXECUTE ON FUNCTION public.trip_deleted_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_deleted_list(uuid) TO authenticated, service_role;
