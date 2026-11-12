SET lock_timeout = '3s';

-- First look, the spike (punch list #319, v2.6981). The owner's idea of 2026-11-11: a caller gets a link by text, adds
-- photos and a short video of the problem on a page with no sign-in, and the office prices it before a truck rolls.
-- The card's plan put a spike first, to answer on real phones what no desk can: does a video go up in pieces with a
-- link's key, does it survive a lost signal, how big is it, does it play. The owner asked for the spike on main so he
-- can try it on his own phone. This file is its ground and nothing more: two tables and one private bucket.
--
--   1. first_looks: one row an ask. Who it is for (a Messages contact, or nobody yet for a test), who asked, the
--      SHA-256 of the link's ten-letter code (the code itself is handed out once and never kept, as an estimate's
--      share link is), the day the link stops, and the stamps the owner will later count from: made, opened, sent,
--      looked at, closed. Where the problem is and their words, as the page's two optional fields.
--   2. first_look_files: one row a file the page was handed an upload address for. Its kind, type and declared size,
--      where it sits in the bucket, and what the spike measures: the bytes that arrived, a video's length, whether it
--      went in pieces or whole, how many times it picked up after a drop, how long it took, and which phone sent it.
--   3. The bucket first-look-files: private, pictures and video only, 50 MiB a file, which is the live project's own
--      limit today. No storage policy at all: nobody signed in or signed out reads or writes it directly. The
--      first-look function hands the page a one-file upload address after its caps, and hands the desk a link that
--      opens one file for an hour.
--
-- Who may do what. Both tables are read by the office team (gc_office_team), the people who read a customer's thread.
-- Nobody writes them from the app: there is no INSERT, UPDATE or DELETE policy for any of the nine roles, so every
-- write is the first-look function's, as the service role, after it has checked the link's code or the caller's role.
-- A visitor who is not signed in has no grant on either table.

CREATE TABLE IF NOT EXISTS public.first_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '' CHECK (char_length(label) <= 120),
  asked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  asked_by_name text NOT NULL DEFAULT '' CHECK (char_length(asked_by_name) <= 120),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  made_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  looked_at timestamptz,
  looked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  place text CHECK (place IS NULL OR char_length(place) <= 60),
  words text CHECK (words IS NULL OR char_length(words) <= 1000),
  CONSTRAINT first_looks_code_hash_key UNIQUE (code_hash)
);

COMMENT ON TABLE public.first_looks IS
  'First look (punch list #319): one ask for photos or a video of a problem, sent as a link with no sign-in. Written only by the first-look edge function.';
COMMENT ON COLUMN public.first_looks.code_hash IS
  'SHA-256 of the link''s ten-letter code. The code is handed out once and never kept.';

CREATE INDEX IF NOT EXISTS first_looks_made_idx ON public.first_looks (made_at DESC);
CREATE INDEX IF NOT EXISTS first_looks_contact_idx ON public.first_looks (contact_id, made_at DESC) WHERE contact_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.first_look_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  look_id uuid NOT NULL REFERENCES public.first_looks(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo', 'video')),
  mime text NOT NULL CHECK (char_length(mime) <= 80),
  name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 200),
  storage_path text NOT NULL CHECK (char_length(storage_path) <= 200),
  declared_bytes bigint NOT NULL CHECK (declared_bytes > 0),
  bytes bigint CHECK (bytes IS NULL OR bytes >= 0),
  seconds numeric CHECK (seconds IS NULL OR seconds >= 0),
  road text CHECK (road IS NULL OR road IN ('pieces', 'whole')),
  resumed integer NOT NULL DEFAULT 0 CHECK (resumed >= 0),
  took_ms integer CHECK (took_ms IS NULL OR took_ms >= 0),
  client text CHECK (client IS NULL OR char_length(client) <= 80),
  signed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  removed_at timestamptz,
  CONSTRAINT first_look_files_path_key UNIQUE (storage_path)
);

COMMENT ON TABLE public.first_look_files IS
  'First look (punch list #319): one file a link was handed an upload address for, with what the spike measures. Written only by the first-look edge function.';

CREATE INDEX IF NOT EXISTS first_look_files_look_idx ON public.first_look_files (look_id, signed_at);

ALTER TABLE public.first_looks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS first_looks_select_office ON public.first_looks;
CREATE POLICY first_looks_select_office ON public.first_looks FOR SELECT TO authenticated
  USING (public.gc_office_team());
REVOKE ALL ON TABLE public.first_looks FROM anon, authenticated;
GRANT SELECT ON TABLE public.first_looks TO authenticated;
GRANT ALL ON TABLE public.first_looks TO service_role;

ALTER TABLE public.first_look_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS first_look_files_select_office ON public.first_look_files;
CREATE POLICY first_look_files_select_office ON public.first_look_files FOR SELECT TO authenticated
  USING (public.gc_office_team());
REVOKE ALL ON TABLE public.first_look_files FROM anon, authenticated;
GRANT SELECT ON TABLE public.first_look_files TO authenticated;
GRANT ALL ON TABLE public.first_look_files TO service_role;

-- The bucket: private, pictures and video only, 50 MiB a file (the live project's own limit, read 2026-11-11).
-- Objects are named <look id>/<file id>.<ext>. No policy on storage.objects names this bucket, so only the service
-- role reads or writes it; a page uploads through a one-file address the function signs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'first-look-files',
  'first-look-files',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp']
)
ON CONFLICT (id) DO NOTHING;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
