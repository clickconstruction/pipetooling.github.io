-- Read-only "training mode": users.read_only flag + is_read_only() helper + restrictive
-- RLS policies on every public table blocking INSERT/UPDATE/DELETE for flagged users.
--
-- A flagged user keeps their role's full read visibility (SELECT policies untouched) but
-- every direct write from the client is denied at the database, regardless of UI gaps.
-- Toggled from Active Accounts (Manage accounts) for assistant rows; the column is
-- role-agnostic so other roles can be flagged later without another migration.
--
-- Not blocked (by design or scope):
--   * service-role writes (edge functions) — service_role bypasses RLS; none of them
--     write on a training user's behalf today
--   * SECURITY DEFINER RPCs owned by postgres (e.g. bump_user_app_activity heartbeat) —
--     owner bypasses RLS, so passive browsing keeps working
--   * anon public flows (estimate/contract accept) — is_read_only() is false without a JWT
--   * storage.objects (file uploads) — outside the public schema sweep
--
-- apply_read_only_write_blocks() is kept as a callable helper: rerun it (or call it from
-- a future migration) after CREATE TABLE so new tables get the same three policies.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS read_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.read_only IS 'Training mode: user can browse everything their role can see, but all direct INSERT/UPDATE/DELETE are blocked by restrictive RLS policies (see is_read_only()).';

CREATE OR REPLACE FUNCTION public.is_read_only() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND read_only = true
  );
$$;

COMMENT ON FUNCTION public.is_read_only() IS 'True when the current user is flagged users.read_only (training mode). Used by restrictive write-block policies on every public table.';

-- Adds the three restrictive write-block policies to every RLS-enabled table in public
-- that does not have them yet. Idempotent; safe to rerun any time (e.g. after new tables).
CREATE OR REPLACE FUNCTION public.apply_read_only_write_blocks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  t record;
  created integer := 0;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.table_name
        AND policyname = 'read_only_users_cannot_insert'
    ) THEN
      EXECUTE format(
        'CREATE POLICY read_only_users_cannot_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.is_read_only())',
        t.table_name
      );
      created := created + 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.table_name
        AND policyname = 'read_only_users_cannot_update'
    ) THEN
      EXECUTE format(
        'CREATE POLICY read_only_users_cannot_update ON public.%I AS RESTRICTIVE FOR UPDATE USING (NOT public.is_read_only())',
        t.table_name
      );
      created := created + 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.table_name
        AND policyname = 'read_only_users_cannot_delete'
    ) THEN
      EXECUTE format(
        'CREATE POLICY read_only_users_cannot_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT public.is_read_only())',
        t.table_name
      );
      created := created + 1;
    END IF;
  END LOOP;

  RETURN created;
END;
$$;

COMMENT ON FUNCTION public.apply_read_only_write_blocks() IS 'Creates the restrictive read-only (training mode) write-block policies on any RLS-enabled public table missing them. Rerun after adding tables. Returns the number of policies created.';

SELECT public.apply_read_only_write_blocks();
