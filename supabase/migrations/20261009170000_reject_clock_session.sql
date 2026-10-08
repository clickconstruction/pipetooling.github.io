SET lock_timeout = '3s';

-- reject_clock_session: the My Time day editor's Reject session as one transaction.
--
-- The editor rejected a session with two requests: an UPDATE of rejected_at / rejected_by under
-- the caller's RLS, then recompute_people_hours_after_session_edit to take an approved session's
-- hours back out of people_hours. When the second failed the row stayed rejected with its hours
-- still counted, the dialog read as if nothing had happened, and the rejected row no longer showed
-- to try again (pinned in v2.4960). This function does both inside the one transaction PostgREST
-- opens for the call, so a refused resync undoes the reject.
--
-- Behaviour-preserving on purpose:
--   * SECURITY INVOKER: the UPDATE runs under the caller's own RLS on clock_sessions, exactly as
--     the browser's request did. The resync keeps its own SECURITY DEFINER and actor check.
--   * Everyone RLS lets update a row also passes the resync's check (the person, their team lead,
--     pay access and assistants, and devs through is_pay_approved_master), so nobody who can
--     reject today is refused.
--   * The resync runs for every reject, pending or approved, as the browser's second request did.
-- One deliberate change, as save_my_time_day does: an UPDATE that changes no row (the session is
-- missing, or RLS hides it from the caller) is raised. The browser's request succeeded there with
-- nothing written, and the dialog closed as if the session were rejected.

CREATE OR REPLACE FUNCTION public.reject_clock_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'reject_clock_session: a session is required';
  END IF;

  UPDATE public.clock_sessions
     SET rejected_at = now(),
         rejected_by = auth.uid()
   WHERE id = p_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'reject_clock_session: no clock session % that you can change', p_session_id;
  END IF;

  PERFORM public.recompute_people_hours_after_session_edit(p_session_id);
END;
$$;

COMMENT ON FUNCTION public.reject_clock_session(uuid) IS
  'My Time day editor Reject session as one transaction: sets rejected_at / rejected_by under the caller''s RLS, then resyncs people_hours for the day; any error rolls both back. A session the caller cannot change is raised. v2.4964.';

REVOKE ALL ON FUNCTION public.reject_clock_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_clock_session(uuid) TO authenticated;
