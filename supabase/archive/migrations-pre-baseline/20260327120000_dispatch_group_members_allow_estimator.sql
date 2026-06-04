-- Task Dispatch group: allow estimators in addition to assistants (receive inbox + pushes).
-- Header buttons for estimators are app-side; this migration relaxes the membership trigger.

CREATE OR REPLACE FUNCTION public.dispatch_group_members_enforce_assistant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.role::text IN ('assistant', 'estimator')
  ) THEN
    RAISE EXCEPTION 'Dispatch group may only include users with role assistant or estimator';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.dispatch_group_members IS 'Users who receive Task Dispatch push notifications and see the Dispatch inbox on Dashboard (assistants and estimators). Dev manages membership in Settings.';

COMMENT ON FUNCTION public.is_dispatch_group_member() IS 'True if current user is in the Task Dispatch group (assistant or estimator).';
