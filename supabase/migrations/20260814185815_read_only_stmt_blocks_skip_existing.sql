SET lock_timeout = '3s';

-- apply_read_only_stmt_blocks() unconditionally ran DROP TRIGGER + CREATE
-- TRIGGER on every RLS-enabled public table (~250). DROP TRIGGER takes an
-- ACCESS EXCLUSIVE lock that blocks even SELECTs, and every lock is held until
-- the migration transaction commits — so each CREATE TABLE migration push
-- briefly queued all reads app-wide, canceling anything that waited past
-- statement_timeout ("Failed to load …: canceling statement due to statement
-- timeout" toasts during the 2026-08-14 Vehicles pushes). Its sibling
-- apply_read_only_write_blocks() already skips tables whose policies exist.
--
-- Same discipline here: only CREATE the trigger where it is missing, so the
-- routine new-table rerun locks exactly the new table. If the trigger's
-- definition (event list / function) ever changes, ship a one-off migration
-- that DROPs the triggers first — a plain rerun no longer rebuilds them.
CREATE OR REPLACE FUNCTION public.apply_read_only_stmt_blocks() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  t       record;
  created integer := 0;
BEGIN
  FOR t IN
    SELECT c.relname::text AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relname NOT IN (
        'user_app_activity_daily',       -- browsing heartbeat
        'user_app_activity_page_daily',  -- browsing heartbeat
        'estimate_customer_events',      -- anon/public link-view telemetry
        'deleted_records_archive',       -- written only by its own definer trigger
        'clock_sessions'                 -- row-level guard instead (block_if_read_only_clock_row)
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        WHERE tg.tgrelid = c.oid
          AND tg.tgname = 'read_only_block_stmt'
          AND NOT tg.tgisinternal
      )
  LOOP
    EXECUTE format(
      'CREATE TRIGGER read_only_block_stmt BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.block_if_read_only()',
      t.table_name
    );
    created := created + 1;
  END LOOP;
  RETURN created;
END $fn$;

COMMENT ON FUNCTION public.apply_read_only_stmt_blocks() IS
  'Attaches the read_only_block_stmt statement trigger to every RLS-enabled public table except the passive-browsing allowlist and clock_sessions (which carries the row-level block_if_read_only_clock_row guard). Idempotent AND incremental (since 2026-08-14): tables that already carry the trigger are skipped, so a rerun locks only genuinely new tables — the old DROP+CREATE-everywhere version held ACCESS EXCLUSIVE locks on ~250 tables per migration push and froze app reads until commit. To change the trigger definition itself, ship a one-off migration that drops the triggers first.';

-- Self-test with the new semantics: with every table already covered this
-- creates 0 triggers and takes no table locks; it also heals any table that
-- somehow lost the trigger.
SELECT public.apply_read_only_stmt_blocks();
