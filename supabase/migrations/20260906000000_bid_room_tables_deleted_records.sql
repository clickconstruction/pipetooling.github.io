SET lock_timeout = '3s';

-- B16 / J35-N1 (C73): the bid-room tables (20260828215717) sat OUTSIDE the deleted-records
-- archive — deleting a bid (or a room directly) took a signed room's revision and event
-- history with it, unrecoverably. Every other bids-family table has a zzz_archive_on_delete
-- trigger; these three get the same one.
--
-- Group keys follow the restore's recursion (20260828031500): the room archives under its
-- bid (group_key = bid_id) so it lands in the bid's bundle; revisions and events archive
-- under their room (group_key = room_id). Restoring the bid seeds on the bid id, chains to
-- the room via `a2.group_key = b.record_id`, then to the revisions/events the same way;
-- dependency-depth ordering re-inserts rooms before their children. A room deleted on its
-- own shows in Recently deleted as a "partial" bundle keyed by its bid, exactly like a
-- directly-deleted price option.
--
-- Reuses public.archive_deleted_record() and the idempotent DO-block / to_regclass pattern
-- from 20260716150000. No new table, so no apply_read_only_* footers. Client change: the
-- Recently deleted labels learned the three table names (deletedRecordContents.ts).

DO $do$
DECLARE
  r         record;
  arg_frag  text;
BEGIN
  FOR r IN
    SELECT tbl, cols FROM (VALUES
      ('bid_proposal_rooms',          ARRAY['bid_id']),
      ('bid_proposal_room_revisions', ARRAY['room_id']),
      ('bid_proposal_room_events',    ARRAY['room_id'])
    ) AS t(tbl, cols)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NULL THEN
      RAISE WARNING 'deleted_records_archive coverage: table public.% not found, skipping trigger', r.tbl;
      CONTINUE;
    END IF;
    arg_frag := COALESCE((SELECT string_agg(quote_literal(c), ', ') FROM unnest(r.cols) AS c), '');
    EXECUTE format('DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record(%s)',
      r.tbl, arg_frag
    );
  END LOOP;
END $do$;
