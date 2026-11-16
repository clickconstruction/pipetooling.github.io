-- Stand-ins for what set_property_lien_public_answer touches (20261116201500_property_lien_public_answer.sql, v2.7436):
-- only the columns it and the Collections flag read and write, typed as the baseline types them, and the helpers they
-- call. The Collections flag itself is the real one: the bed's script lifts set_job_collections_flag out of
-- 20261007170000_job_uncollectible.sql. See scripts/pgtest-property-lien-public-answer.sh. Never against prod.
\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;

-- The signed-in person, set by the scenario.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE public.users (id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'technician');
CREATE OR REPLACE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'dev') $$;
CREATE OR REPLACE FUNCTION public.is_office_or_estimator() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')) $$;
CREATE OR REPLACE FUNCTION public.assistants_share_master(p_user uuid, p_master uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY,
  owner_name text NOT NULL DEFAULT '',
  updated_at timestamptz
);
CREATE TABLE public.jobs_ledger (
  id uuid PRIMARY KEY,
  hcp_number text,
  status text NOT NULL DEFAULT 'working',
  master_user_id uuid,
  customer_address_id uuid,
  lien_payment_bond text NOT NULL DEFAULT 'unknown',
  collections_at timestamptz,
  collections_by uuid,
  collections_note text,
  uncollectible_at timestamptz,
  uncollectible_by uuid,
  uncollectible_reason text,
  updated_at timestamptz
);
CREATE TABLE public.job_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  summary text,
  detail jsonb,
  financial boolean NOT NULL DEFAULT false
);
