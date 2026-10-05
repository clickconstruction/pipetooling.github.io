SET lock_timeout = '3s';

-- Bid history, PR 1, file 2 of 2 (to-dos/bid-history, punch list #73): the seventeen triggers.
-- The ledger, its function and its lists are in 20261005215057_bid_changes; this file only
-- attaches record_bid_change() to the tables bid_changes_tables() names, and history starts the
-- moment it commits.
--
-- CREATE TRIGGER takes SHARE ROW EXCLUSIVE on its table: writes to that table wait, reads never
-- do. Each wait is capped by the lock timeout above, and every lock taken is held until this file
-- commits, so the file does nothing else: seventeen catalog inserts, in bid_changes_tables()'s
-- order, the least written tables first and bids last. If one wait trips the timeout, the whole
-- file rolls back and no table has a trigger: push again at a quieter moment. A table that
-- already has its trigger is skipped without a lock, so this file is safe to re-run alone.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY public.bid_changes_tables() LOOP
    IF EXISTS (
      SELECT 1 FROM pg_trigger tg
      WHERE tg.tgrelid = format('public.%I', t)::regclass
        AND tg.tgname = 'record_bid_change'
        AND NOT tg.tgisinternal
    ) THEN
      CONTINUE;
    END IF;
    IF t = 'bids' THEN
      -- Only the columns bid_changes_bid_columns() keeps: robot, follow-up and board writes to bids
      -- never call the function.
      EXECUTE format(
        'CREATE TRIGGER record_bid_change AFTER INSERT OR DELETE OR UPDATE OF %s ON public.bids FOR EACH ROW EXECUTE FUNCTION public.record_bid_change()',
        (SELECT string_agg(quote_ident(c), ', ') FROM unnest(public.bid_changes_bid_columns()) AS c)
      );
    ELSE
      EXECUTE format(
        'CREATE TRIGGER record_bid_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_bid_change()',
        t
      );
    END IF;
  END LOOP;
END $$;
