-- Stand-ins for the tables 20261019010000_stripe_email_sends_to_activity.sql reads and writes (v2.5634). Only the
-- columns the migration touches; the real ones live in the baseline and 20260608010000. See
-- scripts/pgtest-stripe-email-sends-trail.sh. Never against prod.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
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
  stripe_invoice_id text, external_send_channel text, sent_to_customer_at timestamptz
);
CREATE TABLE public.jobs_ledger_invoice_stripe_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jobs_ledger_invoice_id uuid NOT NULL,
  sent_at timestamptz NOT NULL,
  stripe_invoice_id text,
  copy_emails text[],
  created_at timestamptz DEFAULT now()
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
