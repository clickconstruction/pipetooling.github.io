-- Option A: master_technician, assistant, and superintendent may leader-edit clock sessions for any target
-- (leader_split_* / leader_replace_*). Devs remain covered via is_pay_approved_master().
-- Existing RPC checks (Chicago week, rejected/revoked, payloads) unchanged.

CREATE OR REPLACE FUNCTION public.can_edit_clock_sessions_for_user(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target_user_id IS NOT NULL
    AND (
      p_target_user_id = auth.uid()
      OR public.is_team_lead_for_member(auth.uid(), p_target_user_id)
      OR public.is_pay_approved_master()
      OR public.is_assistant_of_pay_approved_master()
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('master_technician', 'assistant', 'superintendent')
      )
    );
$$;

COMMENT ON FUNCTION public.can_edit_clock_sessions_for_user(uuid) IS
  'True if caller may leader-edit clock sessions for target: self, team lead, pay-approved master or assistant-of, or (Option A) role master_technician / assistant / superintendent for any target; subject to leader RPC rules.';

GRANT EXECUTE ON FUNCTION public.can_edit_clock_sessions_for_user(uuid) TO authenticated;
