-- Per-invoice est. done/bill date for Stages T+/T− and aging (falls back to jobs_ledger.estimated_completion_date when null).

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS estimated_bill_date date;

COMMENT ON COLUMN public.jobs_ledger_invoices.estimated_bill_date IS
  'Optional per-invoice est. bill date; UI T+/T− and header aging use this when set, else job estimated_completion_date.';
