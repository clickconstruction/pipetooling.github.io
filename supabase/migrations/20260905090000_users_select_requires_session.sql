SET lock_timeout = '3s';

-- v2.2837 — public.users SELECT requires a signed-in user (journey map J24-N1).
--
-- The baseline policy "Users can select users" (20250101000000_baseline.sql, widened for
-- controller by 20260714213000_controller_capabilities.sql) keyed most of its disjuncts on the
-- ROW's role — `role = 'assistant'`, `'estimator'`, `'primary'`, `'helpers'/'subcontractor'`,
-- `'superintendent'` — with no `auth.uid()` term and no `TO authenticated`. Every non-archived
-- row of those roles was therefore readable with the anon key alone (live-proved 2026-09-04:
-- id + name rows returned with zero session). The anon key ships in the public JS bundle.
--
-- This rewrite keeps every existing disjunct verbatim (including the controller widening) and
-- wraps it in `TO authenticated` + `auth.uid() IS NOT NULL`. No signed-in role loses a row it
-- can read today; anonymous callers get nothing. Service-role reads (edge functions) bypass RLS
-- and are unaffected; the public pages (portals, bid room, contract signing) reach `users` only
-- through SECURITY DEFINER RPCs or edge functions, never with the bare anon client.
--
-- Idempotent: DROP IF EXISTS + CREATE. No CREATE TABLE here, so no read_only block re-apply.

DROP POLICY IF EXISTS "Users can select users" ON public.users;

CREATE POLICY "Users can select users" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      (archived_at IS NULL OR public.is_dev())
      AND (
        id = (SELECT auth.uid())
        OR public.is_dev()
        OR (role = 'master_technician'::public.user_role AND public.is_master_or_dev())
        OR role = ANY (ARRAY['assistant'::public.user_role, 'controller'::public.user_role])
        OR (role = ANY (ARRAY['master_technician'::public.user_role, 'dev'::public.user_role]) AND public.is_estimator())
        OR role = 'estimator'::public.user_role
        OR role = 'primary'::public.user_role
        OR role = ANY (ARRAY['helpers'::public.user_role, 'subcontractor'::public.user_role])
        OR role = 'superintendent'::public.user_role
        OR public.master_adopted_current_user(id)
        OR public.can_see_sharing_master(id)
      )
    )
  );

COMMENT ON POLICY "Users can select users" ON public.users IS
  'Roster visibility by role (baseline + controller widening), restricted to signed-in users since 20260905090000 — anon key alone reads nothing.';
