SET lock_timeout = '3s';

-- Crew Day email → office only (v2.2615): superintendents lose the crew_day
-- stream on BOTH sides — they can no longer schedule sends and can no longer
-- be recipients. Owner decision (2026-09-01): "I do not want superintendents
-- to be able to set this up, I want them to come back to the app" — the
-- Dashboard Crew Day section (v2.2602) stays their only window.
--
-- Client side ships with the same version: the ✉ button hides for
-- superintendents (isCrewDayEmailRole in src/lib/crewDay.ts) and the
-- crew-day-email-dispatch SENDER_ROLES/RECIPIENT_ROLES drop superintendent
-- (redeploy required). This migration makes the DB enforce it: the INSERT
-- policy's requester AND recipient role checks tighten to office roles.
-- The dispatcher additionally refuses any pre-existing superintendent-
-- addressed row ("ineligible role" stamp), so stragglers never send.

DROP POLICY IF EXISTS "Eligible users insert own crew day email requests" ON public.crew_day_email_requests;
CREATE POLICY "Eligible users insert own crew day email requests" ON public.crew_day_email_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    AND EXISTS (
      SELECT 1 FROM public.users r
      WHERE r.id = recipient_user_id
        AND r.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
  );

COMMENT ON TABLE public.crew_day_email_requests IS
  'Requested sends of the Crew Day email (v2.2603; office-only since v2.2615 — superintendents can neither schedule nor receive). Office roles insert; the crew-day-email-dispatch edge function (pg_cron */5) processes rows with send_at <= now(), rebuilds that recipient''s crew day fresh, and stamps sent_at/error. repeat_weekly rows re-enqueue +7d on successful send. The emailed day is the send''s Chicago calendar day.';
