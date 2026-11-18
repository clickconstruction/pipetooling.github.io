SET lock_timeout = '3s';

-- Tell the dev (punch list #380, PR 6): an account in training mode may send a note to the dev.
--
-- A training account (users.read_only) browses everything its role can see and writes nothing.
-- That is right for the business's records. It is wrong for the wrench: the people learning the
-- app are the ones a page confuses, and their note is about the app, not the business. So this is
-- a narrow carve-out on one table, help_feedback, on the pattern of the clock punch's
-- (20260728235607_read_only_allow_own_clock_punch.sql): a training account may INSERT its own
-- open note and nothing else. It still cannot change or delete a note, write a note as someone
-- else, or write a note already closed or answered.
--
-- Three parts, one for each layer of the fence:
--   1. The restrictive INSERT policy on help_feedback gains an own-row escape. Its NAME is
--      unchanged: apply_read_only_write_blocks() creates by name only when missing, so a later
--      sweep will not put the blanket body back. UPDATE and DELETE stay blocked.
--   2. The blanket statement trigger read_only_block_stmt cannot see rows, so ON THIS TABLE ONLY
--      it is replaced by a row trigger that passes a training account's own open INSERT.
--   3. apply_read_only_stmt_blocks() adds help_feedback to its exclusion list, so the sweep that
--      runs at the end of every CREATE TABLE migration does not re-attach the statement trigger.
--
-- The owner or a dev answering a trainee's note is not in training mode, so the row trigger
-- passes them as the statement trigger did.

-- 1. RLS: own-note escape on the restrictive INSERT policy (name preserved).
DROP POLICY IF EXISTS read_only_users_cannot_insert ON public.help_feedback;
CREATE POLICY read_only_users_cannot_insert ON public.help_feedback
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    NOT public.is_read_only()
    OR (
      from_user_id = ( SELECT auth.uid() )
      AND status = 'open'::text
      AND closed_at IS NULL AND closed_by_user_id IS NULL AND closed_note IS NULL
    )
  );
-- read_only_users_cannot_update and read_only_users_cannot_delete are untouched.

-- 2. Row-level trigger replacing the blanket statement trigger on help_feedback.
CREATE OR REPLACE FUNCTION public.block_if_read_only_help_feedback_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.is_read_only() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- A training account: its own open note, and nothing else.
  IF TG_OP = 'INSERT'
     AND NEW.from_user_id = ( SELECT auth.uid() )
     AND NEW.status = 'open'::text
     AND NEW.closed_at IS NULL AND NEW.closed_by_user_id IS NULL AND NEW.closed_note IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Read-only (training) mode: changes are blocked.' USING ERRCODE = 'P0001';
END $fn$;

ALTER FUNCTION public.block_if_read_only_help_feedback_row() OWNER TO postgres;

COMMENT ON FUNCTION public.block_if_read_only_help_feedback_row() IS
  'Row-level read-only (training mode) guard for help_feedback only: a flagged user may INSERT their own open note to the dev (punch list #380); every other write by a flagged user is blocked, as the statement trigger blocks it on every other table.';

DROP TRIGGER IF EXISTS read_only_block_stmt ON public.help_feedback;
DROP TRIGGER IF EXISTS read_only_block_row ON public.help_feedback;
CREATE TRIGGER read_only_block_row
  BEFORE INSERT OR UPDATE OR DELETE ON public.help_feedback
  FOR EACH ROW EXECUTE FUNCTION public.block_if_read_only_help_feedback_row();

-- 3. Keep the sweep from re-attaching the blanket statement trigger to help_feedback.
--    Body identical to 20260814185815_read_only_stmt_blocks_skip_existing.sql except the new
--    exclusion and the comment.
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
        'clock_sessions',                -- row-level guard instead (block_if_read_only_clock_row)
        'help_feedback'                  -- row-level guard instead (block_if_read_only_help_feedback_row)
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
  'Attaches the read_only_block_stmt statement trigger to every RLS-enabled public table except the passive-browsing allowlist, clock_sessions (row-level block_if_read_only_clock_row) and help_feedback (row-level block_if_read_only_help_feedback_row). Creates only where missing, so a rerun locks just a new table; a change to the trigger itself needs a one-off migration that drops the old ones first.';

-- With every table already covered this creates no trigger and takes no table lock.
SELECT public.apply_read_only_stmt_blocks();
