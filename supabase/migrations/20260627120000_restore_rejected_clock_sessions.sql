-- Restore rejected clock sessions to Pending (clear rejected_at / rejected_by).
-- Access: pay-approved masters, assistants, devs, or team leader for that member.

CREATE POLICY "Devs can read all clock sessions"
ON public.clock_sessions
FOR SELECT
USING (public.is_dev());

CREATE POLICY "Devs can update all clock sessions"
ON public.clock_sessions
FOR UPDATE
USING (public.is_dev())
WITH CHECK (public.is_dev());

CREATE OR REPLACE FUNCTION public.restore_rejected_clock_sessions(p_session_ids UUID[])
RETURNS TABLE(restored_count int, error_message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_restored int := 0;
  v_session RECORD;
  v_pay boolean;
  v_dev boolean;
BEGIN
  v_pay := public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant();
  v_dev := public.is_dev();

  FOR v_session IN
    SELECT cs.id, cs.user_id
    FROM public.clock_sessions cs
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NOT NULL
  LOOP
    IF NOT v_pay AND NOT v_dev THEN
      IF NOT public.is_team_lead_for_member(auth.uid(), v_session.user_id) THEN
        RETURN QUERY SELECT 0, 'Access denied'::text;
        RETURN;
      END IF;
    END IF;

    UPDATE public.clock_sessions
    SET rejected_at = NULL, rejected_by = NULL
    WHERE id = v_session.id;

    v_restored := v_restored + 1;
  END LOOP;

  RETURN QUERY SELECT v_restored, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.restore_rejected_clock_sessions(UUID[]) IS
  'Clear rejection on clock sessions (return to Pending). Pay access, dev, or team lead for member.';

GRANT EXECUTE ON FUNCTION public.restore_rejected_clock_sessions(UUID[]) TO authenticated;
