SET lock_timeout = '3s';

-- Signing it on paper, PR 2 (to-dos/contract-paper-lane): how a sent agreement went out.
-- NULL = a signing link (every send before this column, and send-job-contract's email / link
-- modes until they stamp it); 'handed' = the office took the unsigned PDF and handed or mailed
-- it — no token, no reminders, waiting for the signed page to be filed; 'pdf_email' is PR 3's
-- (the app emails the PDF to sign by hand). A hand-off counts as sent (owner, 2026-09-19): the
-- sweep's question is whether the customer has been asked. Additive and idempotent.

ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS sent_channel text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_contracts_sent_channel_check') THEN
    ALTER TABLE public.job_contracts
      ADD CONSTRAINT job_contracts_sent_channel_check
      CHECK (sent_channel IS NULL OR sent_channel IN ('link', 'pdf_email', 'handed'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_contracts.sent_channel IS
  'How the sent agreement went out: NULL / link = a signing link (emailed or copied), pdf_email = the PDF emailed to sign by hand, handed = the unsigned PDF handed or mailed by the office (no token, no reminders). Filing the signed page converts a handed row in place.';
