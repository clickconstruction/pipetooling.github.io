-- Permanent DELETE on clock_sessions: dev and pay-approved masters only.
-- Assistants keep SELECT/UPDATE (approve, reject, restore, etc.) via other policies but cannot hard-delete rows.

DROP POLICY IF EXISTS "Pay access can delete clock sessions" ON public.clock_sessions;

CREATE POLICY "Pay access can delete clock sessions"
ON public.clock_sessions
FOR DELETE
USING (public.is_pay_approved_master());
