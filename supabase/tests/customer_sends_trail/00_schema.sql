-- Stand-ins for the tables 20261019030000_customer_sends_to_activity.sql reads and writes (v2.5636). Only the
-- columns the migration touches; the real ones live in 20260903141146 (job_contracts, job_contract_events),
-- 20260902160748 (job_demand_letters), 20260902164655 and 20260923200000 (job_lien_filings), 20261005173119
-- (sent_documents) and 20260608010000 (job_activity_events). See scripts/pgtest-customer-sends-trail.sh. Never
-- against prod.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE SCHEMA IF NOT EXISTS bedt;
CREATE OR REPLACE FUNCTION bedt.ok(p_name text, p_pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_pass THEN RAISE NOTICE 'ok: %', p_name; ELSE RAISE EXCEPTION 'FAILED: %', p_name; END IF;
END $$;
CREATE OR REPLACE FUNCTION bedt.as_user(p_user uuid) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true) $$;

CREATE TABLE public.users (id uuid PRIMARY KEY, name text);
CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY, job_name text);
CREATE TABLE public.jobs_ledger_invoices (
  id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES public.jobs_ledger(id), status text, amount numeric,
  external_send_channel text, sent_to_customer_at timestamptz
);
CREATE TABLE public.job_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent',
  template_name text,
  recipient_email text,
  reminder_count integer NOT NULL DEFAULT 0
);
CREATE TABLE public.job_contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.job_contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'viewed', 'reminded', 'signed', 'voided', 'recorded', 'shared', 'reopened')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.job_demand_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  deadline_date date,
  recipient_name text NOT NULL DEFAULT '',
  recipient_email text NOT NULL DEFAULT '',
  sent_method text NOT NULL DEFAULT ''
    CHECK (sent_method IN ('', 'certified_mail', 'traceable_courier', 'email', 'hand')),
  tracking_number text NOT NULL DEFAULT '',
  sent_at date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz
);
CREATE TABLE public.job_lien_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('notice_53_056', 'affidavit', 'release_of_record', 'retainage_53_057')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  sends jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz
);
CREATE TABLE public.sent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  how text NOT NULL,
  recipient_emails text[] NOT NULL DEFAULT '{}',
  job_ids uuid[] NOT NULL DEFAULT '{}',
  source_table text NOT NULL DEFAULT '',
  source_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
-- As 20260608010000 makes it, the two indexes included.
CREATE TABLE public.job_activity_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES public.users(id),
  summary       text NOT NULL DEFAULT '',
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial     boolean NOT NULL DEFAULT false
);
CREATE INDEX job_activity_events_job_occurred_idx ON public.job_activity_events (job_id, occurred_at DESC);
CREATE INDEX job_activity_events_source_idx ON public.job_activity_events (event_type, (detail ->> 'source_id'));

-- One line of the trail by its source row.
CREATE OR REPLACE FUNCTION bedt.line(p_type text, p_source uuid) RETURNS public.job_activity_events LANGUAGE sql AS
  $$ SELECT * FROM public.job_activity_events WHERE event_type = p_type AND detail ->> 'source_id' = p_source::text $$;
