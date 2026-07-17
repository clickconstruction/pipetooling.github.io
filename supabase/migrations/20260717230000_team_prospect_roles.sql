-- Team prospect role columns: the Prospects → Team tab becomes a board with one column
-- per role being hired for (plumber, apprentice, office, ...). Users add columns as
-- needed; a column can be deleted ONLY once every candidate in it has been individually
-- deleted — enforced at the database level by ON DELETE RESTRICT on the FK below, not
-- just in the UI. Candidates rank within their column (team_prospects.rank_order is now
-- scoped per role); rows with role_id NULL surface in a virtual "Unsorted" column.

CREATE TABLE IF NOT EXISTS public.team_prospect_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.team_prospect_roles IS 'Role columns on the Prospects Team board (one per opening being hired for). Deletable only when no team_prospects row references them (FK RESTRICT).';

CREATE INDEX IF NOT EXISTS idx_team_prospect_roles_position ON public.team_prospect_roles (position);

DROP TRIGGER IF EXISTS update_team_prospect_roles_updated_at ON public.team_prospect_roles;
CREATE TRIGGER update_team_prospect_roles_updated_at BEFORE UPDATE ON public.team_prospect_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RESTRICT (not CASCADE/SET NULL): a role with candidates still in it must not be deletable.
ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.team_prospect_roles(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.team_prospects.role_id IS 'Role column on the Team board; NULL = Unsorted. FK is ON DELETE RESTRICT so a role cannot be deleted while candidates (any status) reference it.';

CREATE INDEX IF NOT EXISTS idx_team_prospects_role_id ON public.team_prospects (role_id);

ALTER TABLE public.team_prospect_roles ENABLE ROW LEVEL SECURITY;

-- Same staff surface as team_prospects.
DROP POLICY IF EXISTS "Prospects staff can see all team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can see all team prospect roles" ON public.team_prospect_roles
  FOR SELECT USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can update all team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can update all team prospect roles" ON public.team_prospect_roles
  FOR UPDATE USING (public.user_has_prospects_staff_access())
  WITH CHECK (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can delete team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can delete team prospect roles" ON public.team_prospect_roles
  FOR DELETE USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can insert team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can insert team prospect roles" ON public.team_prospect_roles
  FOR INSERT WITH CHECK (
    public.user_has_prospects_staff_access()
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

-- Deleted-records archive coverage (root table: bundle groups by its own id).
DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.team_prospect_roles;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.team_prospect_roles
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record();

-- Required after every CREATE TABLE: block writes from read-only (training mode) users.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
