SET lock_timeout = '3s';

-- v2.3254 — users UPDATE policy: recursion fix, second time.
--
-- 20260903191916_person_desk_gate_widenings.sql (v2.2713) re-created the UPDATE policy
-- "Masters assistants devs can update user notes" to admit controller — but wrote the
-- predicate as a raw `EXISTS (SELECT 1 FROM public.users u …)`. A users policy that
-- selects from users re-enters the users policies → Postgres raises
--   infinite recursion detected in policy for relation "users"
-- on EVERY authenticated UPDATE of public.users (role changes in Active Accounts,
-- training-mode toggles, user notes, profile edits). Reported 2026-09-10 changing a
-- subcontractor to helper. This is the same bug 20260704120000 fixed by routing the
-- role lookup through the SECURITY DEFINER helper is_user_notes_editor(); the 09-03
-- rewrite bypassed the helper.
--
-- Fix: the helper gains controller (the 09-03 intent), and the policy goes back to
-- calling the helper. Every role the 09-03 policy admitted is still admitted; the
-- column-level rules stay in the users_guard_privileged_columns trigger.
-- Idempotent: CREATE OR REPLACE + DROP IF EXISTS + CREATE. No CREATE TABLE, so no
-- read_only block re-apply.

CREATE OR REPLACE FUNCTION public.is_user_notes_editor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role IN ('dev','master_technician','assistant','controller')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_user_notes_editor() FROM anon;

COMMENT ON FUNCTION public.is_user_notes_editor() IS
  'True when the caller is dev/master_technician/assistant/controller. SECURITY DEFINER so users-table policies can use it without self-referential recursion — never inline a SELECT FROM users inside a users policy (20260704120000, 20260910230000).';

DROP POLICY IF EXISTS "Masters assistants devs can update user notes" ON public.users;
CREATE POLICY "Masters assistants devs can update user notes" ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_user_notes_editor())
  WITH CHECK (public.is_user_notes_editor());

COMMENT ON POLICY "Masters assistants devs can update user notes" ON public.users IS
  'dev / master_technician / assistant / controller may update user rows (columns gated by the users_guard_privileged_columns trigger). Must stay on the SECURITY DEFINER helper — an inline SELECT FROM users here recurses.';
