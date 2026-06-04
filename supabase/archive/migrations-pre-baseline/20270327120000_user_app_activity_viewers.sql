-- Allowlist: dev grants assistant / master_technician / primary org-wide read on user_app_activity_daily.

CREATE TABLE public.user_app_activity_viewers (
  viewer_user_id uuid NOT NULL PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_app_activity_viewers IS
  'Users (assistant, master_technician, primary) granted org-wide SELECT on user_app_activity_daily by a dev.';

CREATE OR REPLACE FUNCTION public.enforce_user_app_activity_viewer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  SELECT role INTO r FROM public.users WHERE id = NEW.viewer_user_id;
  IF r IS NULL THEN
    RAISE EXCEPTION 'viewer_user_id must reference an existing user';
  END IF;
  IF r NOT IN ('assistant', 'master_technician', 'primary') THEN
    RAISE EXCEPTION 'Activity viewer must be assistant, master_technician, or primary';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_app_activity_viewers_enforce_role
  BEFORE INSERT OR UPDATE ON public.user_app_activity_viewers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_app_activity_viewer_role();

ALTER TABLE public.user_app_activity_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_app_activity_viewers_select_dev_or_self"
  ON public.user_app_activity_viewers
  FOR SELECT
  TO authenticated
  USING (public.is_dev() OR viewer_user_id = auth.uid());

CREATE POLICY "user_app_activity_viewers_insert_dev"
  ON public.user_app_activity_viewers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "user_app_activity_viewers_delete_dev"
  ON public.user_app_activity_viewers
  FOR DELETE
  TO authenticated
  USING (public.is_dev());

REVOKE ALL ON TABLE public.user_app_activity_viewers FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_app_activity_viewers TO authenticated;

DROP POLICY IF EXISTS "user_app_activity_daily_select_own_or_dev" ON public.user_app_activity_daily;

CREATE POLICY "user_app_activity_daily_select_own_dev_or_viewer"
  ON public.user_app_activity_daily
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_dev()
    OR EXISTS (
      SELECT 1
      FROM public.user_app_activity_viewers v
      WHERE v.viewer_user_id = auth.uid()
    )
  );
