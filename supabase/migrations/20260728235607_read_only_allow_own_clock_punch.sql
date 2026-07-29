-- Read-only (training) mode: allow clocking in and out (v2.1066).
--
-- Trainees are real employees — they work real hours while flagged read_only, and payroll
-- needs their punches. The entire clock in/out flow (ClockInOutButton.tsx) writes exactly
-- one table, clock_sessions, and only the user's own rows (INSERT own 'user_punch' row at
-- clock-in, UPDATE the own open row at clock-out). So this is a narrow carve-out on that
-- one table; every other table stays fully blocked.
--
-- Three parts, mirroring the two enforcement layers:
--   1. The restrictive RLS policies on clock_sessions (20260713090000) gain an own-row
--      escape hatch. Policy NAMES are unchanged — apply_read_only_write_blocks() creates
--      by name only when missing, so future sweeps will not clobber these bodies.
--      DELETE stays fully blocked at the RLS layer.
--   2. The blanket statement trigger read_only_block_stmt (20260717000000) cannot see
--      rows, so ON THIS TABLE ONLY it is replaced by a row-level trigger that allows a
--      read-only user's own-row writes but still blocks:
--        * any row belonging to someone else (incl. via SECURITY DEFINER RPCs),
--        * any change to the approval columns (approved/rejected/revoked _at/_by) —
--          a read-only user with pay access cannot self-approve hours,
--        * DELETE, except the salary-sync case below.
--   3. apply_read_only_stmt_blocks() adds clock_sessions to its exclusion list so the
--      sweep re-run in the next CREATE TABLE migration does not re-attach the blanket
--      statement trigger on top of the row trigger.
--
-- Intended side effect: a read-only SALARIED user's client-invoked
-- sync_salary_clock_sessions_for_user_day (SECURITY DEFINER, maintains their own
-- origin='salary_schedule' rows, incl. deleting stale ones) previously threw against the
-- statement trigger on every Dashboard load; own-row salary_schedule maintenance now
-- passes. Cron/service-role sync was never affected (is_read_only() is false when
-- auth.uid() is NULL). people_hours and all approval flows remain fully blocked.

-- 1. RLS: own-punch escape hatch on the restrictive policies (names preserved).
DROP POLICY IF EXISTS read_only_users_cannot_insert ON public.clock_sessions;
CREATE POLICY read_only_users_cannot_insert ON public.clock_sessions
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    NOT public.is_read_only()
    OR (
      user_id = ( SELECT auth.uid() )
      AND origin = 'user_punch'::text
      AND approved_at IS NULL AND rejected_at IS NULL AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS read_only_users_cannot_update ON public.clock_sessions;
CREATE POLICY read_only_users_cannot_update ON public.clock_sessions
  AS RESTRICTIVE FOR UPDATE
  USING (
    NOT public.is_read_only()
    OR user_id = ( SELECT auth.uid() )
  );
-- read_only_users_cannot_delete is intentionally untouched (still blocks all deletes).
-- Column-level protection (approval columns on UPDATE) is the row trigger's job — it
-- fires on direct client writes too, not just RPCs.

-- 2. Row-level trigger replacing the blanket statement trigger on clock_sessions.
CREATE OR REPLACE FUNCTION public.block_if_read_only_clock_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.is_read_only() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Only the salary-sync self-maintenance case may delete: own row materialized from
    -- the salary schedule, never a punched or approval-stamped one.
    IF OLD.user_id = ( SELECT auth.uid() )
       AND OLD.origin = 'salary_schedule'::text
       AND OLD.approved_at IS NULL AND OLD.rejected_at IS NULL AND OLD.revoked_at IS NULL THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Read-only (training) mode: changes are blocked.' USING ERRCODE = 'P0001';
  END IF;

  -- INSERT/UPDATE: own rows only (both sides of an UPDATE — no reassigning rows).
  IF NEW.user_id IS DISTINCT FROM ( SELECT auth.uid() )
     OR (TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM ( SELECT auth.uid() )) THEN
    RAISE EXCEPTION 'Read-only (training) mode: changes are blocked.' USING ERRCODE = 'P0001';
  END IF;

  -- Approval columns are off-limits: no self-approval, and no punching rows that are
  -- already approved/rejected/revoked.
  IF TG_OP = 'INSERT' THEN
    IF NEW.approved_at IS NOT NULL OR NEW.approved_by IS NOT NULL
       OR NEW.rejected_at IS NOT NULL OR NEW.rejected_by IS NOT NULL
       OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL THEN
      RAISE EXCEPTION 'Read-only (training) mode: changes are blocked.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
       OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
       OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by THEN
      RAISE EXCEPTION 'Read-only (training) mode: changes are blocked.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END $fn$;

ALTER FUNCTION public.block_if_read_only_clock_row() OWNER TO postgres;

COMMENT ON FUNCTION public.block_if_read_only_clock_row() IS
  'Row-level read-only (training mode) guard for clock_sessions only: a flagged user may punch their own sessions (INSERT/UPDATE own rows, approval columns untouched; salary-sync may delete own unapproved salary_schedule rows) but everything else raises. Replaces the blanket read_only_block_stmt statement trigger on this table — clock_sessions is excluded in apply_read_only_stmt_blocks(). Like the statement trigger, fires inside SECURITY DEFINER RPCs. No-op when auth.uid() is NULL (cron / service-role).';

DROP TRIGGER IF EXISTS read_only_block_stmt ON public.clock_sessions;
DROP TRIGGER IF EXISTS read_only_block_row ON public.clock_sessions;
CREATE TRIGGER read_only_block_row
  BEFORE INSERT OR UPDATE OR DELETE ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.block_if_read_only_clock_row();

-- 3. Keep the sweep from re-attaching the blanket statement trigger to clock_sessions.
--    Body identical to 20260717000000 except the new exclusion (+ comment).
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
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS read_only_block_stmt ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE TRIGGER read_only_block_stmt BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.block_if_read_only()',
      t.table_name
    );
    created := created + 1;
  END LOOP;
  RETURN created;
END $fn$;

COMMENT ON FUNCTION public.apply_read_only_stmt_blocks() IS
  'Attaches the read_only_block_stmt statement trigger to every RLS-enabled public table except the passive-browsing allowlist and clock_sessions (which carries the row-level block_if_read_only_clock_row guard so training-mode users can clock in/out). Idempotent; rerun after adding tables (same discipline as apply_read_only_write_blocks()).';
