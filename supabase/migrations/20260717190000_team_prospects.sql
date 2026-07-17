-- Team prospects: a recruiting pipeline on the Prospects page (new top-level Team tab).
-- Prospective crew members are entered, managed, and drag-ranked (rank_order, 1 = top
-- candidate). Parallel to the customer-lead `prospects` table but with its own lifecycle
-- (active → hired / passed), so it gets its own table rather than a discriminator column.
-- Access mirrors the customer pipeline exactly: user_has_prospects_staff_access()
-- (dev / master_technician / assistant, or estimator with estimator_prospects_access).

CREATE TABLE IF NOT EXISTS public.team_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text,
  email text,
  trade text,
  source text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hired', 'passed')),
  rank_order integer NOT NULL DEFAULT 0,
  last_contact timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.team_prospects IS 'Prospective hires (Prospects page, Team tab): crew candidates, drag-ranked via rank_order (lower = better).';
COMMENT ON COLUMN public.team_prospects.trade IS 'What they do (plumber, apprentice, office, ...) - free text';
COMMENT ON COLUMN public.team_prospects.source IS 'How we found them (referral, job board, walk-in, ...) - free text';

CREATE INDEX IF NOT EXISTS idx_team_prospects_master_user_id ON public.team_prospects (master_user_id);
CREATE INDEX IF NOT EXISTS idx_team_prospects_created_by ON public.team_prospects (created_by);
CREATE INDEX IF NOT EXISTS idx_team_prospects_status_rank ON public.team_prospects (status, rank_order);

DROP TRIGGER IF EXISTS update_team_prospects_updated_at ON public.team_prospects;
CREATE TRIGGER update_team_prospects_updated_at BEFORE UPDATE ON public.team_prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_prospects ENABLE ROW LEVEL SECURITY;

-- Same staff surface as the customer-lead prospect tables.
DROP POLICY IF EXISTS "Prospects staff can see all team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can see all team prospects" ON public.team_prospects
  FOR SELECT USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can update all team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can update all team prospects" ON public.team_prospects
  FOR UPDATE USING (public.user_has_prospects_staff_access())
  WITH CHECK (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can delete team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can delete team prospects" ON public.team_prospects
  FOR DELETE USING (public.user_has_prospects_staff_access());

-- INSERT mirrors prospects: created_by is the caller, and the owner must be the caller
-- (dev/master), an adopted master (assistant), or a master_technician (estimator with access).
DROP POLICY IF EXISTS "Prospects staff can insert team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can insert team prospects" ON public.team_prospects
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

-- Deleted-records archive coverage (root table: bundle groups by its own id).
DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.team_prospects;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.team_prospects
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record();

-- Required after every CREATE TABLE: block writes from read-only (training mode) users.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
