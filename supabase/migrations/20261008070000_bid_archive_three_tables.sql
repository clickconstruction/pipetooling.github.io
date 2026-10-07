SET lock_timeout = '3s';

-- Bid history (punch list #73) PR 0c: three bid tables sat OUTSIDE the deleted-records archive, so
-- removing a count row (or a whole bid) took them with no snapshot, and Recently deleted put the
-- bundle back without them:
--
--   bid_count_row_custom_costs     20260902181208  the quoted cost on a count row; its count-row FK
--                                                  (ON DELETE CASCADE) shipped in v2.4413
--   bid_takeoff_stage_splits       20260921163920  a takeoff line's rough-in / top-out / trim split
--   bid_submittal_takeoff_choices  20260929015024  a submittal row's ticks; no id column, keyed
--                                                  (bid_id, count_row_id)
--
-- Every one carries bid_id, so all three archive under their bid (group_key = bid_id) like their
-- siblings bid_count_row_custom_prices and bids_takeoff_rough_part_lines (20260716120000): a whole
-- bid restores them in its bundle, and a count row removed on its own shows as the bid-keyed
-- "partial" bundle it already makes. The restore needs no change: dependency-depth ordering puts
-- count rows and part lines before these children, and a row with no id inserts through the same
-- jsonb_populate_record path (record_id stays null).
--
-- Reuses public.archive_deleted_record() and the idempotent DO-block / to_regclass pattern from
-- 20260906000000. No new table, so no apply_read_only_* / digital-twin footers. Client change: the
-- Recently deleted labels learned the three table names (deletedRecordContents.ts).

DO $do$
DECLARE
  r         record;
  arg_frag  text;
BEGIN
  FOR r IN
    SELECT tbl, cols FROM (VALUES
      ('bid_count_row_custom_costs',    ARRAY['bid_id']),
      ('bid_takeoff_stage_splits',      ARRAY['bid_id']),
      ('bid_submittal_takeoff_choices', ARRAY['bid_id'])
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
