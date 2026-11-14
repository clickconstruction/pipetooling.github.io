-- The two days a bill carries, added to the lien_hand_day bed's stand-in bills table (its 00_schema.sql has only the
-- columns the readers read before v2.7224). Typed as the baseline types them. See scripts/pgtest-lien-bill-months.sh.
-- Never against prod.
\set ON_ERROR_STOP on
ALTER TABLE public.jobs_ledger_invoices ADD COLUMN IF NOT EXISTS billed_at timestamptz;
ALTER TABLE public.jobs_ledger_invoices ADD COLUMN IF NOT EXISTS sent_to_customer_at timestamptz;
