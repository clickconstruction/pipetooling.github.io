-- Guard privileged public.users columns (role, read_only, archived_at) against self-escalation.
--
-- The "Users can update own profile" RLS policy is USING/​WITH CHECK (auth.uid() = id) — it checks
-- only row ownership, not which columns change — and authenticated holds column UPDATE on the whole
-- users table. So any authenticated user could PATCH their own row to role='dev' (full admin,
-- including the jobs_ledger hard-delete that cascades across ~18 child tables) or clear their own
-- read_only training-mode flag. This BEFORE UPDATE trigger closes that: only a dev may change role
-- or read_only, and archived_at is edge-flow-only.
--
-- Service-role / edge functions pass automatically: a service-role connection carries no JWT, so
-- auth.uid() is NULL and the caller-role lookup returns no row — the deny branches don't fire. This
-- is the same behavior prevent_bid_number_update_by_estimator_primary() already relies on. So
-- archive-user / restore-user (archived_at), claim-dev (role), and merge-users keep working; each
-- authorizes the caller as dev before writing via its service-role adminClient.
--
-- Legitimate in-app writers preserved: dev updateRole / updateReadOnly in useActiveAccountsManagement
-- run as an authenticated dev (auth.uid() present, role 'dev') and are allowed. No client change.

CREATE OR REPLACE FUNCTION public.users_guard_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid;
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

  IF NEW.read_only IS DISTINCT FROM OLD.read_only AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change read-only (training) mode' USING ERRCODE = 'P0001';
  END IF;

  -- archived_at is never set from an authenticated client; archive/restore go through the
  -- service-role edge functions (which also ban/unban the auth user). Block all authenticated writes.
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'archived_at is managed by the archive/restore flow only' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $fn$;

ALTER FUNCTION public.users_guard_privileged_columns() OWNER TO postgres;

COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role or read_only; archived_at is edge-flow (service-role) only. Blocks self-role-escalation and self-unflagging of training mode. Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();
