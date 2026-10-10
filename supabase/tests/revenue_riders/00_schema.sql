-- Stand-ins for the revenue riders bed (v2.5129): the tables and helpers that job_rider_fees,
-- create_turnaway_trip_charge and apply_job_discount read, with only the columns they touch.
-- scripts/pgtest-revenue-riders.sh loads this, then the functions as main defines them
-- (10_main_functions.sql, lifted from their migrations), the seed, the migration twice, and the scenario.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
-- The signed-in user is a session setting, so the scenario can act as the office.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('bed.uid', true), '')::uuid
$$;

CREATE TYPE public.user_role AS ENUM ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'subcontractor');

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  role public.user_role NOT NULL
);

CREATE OR REPLACE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
$$;
CREATE OR REPLACE FUNCTION public.is_office_or_estimator() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.assistants_share_master(p_assistant uuid, p_master uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.can_read_job_activity(p_job_id uuid, p_strict boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.app_today() RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Chicago')::date
$$;

CREATE TABLE public.jobs_ledger (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'working',
  master_user_id uuid,
  revenue numeric,
  updated_at timestamptz
);

CREATE TABLE public.jobs_ledger_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger (id),
  amount numeric,
  status text NOT NULL,
  sequence_order integer,
  estimated_bill_date date,
  is_primary_rtb_bundle boolean,
  stripe_invoice_memo text,
  fee_lines jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jobs_ledger_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger (id),
  name text,
  count numeric,
  sequence_order integer,
  line_unit_price numeric,
  line_description text,
  invoice_id uuid,
  stage_kind text,
  shared_with_gc boolean,
  line_kind text,
  discount_pct numeric,
  discount_basis_positions integer[],
  discount_reason text
);

CREATE TABLE public.job_hazmat_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  fee_amount numeric NOT NULL,
  voided_at timestamptz
);

CREATE TABLE public.dispatch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open',
  job_ledger_id uuid,
  closed_at timestamptz,
  closed_by_user_id uuid,
  closed_note text
);

CREATE TABLE public.job_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid,
  event_type text,
  occurred_at timestamptz,
  actor_user_id uuid,
  summary text,
  detail jsonb,
  financial boolean
);
