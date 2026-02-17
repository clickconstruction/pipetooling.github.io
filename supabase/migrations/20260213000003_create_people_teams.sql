-- People Teams: groups of people for combined cost view
-- people_teams + people_team_members; dev and approved masters only

CREATE TABLE IF NOT EXISTS public.people_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.people_team_members (
  team_id UUID NOT NULL REFERENCES public.people_teams(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  PRIMARY KEY (team_id, person_name)
);

CREATE INDEX IF NOT EXISTS idx_people_team_members_team_id ON public.people_team_members(team_id);

COMMENT ON TABLE public.people_teams IS 'Teams for combined labor cost view. Dev and approved masters only.';
COMMENT ON TABLE public.people_team_members IS 'Person names in each team.';

ALTER TABLE public.people_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs and approved masters can manage people teams"
ON public.people_teams
FOR ALL
USING (public.is_pay_approved_master())
WITH CHECK (public.is_pay_approved_master());

CREATE POLICY "Devs and approved masters can manage people team members"
ON public.people_team_members
FOR ALL
USING (public.is_pay_approved_master())
WITH CHECK (public.is_pay_approved_master());
