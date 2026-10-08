-- Stand-ins for the tables and helpers 20261008100000_ar_unbanked_check_cases.sql reads (v2.4902).
-- Only the columns the migration touches; the real ones live in the baseline and later migrations.
-- See scripts/pgtest-ar-unbanked-checks.sh. Never against prod.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'service_role') $$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, service_role, anon;

-- The company's today, pinned by the scenario (public.app_today() in prod).
CREATE OR REPLACE FUNCTION public.app_today() RETURNS date LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('bed.today', true), '')::date, current_date) $$;

CREATE OR REPLACE FUNCTION public.apply_read_only_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_read_only_stmt_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_digital_twin_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;

CREATE TABLE public.users (id uuid PRIMARY KEY, email text, name text, role text);
CREATE TABLE public.customers (id uuid PRIMARY KEY, name text);
CREATE TABLE public.jobs_ledger (
  id uuid PRIMARY KEY, hcp_number text, click_number text, job_name text, customer_name text,
  customer_id uuid, gc_customer_id uuid, bill_to_party text, revenue numeric, payments_made numeric, status text
);
CREATE TABLE public.jobs_ledger_invoices (id uuid PRIMARY KEY, job_id uuid, sequence_order int, status text, amount numeric, stripe_invoice_id text);
CREATE TABLE public.jobs_ledger_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL, invoice_id uuid, amount numeric,
  paid_on date, payment_type text, reference_number text, mercury_transaction_id uuid, stripe_credit_note_id text
);
CREATE TABLE public.mercury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric NOT NULL, kind text NOT NULL, status text NOT NULL,
  posted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), counterparty_name text, raw jsonb
);
CREATE TABLE public.mercury_transaction_ar_returned (
  mercury_transaction_id uuid PRIMARY KEY, returned boolean NOT NULL DEFAULT true, source text, bank_reason text,
  opened_at timestamptz, updated_at timestamptz DEFAULT now(), closed_at timestamptz, closed_reason text,
  closed_note text, closed_by uuid, replaced_by_mercury_transaction_id uuid
);
CREATE TABLE public.mercury_bank_return_notices (mercury_transaction_id uuid PRIMARY KEY, notified_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.deleted_records_archive (table_name text, row_data jsonb, restored_at timestamptz, deleted_at timestamptz, deleted_by uuid);
CREATE TABLE public.job_payment_promises (job_id uuid, promised_date date, said_by text, created_at timestamptz, voided_at timestamptz);
