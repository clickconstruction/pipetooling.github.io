SET lock_timeout = '3s';

-- Three statement lanes, one shared view (journey-map Tier-2 #45 / J20-F5, F10).
--
-- 1. gc_statement_email_requests SELECT was `requested_by = auth.uid() OR
--    is_dev()` (20260806233713). The GC Review box titled "Scheduled statement
--    sends" therefore showed a non-dev only THEIR OWN rows — an assistant
--    running the Wednesday round saw no box at all while two weekly chains
--    ran. The read widens to the GC Review cohort (the same cohort the INSERT
--    policy already names): dev / assistant-like (controller rides
--    is_assistant()) / master_technician / primary. Cancel stays owner-only:
--    the DELETE policy ("Creators cancel own unsent …", requester-or-dev) is
--    deliberately NOT touched, and there is still no client UPDATE policy.
--
-- 2. email_send_log SELECT was dev-only (20260803193428) — the org-wide log
--    carries every outbound email. The per-GC "What went out" list needs only
--    the two GC-statement rows' lane (`email_type`) and delivery status
--    (`last_event`), joined to gc_statement_emails by resend_email_id. A second,
--    additive policy lets the same office cohort read rows whose email_type is
--    one of the two statement catalog ids — nothing else in the log opens up.
--
-- Idempotent; policy-only; no table changes.

DROP POLICY IF EXISTS "Creators and devs read gc statement email requests" ON public.gc_statement_email_requests;
DROP POLICY IF EXISTS "Office reads gc statement email requests" ON public.gc_statement_email_requests;
CREATE POLICY "Office reads gc statement email requests" ON public.gc_statement_email_requests
  FOR SELECT USING (
    requested_by = (SELECT auth.uid())
    OR public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
    )
  );

COMMENT ON POLICY "Office reads gc statement email requests" ON public.gc_statement_email_requests IS
  'GC Review cohort reads every pending/sent scheduled statement request (journey-map #45). Cancel (DELETE) stays requester-or-dev.';

DROP POLICY IF EXISTS email_send_log_statement_office_select ON public.email_send_log;
CREATE POLICY email_send_log_statement_office_select ON public.email_send_log
  FOR SELECT USING (
    email_type IN ('gc_statement_manual', 'gc_statement_scheduled')
    AND (
      public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
      )
    )
  );

COMMENT ON POLICY email_send_log_statement_office_select ON public.email_send_log IS
  'GC Review cohort reads the GC-statement rows only (email_type gc_statement_manual / gc_statement_scheduled) for the per-GC "What went out" list (journey-map #45). The dev-only policy still covers the rest of the log.';
