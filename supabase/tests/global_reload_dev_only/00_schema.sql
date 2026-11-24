-- Minimal stand-in for what the global_reload_dev_only migration touches (v2.8532). Test bed only.
--
-- On prod Realtime's own service makes realtime.messages, turns row security on it and grants it to the API roles, so
-- the row policies are the only gate. Realtime checks a join by trying, as the person's role with their claims and
-- the channel's topic set, a read and a write of a row on that topic. bedt.hears and bedt.sends do the same.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
-- The signed-in person is a transaction-local setting, as the API sets it on prod.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

CREATE TABLE public.users (id uuid PRIMARY KEY, name text, role text NOT NULL);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- The baseline's own is_dev, word for word.
CREATE OR REPLACE FUNCTION public.is_dev() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'dev'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_dev() TO authenticated, anon;

CREATE SCHEMA IF NOT EXISTS realtime;
CREATE TABLE realtime.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  extension text NOT NULL,
  payload jsonb,
  event text,
  private boolean DEFAULT false,
  inserted_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('realtime.topic', true), '')::text
$$;
GRANT USAGE ON SCHEMA realtime TO authenticated, anon;
GRANT SELECT, INSERT ON realtime.messages TO authenticated, anon;
GRANT EXECUTE ON FUNCTION realtime.topic() TO authenticated, anon;

CREATE SCHEMA IF NOT EXISTS bedt;
GRANT USAGE ON SCHEMA bedt TO authenticated, anon;
CREATE OR REPLACE FUNCTION bedt.ok(p_name text, p_pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_pass THEN RAISE NOTICE 'ok: %', p_name; ELSE RAISE EXCEPTION 'FAILED: %', p_name; END IF;
END $$;

-- Can this person, in this role, SEND on a channel? The write Realtime tries: a row of the channel's topic and kind.
CREATE OR REPLACE FUNCTION bedt.sends(p_role text, p_user uuid, p_topic text, p_extension text DEFAULT 'broadcast')
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_ok boolean := true;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('realtime.topic', p_topic, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    INSERT INTO realtime.messages (topic, extension) VALUES (p_topic, p_extension);
  EXCEPTION WHEN insufficient_privilege THEN
    v_ok := false;
  END;
  RESET ROLE;
  DELETE FROM realtime.messages;
  RETURN v_ok;
END $$;

-- Can this person, in this role, HEAR a channel? The read Realtime tries: is a row of that topic and kind theirs to see.
CREATE OR REPLACE FUNCTION bedt.hears(p_role text, p_user uuid, p_topic text, p_extension text DEFAULT 'broadcast')
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_seen integer;
BEGIN
  INSERT INTO realtime.messages (topic, extension) VALUES (p_topic, p_extension);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('realtime.topic', p_topic, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  SELECT count(*) INTO v_seen FROM realtime.messages;
  RESET ROLE;
  DELETE FROM realtime.messages;
  RETURN v_seen > 0;
END $$;

INSERT INTO public.users (id, name, role) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'ZZ Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000000a1', 'ZZ Master', 'master_technician'),
  ('00000000-0000-0000-0000-0000000000a2', 'ZZ Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a3', 'ZZ Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000000a4', 'ZZ Subcontractor', 'subcontractor');
