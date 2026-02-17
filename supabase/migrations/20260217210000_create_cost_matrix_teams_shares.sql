-- Share Cost Matrix and Teams: dev can grant view-only access to selected masters/assistants
-- Shared users see Cost matrix and Teams but cannot edit teams or pay config

CREATE TABLE IF NOT EXISTS public.cost_matrix_teams_shares (
  shared_with_user_id UUID NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.cost_matrix_teams_shares IS 'Users (masters/assistants) granted view-only access to Cost matrix and Teams by dev.';

ALTER TABLE public.cost_matrix_teams_shares ENABLE ROW LEVEL SECURITY;

-- Helper: true if current user has been shared Cost matrix and Teams access
CREATE OR REPLACE FUNCTION public.is_cost_matrix_shared_with_current_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cost_matrix_teams_shares WHERE shared_with_user_id = auth.uid());
$$;

COMMENT ON FUNCTION public.is_cost_matrix_shared_with_current_user() IS 'True if dev has shared Cost matrix and Teams view access with current user.';

-- Dev can manage shares
CREATE POLICY "Devs can manage cost matrix teams shares"
ON public.cost_matrix_teams_shares
FOR ALL
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- Shared users can read their own share (to verify access)
CREATE POLICY "Shared users can read own share"
ON public.cost_matrix_teams_shares
FOR SELECT
USING (shared_with_user_id = auth.uid());

-- people_pay_config: shared users need SELECT for cost matrix (hourly_wage, show_in_cost_matrix)
CREATE POLICY "Cost matrix shared users can read people pay config"
ON public.people_pay_config
FOR SELECT
USING (public.is_cost_matrix_shared_with_current_user());

-- people_teams: shared users need SELECT
CREATE POLICY "Cost matrix shared users can read people teams"
ON public.people_teams
FOR SELECT
USING (public.is_cost_matrix_shared_with_current_user());

-- people_team_members: shared users need SELECT
CREATE POLICY "Cost matrix shared users can read people team members"
ON public.people_team_members
FOR SELECT
USING (public.is_cost_matrix_shared_with_current_user());

-- people_hours: add shared users to SELECT policy (for cost calculation)
DROP POLICY IF EXISTS "Pay access users can read people hours" ON public.people_hours;
CREATE POLICY "Pay access users can read people hours"
ON public.people_hours
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
  OR public.is_cost_matrix_shared_with_current_user()
);
