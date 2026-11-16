SET lock_timeout = '3s';

-- The leader's Dashboard, distilled · the Short or Full view, per person.
--
-- 1. users.dashboard_view: 'short' or 'full', or NULL for full. A leader on 'short' opens onto the short Dashboard:
--    the lines that wait on him alone, his day, and one door to everything else. NULL and 'full' draw the page as it
--    is today, so nobody's Dashboard changes until someone presses.
-- 2. set_dashboard_view(user, view): the press, from Settings (the person's own) or the People desk (the office's,
--    so a leader who will not open Settings still gets the short page). The leader, a dev and the assistant. Only a
--    leader's or a dev's account takes a view: the short page is drawn for those two roles alone.
--
-- A person reads their own row and the office reads the desk's, as they read users.week_signal. No new policy.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dashboard_view text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_dashboard_view_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_dashboard_view_check CHECK (dashboard_view IS NULL OR dashboard_view IN ('short', 'full'));
  END IF;
END $$;
COMMENT ON COLUMN public.users.dashboard_view IS
  'The Dashboard this person opens onto: short (what waits on them alone, their day, one door to everything else) or full (every section). NULL reads as full. Set through set_dashboard_view(), by the person in Settings or by the office on the People desk.';

CREATE OR REPLACE FUNCTION public.set_dashboard_view(p_user_id uuid, p_view text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_master_or_dev() OR public.is_assistant()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the leader and the office set a Dashboard view.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.read_only OR u.is_digital_twin)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Training mode: you can look, but every change is blocked for your account.');
  END IF;
  IF p_view IS NULL OR p_view NOT IN ('short', 'full') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The view is Short or Full.');
  END IF;
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No account by that id.');
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('master_technician', 'dev') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The short Dashboard is for a leader''s account.');
  END IF;
  UPDATE public.users SET dashboard_view = p_view WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'view', p_view);
END;
$$;
COMMENT ON FUNCTION public.set_dashboard_view(uuid, text) IS
  'Sets a leader''s or a dev''s Dashboard view to short or full. The leader, a dev and the assistant press it, from Settings or the People desk. A training account or a twin is refused in words, and so is any other role''s account.';
REVOKE ALL ON FUNCTION public.set_dashboard_view(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_dashboard_view(uuid, text) TO authenticated;
