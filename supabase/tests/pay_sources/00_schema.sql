-- Minimal stand-in for the prod schema the pay_sources migration touches. Test bed only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT 'ad5f7f76-153a-4a19-8da8-db028b3bf4d7'::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('test.role', true), 'authenticated') $$;
CREATE OR REPLACE FUNCTION public.has_payroll_access() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('test.payroll', true), 'on') = 'on' $$;

CREATE TABLE public.pay_stubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text NOT NULL,
  person_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_pay numeric NOT NULL,
  hours_total numeric NOT NULL DEFAULT 0,
  paid_at timestamptz,
  paid_by uuid,
  paid_note text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);
CREATE TABLE public.pay_stub_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id uuid NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at timestamptz NOT NULL,
  memo text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);
CREATE TABLE public.pay_stub_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id uuid NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  source text,
  description text
);
CREATE TABLE public.pay_stub_additional_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id uuid NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  line_total numeric
);
CREATE TABLE public.person_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text NOT NULL,
  person_id uuid,
  type text NOT NULL CHECK (type IN ('backcharge','damage','employee_credit','profit_share','utility_overage','advance')),
  amount numeric NOT NULL,
  description text,
  occurred_date date NOT NULL,
  pay_stub_id uuid,
  job_id uuid,
  reversal_of_offset_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.mercury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  posted_at timestamptz,
  kind text,
  status text,
  counterparty_name text,
  external_memo text,
  note text
);
CREATE TABLE public.cashapp_transactions (
  id text PRIMARY KEY,
  occurred_at_text text,
  occurred_date date NOT NULL,
  tx_type text,
  status text,
  currency text,
  amount numeric NOT NULL,
  fee numeric,
  net_amount numeric,
  counterparty text,
  note text,
  account text,
  lane text NOT NULL DEFAULT 'review' CHECK (lane IN ('review','recorded','advance','expense','before_records','not_staff','ignored')),
  person_name text,
  match_rule text CHECK (match_rule IS NULL OR match_rule IN ('id','amount','split','memo','manual')),
  pay_stub_payment_id uuid,
  person_offset_id uuid,
  decided_at timestamptz,
  decided_by uuid,
  imported_at timestamptz DEFAULT now(),
  imported_by uuid
);
-- v2.3584 person-admin stand-ins
CREATE TABLE public.people_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text NOT NULL,
  person_id uuid,
  work_date date NOT NULL,
  hours numeric NOT NULL,
  entered_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE (person_name, work_date)
);
CREATE TABLE public.people_pay_config (
  person_name text PRIMARY KEY,
  person_id uuid,
  hourly_wage numeric,
  office_hourly_wage numeric,
  is_salary boolean NOT NULL DEFAULT false,
  record_hours_but_salary boolean NOT NULL DEFAULT false,
  show_in_hours boolean NOT NULL DEFAULT true,
  vehicle_arrangement text NOT NULL DEFAULT 'none',
  vehicle_rate_override numeric
);
CREATE TABLE public.cashapp_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_key text UNIQUE NOT NULL,
  counterparty text NOT NULL,
  person_name text,
  not_staff boolean NOT NULL DEFAULT false,
  note_contains text,
  note_person_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
CREATE TABLE public.pay_stub_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id uuid NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  hours numeric NOT NULL DEFAULT 0
);
-- the house-rule helpers the migration calls at the end (no-ops in the bed)
CREATE OR REPLACE FUNCTION public.apply_read_only_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT NULL::void $$;
CREATE OR REPLACE FUNCTION public.apply_read_only_stmt_blocks() RETURNS void LANGUAGE sql AS $$ SELECT NULL::void $$;
CREATE OR REPLACE FUNCTION public.apply_digital_twin_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT NULL::void $$;
