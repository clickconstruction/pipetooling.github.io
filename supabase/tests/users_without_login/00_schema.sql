-- Stand-in for the slice of prod that 20261104190000_users_login_attached_at.sql touches (punch list #260, v2.6511).
-- Test bed only; made-up data; never prod. auth.users and auth.identities carry prod's columns (\d, 2026-11-04,
-- GoTrue v2.197.0) so the attach step writes what the auth server writes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE auth.users (
  instance_id uuid,
  id uuid NOT NULL PRIMARY KEY,
  aud varchar(255), role varchar(255), email varchar(255), encrypted_password varchar(255),
  email_confirmed_at timestamptz, invited_at timestamptz,
  confirmation_token varchar(255), confirmation_sent_at timestamptz,
  recovery_token varchar(255), recovery_sent_at timestamptz,
  email_change_token_new varchar(255), email_change varchar(255), email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_super_admin boolean,
  created_at timestamptz, updated_at timestamptz,
  phone text DEFAULT NULL, phone_confirmed_at timestamptz,
  phone_change text DEFAULT '', phone_change_token varchar(255) DEFAULT '', phone_change_sent_at timestamptz,
  confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  email_change_token_current varchar(255) DEFAULT '',
  email_change_confirm_status smallint DEFAULT 0 CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
  banned_until timestamptz, reauthentication_token varchar(255) DEFAULT '', reauthentication_sent_at timestamptz,
  is_sso_user boolean NOT NULL DEFAULT false, deleted_at timestamptz, is_anonymous boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX users_email_partial_key ON auth.users (email) WHERE is_sso_user = false;
CREATE TABLE auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data jsonb NOT NULL, provider text NOT NULL,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  email text GENERATED ALWAYS AS (lower(identity_data ->> 'email')) STORED,
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  UNIQUE (provider_id, provider)
);

CREATE TYPE public.user_role AS ENUM ('dev','master_technician','assistant','subcontractor','helpers','estimator','primary','superintendent','controller','master','owner');
-- public.users: the baseline columns plus the later ones the guard and the roster view read.
CREATE TABLE public.users (
  id uuid NOT NULL PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'master',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz, notes text, phone text, archived_at timestamptz,
  read_only boolean NOT NULL DEFAULT false,
  is_digital_twin boolean NOT NULL DEFAULT false,
  is_sample boolean NOT NULL DEFAULT false,
  is_walk_tester boolean NOT NULL DEFAULT false,
  needs_supervision boolean NOT NULL DEFAULT true,
  team_prospects_access boolean NOT NULL DEFAULT false,
  estimator_prospects_access boolean NOT NULL DEFAULT false,
  trial_prospect_id uuid,
  charge_standing text CHECK (charge_standing IS NULL OR charge_standing IN ('master','tech','helper','none')),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public.pay_approved_masters (master_id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.user_has_team_prospects_access() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
-- handle_new_user and the sign-in sync as 20260714213000 / 20260703160000 ship them; the migration replaces the first.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE invited text := NEW.raw_user_meta_data->>'invited_role'; r public.user_role;
BEGIN
  IF invited IN ('dev','master_technician','assistant','subcontractor','helpers','estimator','primary','superintendent','controller') THEN r := invited::public.user_role; ELSE r := 'helpers'::public.user_role; END IF;
  INSERT INTO public.users (id, email, name, role) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), r) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE OR REPLACE FUNCTION public.sync_last_sign_in_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN UPDATE public.users SET last_sign_in_at = NEW.last_sign_in_at WHERE id = NEW.id; RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_signed_in AFTER UPDATE OF last_sign_in_at ON auth.users FOR EACH ROW WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at) EXECUTE FUNCTION public.sync_last_sign_in_at();
-- The guard as 20261022044606 ships it (the migration replaces it); the bed asserts on the column it adds.
CREATE OR REPLACE FUNCTION public.users_guard_privileged_columns() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN RAISE EXCEPTION 'archived_at is managed by the archive/restore flow only' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER users_guard_privileged_columns BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision, team_prospects_access, trial_prospect_id, estimator_prospects_access, is_walk_tester ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id uuid NOT NULL,
  kind text NOT NULL, name text NOT NULL, email text, phone text, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), archived_at timestamptz,
  account_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  start_date date, end_date date,
  CONSTRAINT people_kind_check CHECK (kind = ANY (ARRAY['assistant','master_technician','sub','dev','estimator','primary','superintendent','helper','controller']))
);
CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billing_only boolean NOT NULL DEFAULT false);
CREATE TABLE public.clock_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_ledger_id uuid REFERENCES public.jobs_ledger(id),
  clocked_in_at timestamptz NOT NULL, clocked_out_at timestamptz, work_date date NOT NULL,
  approved_at timestamptz, approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'user_punch',
  CONSTRAINT clock_sessions_origin_check CHECK (origin IN ('user_punch','salary_schedule'))
);
ALTER TABLE public.clock_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own clock sessions" ON public.clock_sessions FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own clock sessions" ON public.clock_sessions FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) AND origin = 'user_punch');
-- The one FK to auth.users that names a receiver (PR 5 re-points it); the bed shows what it does today.
CREATE TABLE public.notification_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, body text);
-- The roster view as 20261022044606 ships it (the migration replaces it).
CREATE VIEW public.roster_people AS
  SELECT (CASE WHEN u.id IS NOT NULL THEN u.id END) AS user_id, (CASE WHEN p.id IS NOT NULL THEN p.id END) AS person_id,
    COALESCE('u:' || u.id::text, 'p:' || p.id::text) AS row_key, COALESCE(NULLIF(btrim(u.name), ''), btrim(p.name)) AS pay_name,
    NULLIF(btrim(u.name), '') AS account_name, btrim(p.name) AS roster_name, u.role::text AS role,
    COALESCE(p.kind, CASE u.role::text WHEN 'helpers' THEN 'helper' WHEN 'subcontractor' THEN 'sub' ELSE u.role::text END) AS kind,
    CASE WHEN u.is_digital_twin THEN 'twin' WHEN u.is_walk_tester THEN 'tester' WHEN u.is_sample THEN 'sample' WHEN u.id IS NULL THEN 'external' ELSE 'person' END AS account_kind,
    COALESCE(u.is_digital_twin, false) AS is_digital_twin, COALESCE(u.is_sample, false) AS is_sample, (u.role::text = 'dev') AS is_dev,
    COALESCE(u.read_only, false) AS read_only, COALESCE(u.needs_supervision, false) AS needs_supervision,
    u.archived_at AS user_archived_at, p.archived_at AS person_archived_at, (u.archived_at IS NOT NULL OR p.archived_at IS NOT NULL) AS is_archived,
    (NOT COALESCE(u.is_digital_twin, false) AND NOT COALESCE(u.is_sample, false) AND NOT COALESCE(u.is_walk_tester, false) AND u.archived_at IS NULL AND p.archived_at IS NULL) AS is_pay_roster,
    (NOT COALESCE(u.is_digital_twin, false) AND NOT COALESCE(u.is_sample, false) AND NOT COALESCE(u.is_walk_tester, false) AND u.archived_at IS NULL AND p.archived_at IS NULL AND (u.role IS NULL OR u.role::text <> 'dev')) AS is_active_roster,
    (u.id IS NOT NULL) AS has_login, (p.id IS NOT NULL) AS has_roster_row, p.start_date AS start_date, p.end_date AS end_date, p.master_user_id AS master_user_id,
    COALESCE(u.is_walk_tester, false) AS is_walk_tester
  FROM public.users u FULL OUTER JOIN public.people p ON p.account_user_id = u.id
  WHERE (SELECT auth.uid()) IS NOT NULL AND COALESCE(NULLIF(btrim(u.name), ''), NULLIF(btrim(p.name), '')) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev') $$;
CREATE OR REPLACE FUNCTION public.is_master_or_dev() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev','master_technician')) $$;
CREATE OR REPLACE FUNCTION public.is_assistant() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('assistant','controller')) $$;
CREATE OR REPLACE FUNCTION public.is_office_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.is_master_or_dev() OR public.is_assistant() $$;
CREATE POLICY "Devs can read all clock sessions" ON public.clock_sessions FOR SELECT USING (public.is_dev());
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Test helpers.
CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_msg; END IF; END $$;
CREATE OR REPLACE FUNCTION public.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $$;
-- What GoTrue writes on POST /admin/users (NewUser and the email identity) — the bed's stand-in for the auth server,
-- with the chosen id the endpoint has taken since v2.155.0.
CREATE OR REPLACE FUNCTION auth.t_gotrue_admin_create(p_id uuid, p_email text, p_password text, p_meta jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid := COALESCE(p_id, gen_random_uuid());
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(p_email), crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', p_meta, now(), now(), '', '', '', '');
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true), 'email', now(), now());
  RETURN v_id;
END $$;
