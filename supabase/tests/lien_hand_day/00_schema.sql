-- Stand-ins for what the four lien readers touch (20261113190000_lien_hand_day_counts.sql, v2.7193): only the
-- columns they read, typed as the baseline types them, and the helpers they call. The two deadline functions are the
-- real ones (the bed's script applies 20261010001000_lien_blank_kind_residential.sql). See scripts/pgtest-lien-hand-day.sh.
-- Never against prod.
\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;

-- The signed-in person and the day, set by the scenario.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
CREATE OR REPLACE FUNCTION public.app_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT current_setting('bed.today')::date $$;

CREATE TABLE public.users (id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'technician');
CREATE OR REPLACE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'dev') $$;
CREATE OR REPLACE FUNCTION public.is_assistant() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'assistant') $$;

CREATE TABLE public.customers (id uuid PRIMARY KEY, name text NOT NULL DEFAULT '');
CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY,
  property_kind text NOT NULL DEFAULT '',
  owner_name text,
  owner_company text,
  owner_mailing_address text,
  owner_confirmed_at timestamptz,
  county text,
  legal_description text,
  homestead boolean NOT NULL DEFAULT false
);
CREATE TABLE public.jobs_ledger (
  id uuid PRIMARY KEY,
  hcp_number text,
  click_number text,
  job_address text,
  customer_id uuid,
  gc_customer_id uuid,
  customer_address_id uuid,
  status text NOT NULL DEFAULT 'working',
  revenue numeric(12,2),
  payments_made numeric(12,2),
  created_at timestamptz,
  uncollectible_at timestamptz,
  lien_last_work_on date
);
CREATE TABLE public.job_property_owners (job_id uuid PRIMARY KEY, mailing_address text);
CREATE TABLE public.jobs_ledger_invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL, amount numeric(12,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'ready_to_bill');
CREATE TABLE public.clock_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_ledger_id uuid,
  work_date date NOT NULL,
  clocked_in_at timestamptz NOT NULL,
  clocked_out_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  revoked_at timestamptz
);
CREATE TABLE public.job_lien_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  kind text NOT NULL,
  months_covered text[] NOT NULL DEFAULT '{}',
  filed_at date,
  voided_at timestamptz
);
CREATE TABLE public.job_lien_desk_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  months text[] NOT NULL DEFAULT '{}',
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The month a job with no hours is dated from (20260923170000_lien_months_creation_fallback.sql, as written there).
CREATE OR REPLACE FUNCTION public.lien_fallback_month(p_created_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
           WHEN p_created_at IS NULL THEN NULL
           ELSE to_char((p_created_at AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM')
         END
$$;

-- What the sent bills still owe. The real one reads the bills and their payments (the lien_claim bed proves it);
-- here the job's price less its payments is enough, since this bed is about the months.
CREATE OR REPLACE FUNCTION public.lien_billed_open(p_job_id uuid, p_status text, p_revenue numeric, p_payments_made numeric)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT GREATEST(0, COALESCE(p_revenue, 0) - COALESCE(p_payments_made, 0)) $$;
