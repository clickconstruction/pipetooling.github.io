-- Stand-in schema for supabase/tests/bid_reply_book (v2.4025): the roles, auth.uid(), the
-- users table and the house-rule functions the migration calls. Run by hand against a throwaway
-- Postgres 15 — see docs/migrations/20260928144511_bid_reply_book.md. Never against prod.
DROP DATABASE IF EXISTS bed;
CREATE DATABASE bed;
\c bed
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('bed.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TYPE public.user_role AS ENUM ('owner','master','assistant','subcontractor','master_technician','dev','estimator','primary','superintendent','helpers','controller');
CREATE TABLE public.users (id uuid PRIMARY KEY, email text NOT NULL, name text NOT NULL, role public.user_role NOT NULL);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.is_dev() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev') $$;
CREATE FUNCTION public.apply_read_only_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION public.apply_read_only_stmt_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION public.apply_digital_twin_write_blocks() RETURNS void LANGUAGE sql AS $$ SELECT $$;
INSERT INTO public.users VALUES
 ('00000000-0000-0000-0000-000000000001','w@x','Wendi','estimator'),
 ('00000000-0000-0000-0000-000000000002','a@x','Alex','estimator'),
 ('00000000-0000-0000-0000-000000000003','d@x','Dev','dev'),
 ('00000000-0000-0000-0000-000000000004','h@x','Helper','helpers'),
 ('00000000-0000-0000-0000-000000000005','p@x','Prim','primary'),
 ('00000000-0000-0000-0000-000000000006','s@x','Super','superintendent'),
 ('00000000-0000-0000-0000-000000000007','c@x','Cont','controller');
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated, service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
