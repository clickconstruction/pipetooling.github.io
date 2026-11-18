SET lock_timeout = '3s';

-- Job Mode, short (punch list #384, PR 1) · the Dashboard view opens to a superintendent.
--
-- set_dashboard_view(user, view), restated from 20261117030000_dashboard_view.sql with two changes:
--
-- 1. A superintendent's account takes a view. Until now only a leader's or a dev's did. One setting gives the short
--    form of whichever home the person uses: the short Dashboard with Job Mode off, the short Job Mode page with it on.
-- 2. A person sets his own row. Until now the press was the leader's, a dev's and the office's alone, so a
--    superintendent could not press Short for himself in Settings. The office still sets anyone's on the People desk.
--
-- Nothing else moves: the column, its check, the training-mode refusal and the grants are as they were. No account's
-- view changes here. Every row reads as it read before, and no superintendent is on Short until someone presses.

CREATE OR REPLACE FUNCTION public.set_dashboard_view(p_user_id uuid, p_view text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_office boolean;
  v_own boolean;
BEGIN
  v_office := public.is_master_or_dev() OR public.is_assistant();
  v_own := auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id = auth.uid();
  IF auth.uid() IS NULL OR NOT (COALESCE(v_office, false) OR v_own) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the office sets another person''s Dashboard view.');
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
  IF v_role IS NULL OR v_role NOT IN ('master_technician', 'dev', 'superintendent') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A Dashboard view is for a leader''s or a superintendent''s account.');
  END IF;
  UPDATE public.users SET dashboard_view = p_view WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'view', p_view);
END;
$$;
COMMENT ON FUNCTION public.set_dashboard_view(uuid, text) IS
  'Sets a leader''s, a dev''s or a superintendent''s Dashboard view to short or full. The leader, a dev and the assistant press it for anyone on the People desk, and a person presses it for his own row in Settings. A training account or a twin is refused in words, and so is an account of any other role.';
REVOKE ALL ON FUNCTION public.set_dashboard_view(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_dashboard_view(uuid, text) TO authenticated;
