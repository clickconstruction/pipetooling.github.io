-- Minimal stand-in for the prod schema the typed_hours_second_look migration touches. Test bed only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
-- The signed-in person is a transaction-local setting, as PostgREST sets it on prod.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  name text,
  role text NOT NULL,
  is_sample boolean NOT NULL DEFAULT false,
  archived_at timestamptz
);
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value_num numeric,
  value_text text
);
CREATE TABLE public.clock_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clocked_in_at timestamptz NOT NULL,
  clocked_out_at timestamptz,
  work_date date NOT NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  notes text NOT NULL DEFAULT '',
  job_ledger_id uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  revoked_at timestamptz,
  revoked_by uuid,
  bid_id uuid,
  origin text NOT NULL DEFAULT 'user_punch' CHECK (origin IN ('user_punch', 'salary_schedule')),
  salary_segment_index smallint,
  quick_add_minutes smallint
);
CREATE INDEX idx_clock_sessions_user_date ON public.clock_sessions (user_id, work_date);
CREATE TABLE public.people_hours (
  person_name text NOT NULL,
  work_date date NOT NULL,
  hours numeric NOT NULL,
  entered_by uuid,
  person_id uuid,
  PRIMARY KEY (person_name, work_date)
);

CREATE OR REPLACE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev')
$$;
CREATE OR REPLACE FUNCTION public.is_assistant() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('assistant', 'controller'))
$$;
CREATE OR REPLACE FUNCTION public.has_payroll_access() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'controller'))
$$;
CREATE OR REPLACE FUNCTION public.is_team_lead_for_member(p_leader uuid, p_member uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.resolve_pay_person_id_from_clock_user(p_user uuid, p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION public.sync_crew_jobs_from_clock(p_name text, p_date date) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.sync_crew_bids_from_clock(p_name text, p_date date) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_read_only_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_read_only_stmt_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;

-- Test helpers.
CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_msg; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true)
$$;
