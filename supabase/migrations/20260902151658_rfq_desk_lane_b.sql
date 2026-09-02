SET lock_timeout = '3s';

-- RFQ Desk, lane B (v2.2636 — docs/SUPPLY_HOUSE_RFQ_PLAN.md "Deferred" →
-- built on demand 2026-09-02). System-sent RFQ emails with tracking:
-- bid_rfqs grows the email linkage (sent_email + the Resend message id the
-- existing resend-webhook already tracks in email_send_log), the strong
-- "Viewed" signal (the public quote page stamps viewed_at server-side),
-- and manual-nudge throttling state. All additive; RLS on bid_rfqs is
-- unchanged (the v2.2629 policies already cover these columns).

ALTER TABLE public.bid_rfqs
  ADD COLUMN IF NOT EXISTS sent_email text,
  ADD COLUMN IF NOT EXISTS resend_email_id text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_note text;

-- The desk reads delivery state (delivered/bounced/opened) straight from
-- email_send_log, which is dev-only SELECT (20260803193428). Open exactly
-- the rows an RFQ references, to exactly the roles that can see RFQs —
-- never the wider email log.
DROP POLICY IF EXISTS email_send_log_rfq_select ON public.email_send_log;
CREATE POLICY email_send_log_rfq_select ON public.email_send_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bid_rfqs r
      WHERE r.resend_email_id = email_send_log.resend_email_id
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = ( SELECT auth.uid() )
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
    )
  );

CREATE INDEX IF NOT EXISTS email_send_log_resend_id_idx
  ON public.email_send_log (resend_email_id);
