-- Per-user gate for the Prospects → Team hiring board (v2.714).
--
-- The board should be visible only to specific people for now (initially William, Malachi,
-- and Robert), not to every prospects-staff user. New users.team_prospects_access flag
-- (default FALSE — nobody sees the board until a dev turns them on in Settings → Active
-- accounts), a user_has_team_prospects_access() helper (prospects staff AND the flag), and
-- the team_prospects / team_prospect_roles RLS policies swap onto it. The Customers pipeline
-- (prospects, comments, callbacks, ...) is unchanged.
--
-- The flag is also added to the users_guard_privileged_columns trigger: "Users can update
-- own profile" RLS is row-scoped, not column-scoped, so without the guard any user could
-- PATCH their own row to grant themselves the board.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS team_prospects_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.team_prospects_access IS 'Grants the Prospects Team hiring board (team_prospects / team_prospect_roles) on top of prospects staff access. Dev-set only (guard trigger).';

CREATE OR REPLACE FUNCTION public.user_has_team_prospects_access() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.user_has_prospects_staff_access()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND COALESCE(u.team_prospects_access, false)
    );
$$;

ALTER FUNCTION public.user_has_team_prospects_access() OWNER TO postgres;

COMMENT ON FUNCTION public.user_has_team_prospects_access() IS 'Prospects staff access AND users.team_prospects_access. Gates the Team hiring board tables.';

-- Re-point the Team board policies from blanket staff access to the per-user flag.

DROP POLICY IF EXISTS "Prospects staff can see all team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can see all team prospects" ON public.team_prospects
  FOR SELECT USING (public.user_has_team_prospects_access());

DROP POLICY IF EXISTS "Prospects staff can update all team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can update all team prospects" ON public.team_prospects
  FOR UPDATE USING (public.user_has_team_prospects_access())
  WITH CHECK (public.user_has_team_prospects_access());

DROP POLICY IF EXISTS "Prospects staff can delete team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can delete team prospects" ON public.team_prospects
  FOR DELETE USING (public.user_has_team_prospects_access());

DROP POLICY IF EXISTS "Prospects staff can insert team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can insert team prospects" ON public.team_prospects
  FOR INSERT WITH CHECK (
    public.user_has_team_prospects_access()
    AND created_by = (SELECT auth.uid())
    AND (
      master_user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = (SELECT auth.uid())
          AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role])
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_assistants.master_id = team_prospects.master_user_id
          AND master_assistants.assistant_id = (SELECT auth.uid())
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users eu
          WHERE eu.id = (SELECT auth.uid())
            AND eu.role = 'estimator'::public.user_role
            AND COALESCE(eu.estimator_prospects_access, false)
        )
        AND EXISTS (
          SELECT 1 FROM public.users m
          WHERE m.id = team_prospects.master_user_id
            AND m.role = 'master_technician'::public.user_role
        )
      )
    )
  );

DROP POLICY IF EXISTS "Prospects staff can see all team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can see all team prospect roles" ON public.team_prospect_roles
  FOR SELECT USING (public.user_has_team_prospects_access());

DROP POLICY IF EXISTS "Prospects staff can update all team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can update all team prospect roles" ON public.team_prospect_roles
  FOR UPDATE USING (public.user_has_team_prospects_access())
  WITH CHECK (public.user_has_team_prospects_access());

DROP POLICY IF EXISTS "Prospects staff can delete team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can delete team prospect roles" ON public.team_prospect_roles
  FOR DELETE USING (public.user_has_team_prospects_access());

DROP POLICY IF EXISTS "Prospects staff can insert team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can insert team prospect roles" ON public.team_prospect_roles
  FOR INSERT WITH CHECK (
    public.user_has_team_prospects_access()
    AND created_by = (SELECT auth.uid())
    AND (
      master_user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = (SELECT auth.uid())
          AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role])
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_assistants.master_id = team_prospect_roles.master_user_id
          AND master_assistants.assistant_id = (SELECT auth.uid())
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users eu
          WHERE eu.id = (SELECT auth.uid())
            AND eu.role = 'estimator'::public.user_role
            AND COALESCE(eu.estimator_prospects_access, false)
        )
        AND EXISTS (
          SELECT 1 FROM public.users m
          WHERE m.id = team_prospect_roles.master_user_id
            AND m.role = 'master_technician'::public.user_role
        )
      )
    )
  );

-- Guard the new column: only a dev may change it (self-grant would otherwise be possible
-- through the row-scoped "Users can update own profile" policy).
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

  IF NEW.team_prospects_access IS DISTINCT FROM OLD.team_prospects_access AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change Team prospects access' USING ERRCODE = 'P0001';
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
  'BEFORE UPDATE guard on public.users: only a dev may change role, read_only, or team_prospects_access; archived_at is edge-flow (service-role) only. Blocks self-role-escalation, self-unflagging of training mode, and self-granting the Team hiring board. Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at, team_prospects_access ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();
