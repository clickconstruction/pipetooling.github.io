-- Read-only (training) mode: make it airtight, so it can safely be offered for every role.
--
-- WHY. The toggle promises "every change is blocked". It does not deliver that today. The enforcement is
-- entirely RESTRICTIVE RLS policies (20260713090000), and a table's OWNER bypasses RLS — so every
-- SECURITY DEFINER RPC owned by postgres skips them. There are ~79 mutating SECURITY DEFINER RPCs granted
-- to `authenticated` (and baseline's `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO authenticated`
-- exposes new ones automatically), and NONE of them consult is_read_only().
--
-- This is live, not theoretical: seven of them admit `assistant` — the exact role the toggle is offered
-- for right now. Verified on a local stack before this migration: a read_only master_technician
-- successfully called delete_ready_to_bill_invoice (invoice deleted) and migrate_job_ledger_costs_and_delete
-- (job deleted). The UI meanwhile showed them the amber "changes won't save" banner.
--
-- HOW. Table ownership bypasses RLS, but it does NOT bypass TRIGGERS — triggers fire inside SECURITY
-- DEFINER functions. So one statement-level BEFORE INSERT/UPDATE/DELETE trigger per table closes all ~79
-- at once, without touching a single function body. The alternative — injecting a guard into each RPC —
-- would mean rewriting ~268 KB of payroll/billing plpgsql (largest body ~18.7 KB) and risking billing
-- correctness to fix a permissions gap. Not a trade worth making.
--
-- Same idiom already proven three times in this repo (apply_read_only_write_blocks, the two archive
-- trigger sweeps): one function + an idempotent DO loop keyed off the live catalog.
--
-- Safe by construction:
--   * is_read_only() is EXISTS(... WHERE id = auth.uid() AND read_only), so it is FALSE when auth.uid()
--     is NULL => cron, service-role and anon writes pass untouched. That matches the carve-out the
--     original migration already documented, and is why edge functions keep working.
--   * FOR EACH STATEMENT, not FOR EACH ROW => one cheap indexed lookup per write statement, not per row.
--   * It also fixes a real UX bug: RLS blocks UPDATE/DELETE by silently filtering to zero rows (no error),
--     which the client then papered over as success. A trigger RAISEs, so the user finally sees why.
--
-- PASSIVE BROWSING IS PRESERVED. Read-only users must still be able to browse, and browsing writes
-- telemetry. Excluded tables:
--   * user_app_activity_daily / user_app_activity_page_daily — written by bump_user_app_activity(), the
--     heartbeat the original migration explicitly carved out ("so passive browsing keeps working").
--   * estimate_customer_events — anon/public estimate link-view telemetry (record_estimate_public_link_view,
--     log_estimate_customer_event).
--   * deleted_records_archive — written only by its own SECURITY DEFINER archive trigger; a read-only
--     user's DELETE is refused before it can archive anything anyway.
--
-- Also adds the self-flag guard to users_guard_privileged_columns (v2.695): you cannot put your OWN
-- account into read-only mode. A read-only user's own-row UPDATE is filtered by the restrictive policy, so
-- a read-only dev cannot unflag themselves and no edge function touches the column — self-flagging the
-- last dev was a permanent lockout recoverable only by direct SQL.

-- 1. The blocker.
CREATE OR REPLACE FUNCTION public.block_if_read_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Read-only (training) mode: changes are blocked.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL; -- statement-level trigger: return value is ignored
END $fn$;

ALTER FUNCTION public.block_if_read_only() OWNER TO postgres;

COMMENT ON FUNCTION public.block_if_read_only() IS
  'Statement-level BEFORE INSERT/UPDATE/DELETE guard: raises for a user flagged users.read_only. Unlike the restrictive RLS policies this also fires inside SECURITY DEFINER RPCs (owner bypasses RLS, not triggers), which is what makes training mode airtight. No-op when auth.uid() is NULL (cron / service-role / anon).';

-- 2. Attach to every RLS-enabled public table except the passive-browsing allowlist. Idempotent.
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
        'deleted_records_archive'        -- written only by its own definer trigger
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
  'Attaches the read_only_block_stmt statement trigger to every RLS-enabled public table except the passive-browsing allowlist. Idempotent; rerun after adding tables (same discipline as apply_read_only_write_blocks()).';

SELECT public.apply_read_only_stmt_blocks();

-- 3. Self-flag guard: extend the v2.695 column guard. Body identical except the new read_only self check.
CREATE OR REPLACE FUNCTION public.users_guard_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid  uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();
  -- No JWT (service-role / edge function / postgres): allow. Edge functions are already dev-gated.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role::text INTO v_role FROM public.users WHERE id = v_uid;

  IF NEW.role IS DISTINCT FROM OLD.role AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change a user''s role' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.read_only IS DISTINCT FROM OLD.read_only THEN
    IF v_role IS DISTINCT FROM 'dev' THEN
      RAISE EXCEPTION 'Only a dev can change read-only (training) mode' USING ERRCODE = 'P0001';
    END IF;
    -- A read-only user cannot clear their own flag (the restrictive UPDATE policy filters their own row),
    -- and no edge function touches this column — so self-flagging would be an unrecoverable lockout.
    IF NEW.id = v_uid THEN
      RAISE EXCEPTION 'You cannot put your own account in read-only mode — ask another dev.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- archived_at is never set from an authenticated client; archive/restore go through the service-role
  -- edge functions (which also ban/unban the auth user). Block all authenticated writes.
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'archived_at is managed by the archive/restore flow only' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role or read_only, nobody may read-only their own account (unrecoverable lockout), and archived_at is edge-flow (service-role) only. Service-role calls (auth.uid() IS NULL) pass through.';
