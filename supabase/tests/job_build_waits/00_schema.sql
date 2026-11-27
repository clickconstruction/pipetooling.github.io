-- Stand-ins for what 20261127074500_job_build_waits.sql touches (v2.8709, punch list #192 write A): the tables its
-- rows point at and write to, the helpers its gate calls, a jobs_ledger with a read policy of its own so the wait's
-- policy has something to follow, and the four fence appliers as no-ops (the real ones are proved by their own beds).
-- See scripts/pgtest-job-build-waits.sh. Never against prod.
\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

-- The signed-in person, set by the scenario.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE public.users (id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'helpers', name text, read_only boolean NOT NULL DEFAULT false, archived_at timestamptz);
GRANT SELECT ON public.users TO authenticated;
-- The office, as the real helper has it: dev, owner, assistant, controller.
CREATE OR REPLACE FUNCTION public.is_office_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')) $$;
CREATE OR REPLACE FUNCTION public.caller_is_archived() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.archived_at IS NOT NULL) $$;
CREATE OR REPLACE FUNCTION public.is_read_only() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.read_only) $$;

-- A job, read by the office and by the people on it. The real table's policies are wider; the wait's policy only
-- needs a job some people read and some do not.
CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY, hcp_number text);
CREATE TABLE public.job_crew (job_id uuid NOT NULL, user_id uuid NOT NULL);
GRANT SELECT ON public.jobs_ledger, public.job_crew TO authenticated;
ALTER TABLE public.jobs_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY jobs_ledger_read ON public.jobs_ledger FOR SELECT TO authenticated
  USING (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.job_crew c WHERE c.job_id = jobs_ledger.id AND c.user_id = auth.uid()));

-- The job's Activity, as the baseline has it.
CREATE TABLE public.job_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial boolean NOT NULL DEFAULT false
);

CREATE OR REPLACE FUNCTION public.apply_read_only_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_read_only_stmt_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_digital_twin_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_archived_read_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
