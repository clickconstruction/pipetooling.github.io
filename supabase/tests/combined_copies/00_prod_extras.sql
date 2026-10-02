-- What prod has that supabase/migrations does not create (v2.4388), for a throwaway bed built from
-- the Supabase Postgres image: the two extensions the cron migrations call, and the storage API's
-- tables its own service makes. Run as supabase_admin before the migrations. Never against prod.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, owner uuid, public boolean DEFAULT false, file_size_limit bigint,
  allowed_mime_types text[], avif_autodetection boolean DEFAULT false, owner_id text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid,
  owner_id text, metadata jsonb, user_metadata jsonb, path_tokens text[], version text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), last_accessed_at timestamptz DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;
GRANT ALL ON storage.buckets, storage.objects TO postgres, anon, authenticated, service_role;
ALTER TABLE storage.buckets OWNER TO postgres;
ALTER TABLE storage.objects OWNER TO postgres;
