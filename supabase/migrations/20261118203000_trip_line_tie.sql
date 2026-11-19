SET lock_timeout = '3s';

-- A trip put back is tied to its line again (v2.7860).
--
-- A trip's line on a job carries the trip's id (`jobs_ledger_fixtures.trip_id`, 20261118060000), and deleting the
-- trip clears it (`ON DELETE SET NULL`). The Undo of a delete and Put back (20261118100000) both make the trip again
-- under its own id, and until now neither tied the line back. The trip then read *Extra · not billed yet* with its
-- old line still on the job, and **Put on a bill** would add a second line for the same work.
--
-- Two changes, both to what the trips tables already do on a delete and on an insert. No table, column or index is
-- added, and the lines table is not altered:
--   1. The trip's own capture keeps the id of the line it held, beside the row as it was. It takes the place of the
--      archive's generic capture on `trips`; the row it writes is the same, with one more key.
--   2. A trip made again reads that id back and ties the line, when the line is still there and tied to no trip.
--      Then it settles its archive rows, as before.
--
-- While the trip is gone the line is an ordinary line, as before: it can be repriced, billed or removed. A line that
-- was removed is not made again. The dev's own restore_deleted_records still works on a trip's bundle, since
-- jsonb_populate_record passes over a key the table does not have. Idempotent. The live client calls none of this.

-- 1. The trip's capture, with the line it held.
CREATE OR REPLACE FUNCTION public.trips_archive_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  j jsonb;
  v_line uuid;
BEGIN
  BEGIN
    j := to_jsonb(OLD);
    -- One trip, one line (jobs_ledger_fixtures_one_line_a_trip). The mark is still set here: the foreign key clears
    -- it after the trip's row is gone.
    SELECT f.id INTO v_line FROM public.jobs_ledger_fixtures f WHERE f.trip_id = OLD.id LIMIT 1;
    IF v_line IS NOT NULL THEN
      j := j || jsonb_build_object('held_line_id', v_line);
    END IF;
    INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
    VALUES (TG_TABLE_NAME, OLD.id::text, OLD.id::text, j, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- Never block a delete because archiving failed.
    RAISE WARNING 'trips_archive_on_delete failed for trip %: %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END
$fn$;
ALTER FUNCTION public.trips_archive_on_delete() OWNER TO postgres;
COMMENT ON FUNCTION public.trips_archive_on_delete() IS 'Trips: BEFORE DELETE on trips. Snapshots the row into deleted_records_archive under the trip''s id, as the generic capture did, with held_line_id when a job''s line carries the trip. Never raises.';
REVOKE EXECUTE ON FUNCTION public.trips_archive_on_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.trips;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_archive_on_delete();

-- 2. A trip made again ties its line, then settles what the archive holds of it.
CREATE OR REPLACE FUNCTION public.trips_settle_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_line uuid;
BEGIN
  BEGIN
    -- The line the trip held when it was last deleted, from the delete nothing has put back.
    SELECT NULLIF(a.row_data ->> 'held_line_id', '')::uuid INTO v_line
    FROM public.deleted_records_archive a
    WHERE a.table_name = 'trips' AND a.record_id = NEW.id::text AND a.restored_at IS NULL
    ORDER BY a.deleted_at DESC
    LIMIT 1;
    IF v_line IS NOT NULL THEN
      -- Only a line that is still there and tied to no trip, and only while the trip holds none.
      UPDATE public.jobs_ledger_fixtures f
         SET trip_id = NEW.id
       WHERE f.id = v_line
         AND f.trip_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger_fixtures g WHERE g.trip_id = NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block a save because the line could not be tied.
    RAISE WARNING 'trips_settle_archive could not tie the line of trip %: %', NEW.id, SQLERRM;
  END;
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
COMMENT ON FUNCTION public.trips_settle_archive() IS 'Trips: AFTER INSERT on trips. A trip made again under its own id (the Undo of a delete, Put back, a restore) is tied to the line it held when it was deleted, when that line is still there and tied to no trip, and then marks its archive rows restored, so no list offers a living trip. Never raises.';
REVOKE EXECUTE ON FUNCTION public.trips_settle_archive() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trips_settle_archive ON public.trips;
CREATE TRIGGER trips_settle_archive AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_settle_archive();
