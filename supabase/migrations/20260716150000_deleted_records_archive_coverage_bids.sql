-- Deleted-records archive — coverage fix: four ON DELETE CASCADE children of `bids` that were added
-- AFTER the baseline and so were missed by the Phase 1 table list (20260716120000).
--
-- Today, deleting a bid destroys these rows with no snapshot. Worse, it is a *restore blocker* for
-- rows that ARE archived: bid_count_row_custom_prices.price_book_version_id,
-- bid_count_row_submission_hides.price_book_version_id and bid_pricing_assignments.price_book_version_id
-- are NOT NULL FKs to price_book_versions (and bid_pricing_assignments.price_book_entry_id is a NOT NULL
-- FK to price_book_entries). If those parents cascade away unarchived, their archived children can never
-- be re-inserted — so Phase 2 bid restore cannot work until this lands.
--
--   price_book_versions      20260610120000_bid_scoped_pricings.sql:15   bid_id NULL     -> bids CASCADE
--   bid_versions             20260610170000_bid_versions_schema.sql:16   bid_id NOT NULL -> bids CASCADE
--   bid_payment_schedule_rows 20260702120000_bid_payment_schedule.sql:14 bid_id NOT NULL -> bids CASCADE
--   price_book_entries       baseline: version_id -> price_book_versions CASCADE
--
-- price_book_versions.bid_id is NULLABLE: template (non-bid-scoped) price books have it NULL and do not
-- cascade with a bid. Passing 'bid_id' is still correct — the generic fn falls back to the row's own id,
-- so a deleted template archives as its own bundle while a bid-scoped copy groups under its bid.
--
-- Reuses public.archive_deleted_record() and the same idempotent DO-block / to_regclass pattern as
-- 20260716120000. No new table, so no apply_read_only_write_blocks() footer. No client change.

DO $do$
DECLARE
  r         record;
  arg_frag  text;
BEGIN
  FOR r IN
    SELECT tbl, cols FROM (VALUES
      ('bid_versions',              ARRAY['bid_id']),
      ('bid_payment_schedule_rows', ARRAY['bid_id']),
      ('price_book_versions',       ARRAY['bid_id']),
      ('price_book_entries',        ARRAY['version_id'])
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
