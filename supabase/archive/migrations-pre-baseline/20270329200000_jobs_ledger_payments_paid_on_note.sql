-- Per-row payment date and note on jobs_ledger_payments (Edit Job billing).

ALTER TABLE public.jobs_ledger_payments
  ADD COLUMN paid_on date NULL,
  ADD COLUMN note text NULL;

UPDATE public.jobs_ledger_payments
SET paid_on = (created_at AT TIME ZONE 'UTC')::date
WHERE paid_on IS NULL AND created_at IS NOT NULL;

COMMENT ON COLUMN public.jobs_ledger_payments.paid_on IS 'User-entered payment date; distinct from created_at.';
COMMENT ON COLUMN public.jobs_ledger_payments.note IS 'Optional note for this payment line.';
