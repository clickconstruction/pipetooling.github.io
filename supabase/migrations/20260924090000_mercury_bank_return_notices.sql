SET lock_timeout = '3s';

-- Once-per-deposit ledger for the office's "check returned" notice (punch list #40 PR 2,
-- v2.3804). mercury-webhook inserts here FIRST, before any email or push, keyed on the
-- deposit; a unique violation means the office was already told (Mercury delivers at least
-- once, and a later change to the same transaction arrives with a new delivery signature,
-- so mercury_webhook_events' per-delivery key cannot carry this). Written by the service
-- role only; devs may read it (Settings' email log reads email_send_log, this is the why).
CREATE TABLE IF NOT EXISTS public.mercury_bank_return_notices (
  mercury_transaction_id uuid PRIMARY KEY REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  payment_ids uuid[] NOT NULL DEFAULT '{}',
  recipient_count integer NOT NULL DEFAULT 0,
  emails_sent integer NOT NULL DEFAULT 0,
  pushes_sent integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.mercury_bank_return_notices IS
  'One row per Mercury deposit the office was told came back (mercury-webhook, v2.3804): inserted before the send, so a retry or a second webhook for the same transaction never sends twice. payment_ids = the jobs_ledger_payments rows that still carried the deposit when the notice went.';

ALTER TABLE public.mercury_bank_return_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs read mercury_bank_return_notices" ON public.mercury_bank_return_notices;
CREATE POLICY "Devs read mercury_bank_return_notices" ON public.mercury_bank_return_notices FOR SELECT
  USING (public.is_dev());

GRANT SELECT ON public.mercury_bank_return_notices TO authenticated;
GRANT ALL ON public.mercury_bank_return_notices TO service_role;

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
