-- Stand-ins for the two tables lien_billed_open() reads (20261010024000_lien_claim_follows_the_rule.sql, v2.5093).
-- Only the columns the function touches, typed as the baseline types them. See scripts/pgtest-lien-claim.sh.
-- Never against prod.
\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.jobs_ledger_invoices (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  status text DEFAULT 'ready_to_bill' NOT NULL,
  sequence_order integer DEFAULT 0 NOT NULL,
  billed_at timestamptz
);
CREATE TABLE public.jobs_ledger_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  invoice_id uuid,
  amount numeric(12,2) DEFAULT 0 NOT NULL,
  sequence_order integer DEFAULT 0 NOT NULL,
  paid_on date
);
