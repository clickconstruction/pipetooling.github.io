-- Hire-stage onboarding (v2.931): the Prospects → Team → Hire tab becomes an
-- onboarding tracker. Devs define checklist items ("Did we collect a copy of
-- their driver's license?"), each with an optional link (the document to share,
-- or where the person can find a copy). Every hired candidate shows one box per
-- item: red (pending) → yellow (requested — e.g. we asked for it) → green (done),
-- or straight red → green. Absence of a status row = pending.

CREATE TABLE IF NOT EXISTS public.team_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  link_url text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.team_onboarding_items IS 'Dev-defined onboarding checklist items for hired team prospects (Prospects → Team → Hire). Optional link_url = document to share / where to find it.';

CREATE TABLE IF NOT EXISTS public.team_prospect_onboarding_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_prospect_id uuid NOT NULL REFERENCES public.team_prospects(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.team_onboarding_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'requested', 'done')),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (team_prospect_id, item_id)
);

COMMENT ON TABLE public.team_prospect_onboarding_statuses IS 'Per-hire onboarding box states (pending=red, requested=yellow, done=green). No row = pending.';

CREATE INDEX IF NOT EXISTS idx_team_prospect_onboarding_prospect ON public.team_prospect_onboarding_statuses (team_prospect_id);

DROP TRIGGER IF EXISTS update_team_onboarding_items_updated_at ON public.team_onboarding_items;
CREATE TRIGGER update_team_onboarding_items_updated_at BEFORE UPDATE ON public.team_onboarding_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_team_prospect_onboarding_statuses_updated_at ON public.team_prospect_onboarding_statuses;
CREATE TRIGGER update_team_prospect_onboarding_statuses_updated_at BEFORE UPDATE ON public.team_prospect_onboarding_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_onboarding_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_prospect_onboarding_statuses ENABLE ROW LEVEL SECURITY;

-- Items: everyone with prospects access reads; only devs manage the catalog.
DROP POLICY IF EXISTS "Prospects staff read onboarding items" ON public.team_onboarding_items;
CREATE POLICY "Prospects staff read onboarding items" ON public.team_onboarding_items
  FOR SELECT USING (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS "Devs insert onboarding items" ON public.team_onboarding_items;
CREATE POLICY "Devs insert onboarding items" ON public.team_onboarding_items
  FOR INSERT WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs update onboarding items" ON public.team_onboarding_items;
CREATE POLICY "Devs update onboarding items" ON public.team_onboarding_items
  FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs delete onboarding items" ON public.team_onboarding_items;
CREATE POLICY "Devs delete onboarding items" ON public.team_onboarding_items
  FOR DELETE USING (public.is_dev());

-- Statuses: anyone doing onboarding (prospects staff) reads and sets them.
DROP POLICY IF EXISTS "Prospects staff read onboarding statuses" ON public.team_prospect_onboarding_statuses;
CREATE POLICY "Prospects staff read onboarding statuses" ON public.team_prospect_onboarding_statuses
  FOR SELECT USING (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS "Prospects staff insert onboarding statuses" ON public.team_prospect_onboarding_statuses;
CREATE POLICY "Prospects staff insert onboarding statuses" ON public.team_prospect_onboarding_statuses
  FOR INSERT WITH CHECK (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS "Prospects staff update onboarding statuses" ON public.team_prospect_onboarding_statuses;
CREATE POLICY "Prospects staff update onboarding statuses" ON public.team_prospect_onboarding_statuses
  FOR UPDATE USING (public.user_has_prospects_staff_access())
  WITH CHECK (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS "Prospects staff delete onboarding statuses" ON public.team_prospect_onboarding_statuses;
CREATE POLICY "Prospects staff delete onboarding statuses" ON public.team_prospect_onboarding_statuses
  FOR DELETE USING (public.user_has_prospects_staff_access());

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
