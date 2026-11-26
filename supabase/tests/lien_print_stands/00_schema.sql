-- Stand-ins for what 20261125210500_lien_print_stands.sql touches (v2.8595, punch list #362 step 7): the two tables
-- its rows point at, the role helpers its gate calls, and the four fence appliers as no-ops (the real ones are proved
-- by their own beds). See scripts/pgtest-lien-print-stands.sh. Never against prod.
\set ON_ERROR_STOP on
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

-- The signed-in person, set by the scenario.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE public.users (id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'technician');
CREATE OR REPLACE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'dev') $$;
-- Assistant-like: a controller too, as the real helper has it.
CREATE OR REPLACE FUNCTION public.is_assistant() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('assistant', 'controller')) $$;
-- The real users table lets a signed-in person read the roster's roles; the stand-in does the same.
GRANT SELECT ON public.users TO authenticated;

CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY, hcp_number text);

CREATE OR REPLACE FUNCTION public.apply_read_only_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_read_only_stmt_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_digital_twin_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE OR REPLACE FUNCTION public.apply_archived_read_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
