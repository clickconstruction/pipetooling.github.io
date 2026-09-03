SET lock_timeout = '3s';

-- Person Desk PR 5 (v2.2713): the two gate widenings the owner picked
-- (proposal decision 2) and the HR-file existence line (decision 4).
--
-- 1. Training mode (users.read_only) may now be set by a controller or a
--    pay-approved master as well as a dev — the people who onboard. Never on
--    your own account (a read-only user could otherwise clear their own flag;
--    devs keep today's behaviour). Role changes stay dev-only; archived_at
--    stays edge-flow only. The archive/restore edge functions widen in the
--    same PR (they check role in code, not here).
--
-- 2. person_file_summary_counts(person_id): a SECURITY DEFINER count so a
--    controller or master sees "HR file on record · N entries · updated …"
--    on the Person Desk without reading a word of it. RLS on person_files /
--    person_file_entries stays is_dev()-only; anyone outside the office set
--    gets the zero row (the count_pending_clock_session_approvals precedent).

CREATE OR REPLACE FUNCTION public.users_guard_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid;
  v_role text;
  v_can_train boolean;
BEGIN
  v_uid := auth.uid();
  -- No JWT (service-role / edge function / postgres): allow. Edge functions gate in code.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT role::text INTO v_role FROM public.users WHERE id = v_uid;
  IF NEW.role IS DISTINCT FROM OLD.role AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change a user''s role' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.read_only IS DISTINCT FROM OLD.read_only THEN
    v_can_train :=
      v_role = 'dev'
      OR v_role = 'controller'
      OR (v_role = 'master_technician' AND EXISTS (SELECT 1 FROM public.pay_approved_masters pam WHERE pam.master_id = v_uid));
    IF NOT COALESCE(v_can_train, false) THEN
      RAISE EXCEPTION 'Only a dev, a controller, or a pay-approved master can change read-only (training) mode' USING ERRCODE = 'P0001';
    END IF;
    IF v_role IS DISTINCT FROM 'dev' AND NEW.id = v_uid THEN
      RAISE EXCEPTION 'You cannot change training mode on your own account' USING ERRCODE = 'P0001';
    END IF;
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
  'BEFORE UPDATE guard on public.users: only a dev may change role; a dev, controller, or pay-approved master may change read_only (never their own, except devs); archived_at is edge-flow (service-role) only. Service-role calls (auth.uid() IS NULL) pass through.';

-- The trigger itself is unchanged (BEFORE UPDATE OF role, read_only, archived_at) — the
-- function body is what changed, and CREATE OR REPLACE keeps the binding.

-- The row-level UPDATE policy on users names dev / master / assistant explicitly (it predates
-- the controller role), so a controller's training-mode write would filter to zero rows and
-- the Desk would report "did not apply". Re-create it with controller included; the trigger
-- above still decides which columns each role may touch.
DROP POLICY IF EXISTS "Masters assistants devs can update user notes" ON public.users;
CREATE POLICY "Masters assistants devs can update user notes" ON public.users FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])));

CREATE OR REPLACE FUNCTION public.person_file_summary_counts(p_person_id uuid)
RETURNS TABLE(entries integer, has_summary boolean, updated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.users WHERE id = auth.uid();
  IF NOT (public.is_dev() OR public.is_assistant() OR v_role = 'master_technician') THEN
    RETURN QUERY SELECT 0, false, NULL::timestamptz;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::int FROM public.person_file_entries e WHERE e.person_id = p_person_id),
    EXISTS (SELECT 1 FROM public.person_files f WHERE f.person_id = p_person_id AND f.kind = 'summary'),
    GREATEST(
      (SELECT MAX(e.created_at) FROM public.person_file_entries e WHERE e.person_id = p_person_id),
      (SELECT MAX(f.updated_at) FROM public.person_files f WHERE f.person_id = p_person_id)
    );
END;
$$;

COMMENT ON FUNCTION public.person_file_summary_counts(uuid) IS
  'Existence line for the Person Desk Records row: entry count, whether a summary exists, and the last write, for office roles (dev / assistant-like / master); everyone else gets the zero row. Never returns file content.';

REVOKE EXECUTE ON FUNCTION public.person_file_summary_counts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.person_file_summary_counts(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.person_file_summary_counts(uuid) TO authenticated;
