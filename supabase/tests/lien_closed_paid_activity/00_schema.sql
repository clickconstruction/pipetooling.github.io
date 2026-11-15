-- Stand-ins for the tables 20261115233000_lien_closed_paid_to_activity.sql reads and writes (v2.7359). Only the
-- columns the migration touches; the real ones live in 20260914180000 and 20260929054429 (job_lien_desk_items) and
-- 20260608010000 (job_activity_events). See scripts/pgtest-lien-closed-paid-activity.sh. Never against prod.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS bedt;
CREATE OR REPLACE FUNCTION bedt.ok(p_name text, p_pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_pass THEN RAISE NOTICE 'ok: %', p_name; ELSE RAISE EXCEPTION 'FAILED: %', p_name; END IF;
END $$;

CREATE TABLE public.users (id uuid PRIMARY KEY, name text);
CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY, job_name text);

CREATE TABLE public.job_lien_desk_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'notice_53_056',
  months     text[] NOT NULL DEFAULT '{}',
  status     text NOT NULL DEFAULT 'drafted',
  fields     jsonb NOT NULL DEFAULT '{}'::jsonb,
  printed_at timestamptz,
  voided_at  timestamptz
);

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
CREATE INDEX job_activity_events_source_idx ON public.job_activity_events (event_type, (detail ->> 'source_id'));

-- The close's line for one desk item, and how many it has.
CREATE OR REPLACE FUNCTION bedt.line(p_item uuid) RETURNS public.job_activity_events LANGUAGE sql AS
  $$ SELECT * FROM public.job_activity_events WHERE event_type = 'lien_notice_closed_paid' AND detail ->> 'source_id' = p_item::text $$;
CREATE OR REPLACE FUNCTION bedt.lines(p_item uuid) RETURNS bigint LANGUAGE sql AS
  $$ SELECT count(*) FROM public.job_activity_events WHERE event_type = 'lien_notice_closed_paid' AND detail ->> 'source_id' = p_item::text $$;
