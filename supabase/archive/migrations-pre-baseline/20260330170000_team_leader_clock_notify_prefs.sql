-- Per team-lead assignment: leader opt-in for Web Push when that member clocks in or out.
-- FK to team_leader_assignments(id) so multiple leaders for the same member each have their own row.

CREATE TABLE public.team_leader_clock_notify_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader_assignment_id uuid NOT NULL
    REFERENCES public.team_leader_assignments(id) ON DELETE CASCADE,
  notify_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_leader_clock_notify_prefs_assignment_unique UNIQUE (team_leader_assignment_id)
);

CREATE INDEX idx_team_leader_clock_notify_prefs_assignment
  ON public.team_leader_clock_notify_prefs(team_leader_assignment_id);

COMMENT ON TABLE public.team_leader_clock_notify_prefs IS
  'Leader-only opt-in for notifications when the linked member clocks in or out (Dashboard My Team).';

ALTER TABLE public.team_leader_clock_notify_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_leader_clock_notify_prefs_select"
ON public.team_leader_clock_notify_prefs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.team_leader_assignments t
    WHERE t.id = team_leader_clock_notify_prefs.team_leader_assignment_id
      AND (
        t.leader_user_id = auth.uid()
        OR public.can_manage_team_leader_assignments()
      )
  )
);

CREATE POLICY "team_leader_clock_notify_prefs_insert"
ON public.team_leader_clock_notify_prefs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_leader_assignments t
    WHERE t.id = team_leader_clock_notify_prefs.team_leader_assignment_id
      AND (
        t.leader_user_id = auth.uid()
        OR public.can_manage_team_leader_assignments()
      )
  )
);

CREATE POLICY "team_leader_clock_notify_prefs_update"
ON public.team_leader_clock_notify_prefs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.team_leader_assignments t
    WHERE t.id = team_leader_clock_notify_prefs.team_leader_assignment_id
      AND (
        t.leader_user_id = auth.uid()
        OR public.can_manage_team_leader_assignments()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_leader_assignments t
    WHERE t.id = team_leader_clock_notify_prefs.team_leader_assignment_id
      AND (
        t.leader_user_id = auth.uid()
        OR public.can_manage_team_leader_assignments()
      )
  )
);

CREATE POLICY "team_leader_clock_notify_prefs_delete"
ON public.team_leader_clock_notify_prefs
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.team_leader_assignments t
    WHERE t.id = team_leader_clock_notify_prefs.team_leader_assignment_id
      AND (
        t.leader_user_id = auth.uid()
        OR public.can_manage_team_leader_assignments()
      )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_leader_clock_notify_prefs TO authenticated;
