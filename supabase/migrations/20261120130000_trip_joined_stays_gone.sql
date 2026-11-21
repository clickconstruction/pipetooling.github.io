SET lock_timeout = '3s';

-- A joined trip stays joined (v2.8127, punch list #379, the stale save of a joined trip).
--
-- `trip_join` (20261119180000) deletes the next trip and keeps it in the archive marked `joined_into`. The Deleted
-- trips fold reads the mark and draws no Put back. The save itself refused nothing: `trip_save` makes any id that is
-- not there, so a screen that still held the trip from before the join could save it again. Three presses send that
-- save: Put back on a fold read before the join, Change then Save on a Development page left open from before it,
-- and the Undo of a delete made on such a page. The trip then came back beside the trip that holds its days. Each of
-- its days stood on two trips, it read as on no bill while the joined trip held its line, and its archive row was
-- settled, so no list said it had been joined. Put on a bill could then bill its days a second time.
--
-- One trigger refuses that insert, whatever door it comes through: `trip_save` and its three presses, the dev seat's
-- `apply_trip`, the dev's `restore_deleted_records`. It reads the newest delete of the id that nothing has put back.
-- When that delete carries `joined_into`, the insert is refused in words that name both trips and the way back,
-- which is Split in two on the joined trip. Every day the trip held is on the joined trip, so a refusal loses
-- nothing. A trip somebody deleted carries no mark, so Put back, the Undo of a delete and the dev's restore of one
-- are not touched.
--
-- A definer, as the archive is the dev's alone to read. A read that fails lets the insert through, as before.
-- `trip_save`'s dry run writes nothing, so it does not hear the refusal: the save itself does.
--
-- No table, column or index. Idempotent. The trigger's name sorts before `trips_take_number`, so a refused insert
-- never reaches the site's counter.

CREATE OR REPLACE FUNCTION public.trips_refuse_joined_back()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_into jsonb;
  v_number integer;
  v_into_number integer;
  v_there boolean := false;
  v_this text;
  v_that text;
  v_again text;
BEGIN
  -- The read never blocks a save by failing: a trip that cannot be looked up is made as before.
  BEGIN
    SELECT a.row_data -> 'joined_into', NULLIF(a.row_data ->> 'trip_number', '')::integer
      INTO v_into, v_number
    FROM public.deleted_records_archive a
    WHERE a.table_name = 'trips' AND a.record_id = NEW.id::text AND a.restored_at IS NULL
    ORDER BY a.deleted_at DESC
    LIMIT 1;
    IF v_into IS NULL OR jsonb_typeof(v_into) <> 'object' OR NULLIF(v_into ->> 'trip_id', '') IS NULL THEN
      RETURN NEW;
    END IF;
    v_into_number := NULLIF(v_into ->> 'trip_number', '')::integer;
    v_there := EXISTS (SELECT 1 FROM public.trips t WHERE t.id = (v_into ->> 'trip_id')::uuid);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trips_refuse_joined_back could not read the archive for trip %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;
  -- Named as the Deleted trips fold names them: *Trip 2 was joined into Trip 1*, and *another trip* for a trip
  -- made before numbers.
  v_this := CASE WHEN v_number IS NOT NULL THEN 'Trip ' || v_number ELSE 'That trip' END;
  v_that := CASE WHEN v_into_number IS NOT NULL THEN 'Trip ' || v_into_number ELSE 'another trip' END;
  v_again := CASE WHEN v_into_number IS NOT NULL THEN 'Trip ' || v_into_number ELSE 'that trip' END;
  IF v_there THEN
    RAISE EXCEPTION '% was joined into %, which holds its days. To take the join back, press Split in two on %.', v_this, v_that, v_again
      USING ERRCODE = '22023';
  END IF;
  RAISE EXCEPTION '% was joined into %, which holds its days. Put % back, then press Split in two on it.', v_this, v_that, v_again
    USING ERRCODE = '22023';
END
$fn$;
ALTER FUNCTION public.trips_refuse_joined_back() OWNER TO postgres;
COMMENT ON FUNCTION public.trips_refuse_joined_back() IS 'Trips (#379): BEFORE INSERT on trips. Refuses a trip made again under the id of a trip that trip_join joined into another, read from the newest delete of that id that nothing has put back (deleted_records_archive, joined_into). The joined trip holds every day it had, and a join is taken back with Split in two on it. A trip somebody deleted carries no mark and is not touched. A definer, since the archive is the dev''s alone. A read that fails lets the insert through.';
REVOKE EXECUTE ON FUNCTION public.trips_refuse_joined_back() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trips_refuse_joined_back BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_refuse_joined_back();
