-- Team leader assignments: Settings (dev/master/assistant) assigns members to leaders.
-- Leaders may approve/reject/revoke clock sessions for assigned members (see follow-up RPC + policies).

CREATE TABLE public.team_leader_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT team_leader_assignments_leader_not_member CHECK (leader_user_id <> member_user_id),
  CONSTRAINT team_leader_assignments_unique_pair UNIQUE (leader_user_id, member_user_id)
);

CREATE INDEX idx_team_leader_assignments_leader ON public.team_leader_assignments(leader_user_id);
CREATE INDEX idx_team_leader_assignments_member ON public.team_leader_assignments(member_user_id);

COMMENT ON TABLE public.team_leader_assignments IS 'Directed leader→member links for My Team hours approval on Dashboard.';

ALTER TABLE public.team_leader_assignments ENABLE ROW LEVEL SECURITY;

-- Helpers (SECURITY DEFINER so RLS on junction table does not block clock_sessions policies / RPC)
CREATE OR REPLACE FUNCTION public.is_team_lead_for_member(p_leader uuid, p_member uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_leader_assignments t
    WHERE t.leader_user_id = p_leader
      AND t.member_user_id = p_member
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_lead_for_person_name(p_person_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    INNER JOIN public.team_leader_assignments t ON t.member_user_id = u.id
    WHERE t.leader_user_id = auth.uid()
      AND trim(u.name) = trim(p_person_name)
  );
$$;

COMMENT ON FUNCTION public.is_team_lead_for_member(uuid, uuid) IS 'True if p_leader is assigned as team leader for p_member.';
COMMENT ON FUNCTION public.is_team_lead_for_person_name(text) IS 'True if current user leads the user whose trimmed name matches p_person_name.';

GRANT EXECUTE ON FUNCTION public.is_team_lead_for_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_lead_for_person_name(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_team_leader_assignments()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_dev()
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('master_technician', 'assistant')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_team_leader_assignments() TO authenticated;

-- RLS: leaders and members see their rows; dev/master/assistant see all (Settings UI)
CREATE POLICY "Team assignment read scope"
ON public.team_leader_assignments
FOR SELECT
USING (
  leader_user_id = auth.uid()
  OR member_user_id = auth.uid()
  OR public.can_manage_team_leader_assignments()
);

CREATE POLICY "Team assignment insert managers"
ON public.team_leader_assignments
FOR INSERT
WITH CHECK (public.can_manage_team_leader_assignments());

CREATE POLICY "Team assignment update managers"
ON public.team_leader_assignments
FOR UPDATE
USING (public.can_manage_team_leader_assignments())
WITH CHECK (public.can_manage_team_leader_assignments());

CREATE POLICY "Team assignment delete managers"
ON public.team_leader_assignments
FOR DELETE
USING (public.can_manage_team_leader_assignments());

-- clock_sessions: team leads read/update member sessions (reject flow uses UPDATE)
CREATE POLICY "Team leads can read member clock sessions"
ON public.clock_sessions
FOR SELECT
USING (public.is_team_lead_for_member(auth.uid(), user_id));

CREATE POLICY "Team leads can update member clock sessions"
ON public.clock_sessions
FOR UPDATE
USING (public.is_team_lead_for_member(auth.uid(), user_id))
WITH CHECK (public.is_team_lead_for_member(auth.uid(), user_id));

-- people_hours: approve/revoke RPC touches these rows
CREATE POLICY "Team leads can read people hours for members"
ON public.people_hours
FOR SELECT
USING (public.is_team_lead_for_person_name(person_name));

CREATE POLICY "Team leads can insert people hours for members"
ON public.people_hours
FOR INSERT
WITH CHECK (public.is_team_lead_for_person_name(person_name));

CREATE POLICY "Team leads can update people hours for members"
ON public.people_hours
FOR UPDATE
USING (public.is_team_lead_for_person_name(person_name))
WITH CHECK (public.is_team_lead_for_person_name(person_name));

CREATE POLICY "Team leads can delete people hours for members"
ON public.people_hours
FOR DELETE
USING (public.is_team_lead_for_person_name(person_name));

-- people_crew_jobs / people_crew_bids: sync helpers run as invoker during approve/revoke
CREATE POLICY "Team leads can manage people crew jobs for members"
ON public.people_crew_jobs
FOR ALL
USING (public.is_team_lead_for_person_name(person_name))
WITH CHECK (public.is_team_lead_for_person_name(person_name));

CREATE POLICY "Team leads can manage people crew bids for members"
ON public.people_crew_bids
FOR ALL
USING (public.is_team_lead_for_person_name(person_name))
WITH CHECK (public.is_team_lead_for_person_name(person_name));

-- Realtime (optional sync in UI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_leader_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_leader_assignments;
  END IF;
END
$$;
