-- A stand-in schema for the supply house payments bed: the tables 20261116230000 reads and writes,
-- with the columns it names. The two baseline triggers on supply_house_invoices (the paid_at stamp
-- and updated_at) are extracted from the baseline at run time by the runner, so the bed follows it.
-- Made-up houses, bills and people only.

CREATE SCHEMA IF NOT EXISTS auth;
-- Who is signed in: the test sets test.uid; unset reads as nobody (a migration, a cron).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid;
$$;

CREATE TABLE public.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, role text NOT NULL DEFAULT 'assistant');

-- The office cohort, as 20260906160000 defines it: dev, master_technician, assistant, controller.
CREATE OR REPLACE FUNCTION public.is_office_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'));
$$;

CREATE TABLE public.supply_houses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);

CREATE TABLE public.supply_house_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT '2026-10-01',
  due_date date,
  amount numeric(10,2) NOT NULL,
  link text,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  purchase_order_number text,
  paid_at timestamptz,
  payment_link text,
  document_kind text NOT NULL DEFAULT 'invoice',
  CONSTRAINT supply_house_invoices_amount_check CHECK ((document_kind = 'invoice' AND amount >= 0) OR (document_kind = 'credit' AND amount < 0))
);

-- A bill's jobs and bids, as far as 20261117020000 reads them: an interest bill takes neither.
CREATE TABLE public.supply_house_invoice_job_allocations (
  invoice_id uuid NOT NULL REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  pct numeric(5,2) NOT NULL
);
CREATE TABLE public.supply_house_invoice_bid_allocations (
  invoice_id uuid NOT NULL REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL,
  pct numeric(5,2) NOT NULL
);

-- The four fences every CREATE TABLE migration ends with: no-ops here.
CREATE OR REPLACE FUNCTION public.apply_read_only_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_read_only_stmt_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_digital_twin_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_archived_read_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;

-- The API's role reaches the bills as the office does in prod (their own policies are not this bed's subject).
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_house_invoices, public.supply_houses TO authenticated;
GRANT SELECT ON public.users TO authenticated;
