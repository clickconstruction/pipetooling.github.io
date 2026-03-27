-- Per leader→member link: full My Team vs clock strip only on leader Dashboard (dev-only column updates).

ALTER TABLE public.team_leader_assignments
  ADD COLUMN dashboard_hours_visibility text NOT NULL DEFAULT 'full'
    CHECK (dashboard_hours_visibility IN ('full', 'strip_only'));

COMMENT ON COLUMN public.team_leader_assignments.dashboard_hours_visibility IS
  'full = roster, week totals, clock activity, pending approval UI; strip_only = leader still sees member in Currently clocked in strip + Today hours only. Editable only by dev.';

CREATE OR REPLACE FUNCTION public.team_leader_assignments_dashboard_visibility_dev_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dashboard_hours_visibility IS DISTINCT FROM OLD.dashboard_hours_visibility
     AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only developers can change dashboard_hours_visibility'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_leader_assignments_dashboard_visibility_dev_only_trg
  ON public.team_leader_assignments;

CREATE TRIGGER team_leader_assignments_dashboard_visibility_dev_only_trg
  BEFORE UPDATE OF dashboard_hours_visibility ON public.team_leader_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.team_leader_assignments_dashboard_visibility_dev_only();
