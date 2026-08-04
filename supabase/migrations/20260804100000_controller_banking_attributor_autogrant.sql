SET lock_timeout = '3s';

-- Controller auto-grant for the non-card attribution capability (v2.1380).
--
-- The Moneyfill queue ("Bank transfers needing attribution", v2.1378) is gated by
-- `banking_attributors` (v2.1308 substrate). Rather than a dev hand-inserting a row
-- every time someone becomes a controller, the controller ROLE now implies the
-- capability: a statement trigger on `public.users` reconciles the grant table
-- whenever role or archived_at changes (the `sync_company_access_grants` pattern,
-- v2.921).
--
-- Rules:
--   * Every ACTIVE (archived_at IS NULL) controller holds a row.
--   * Rows created by this sync are marked `auto_role_grant = true` and are REVOKED
--     when the user stops being an active controller (demotion or archive).
--   * Manual dev grants (auto_role_grant = false, the pre-existing default) are
--     NEVER touched — the substrate's original purpose (granting the queue to
--     someone with no other Banking access) still works for any role.
--   * A manual grant that predates a promotion to controller stays manual, so a
--     later demotion keeps it (deliberate grants survive role churn).

ALTER TABLE public.banking_attributors
  ADD COLUMN IF NOT EXISTS auto_role_grant boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.banking_attributors.auto_role_grant IS
  'True when the row was created by sync_controller_banking_attributors() because the user is an active controller. Auto rows are deleted by the same sync when the user is demoted or archived; manual dev grants (false) are never touched.';

CREATE OR REPLACE FUNCTION public.sync_controller_banking_attributors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Grant: every active controller. granted_by stays NULL for auto rows — the
  -- grantor is "the role", not a person.
  INSERT INTO public.banking_attributors (user_id, granted_by, auto_role_grant)
  SELECT u.id, NULL, true
  FROM public.users u
  WHERE u.role = 'controller'
    AND u.archived_at IS NULL
  ON CONFLICT (user_id) DO NOTHING;

  -- Revoke: only rows this sync created, and only when the user is no longer an
  -- active controller.
  DELETE FROM public.banking_attributors ba
  WHERE ba.auto_role_grant
    AND NOT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = ba.user_id
        AND u.role = 'controller'
        AND u.archived_at IS NULL
    );
END;
$$;

COMMENT ON FUNCTION public.sync_controller_banking_attributors() IS
  'Reconciles banking_attributors with the controller role: inserts auto_role_grant rows for active controllers, deletes auto rows for ex-controllers. Manual grants untouched. Called by the users statement trigger; safe to call any time.';

CREATE OR REPLACE FUNCTION public.sync_controller_banking_attributors_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_controller_banking_attributors();
  RETURN NULL;
END;
$$;

-- Not client-callable: the trigger fires it; nothing user-supplied flows in.
REVOKE ALL ON FUNCTION public.sync_controller_banking_attributors() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_controller_banking_attributors_trigger() FROM anon, authenticated;

DROP TRIGGER IF EXISTS sync_controller_banking_attributors_on_users ON public.users;
CREATE TRIGGER sync_controller_banking_attributors_on_users
  AFTER INSERT OR UPDATE OF role, archived_at ON public.users
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_controller_banking_attributors_trigger();

-- Seed now for any existing controllers (none today — no-op, kept so the
-- migration is self-contained if that ever changes before it is pushed).
SELECT public.sync_controller_banking_attributors();
