-- Minimal stand-in for the prod schema count_supply_house_move_window() reads (20261021220000).
-- Test bed only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
-- The signed-in person is a transaction-local setting, as PostgREST sets it on prod.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  name text,
  role text NOT NULL
);

-- Stand-in for the prod role helper: the office roles.
CREATE OR REPLACE FUNCTION public.is_office_staff() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller'))
$$;

-- As in 20260903190000_app_today_civil_dates.sql: today in the company calendar.
CREATE OR REPLACE FUNCTION public.app_today() RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Chicago')::date
$$;

CREATE TABLE public.supply_houses (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY, hcp_number text, job_name text);

CREATE TABLE public.supply_house_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id),
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  amount numeric NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  due_date date,
  on_job_account boolean NOT NULL DEFAULT false,
  document_kind text NOT NULL DEFAULT 'invoice',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.supply_house_invoice_job_allocations (
  invoice_id uuid NOT NULL REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id),
  pct numeric NOT NULL,
  PRIMARY KEY (invoice_id, job_id)
);

-- The shape of 20261020130000_supply_house_invoice_move_requests.sql without its RLS, stamp
-- trigger and read-only guards (none of which the count reads).
CREATE TABLE public.supply_house_invoice_move_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  via text NOT NULL CHECK (via IN ('email', 'phone')),
  sent_to text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
CREATE UNIQUE INDEX supply_house_invoice_move_requests_open_uniq
  ON public.supply_house_invoice_move_requests (invoice_id)
  WHERE confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_msg; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true)
$$;
