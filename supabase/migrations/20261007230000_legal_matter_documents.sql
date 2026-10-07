SET lock_timeout = '3s';

-- Documents from the office on a legal matter (v2.4810, the owner's ask of 2026-10-07): the
-- portal counted evidence but could not hold a document, so an evidence package lived in a
-- folder beside it. One row per file the office puts on a matter — a title, one line on what it
-- shows, the file in a private bucket — read by the firm's portal through 15-minute signed links
-- the legal-portal function mints as the service role. The office may hold a document back with
-- a reason (the firm sees the count), and retires one rather than deleting it. Additive,
-- idempotent. One CREATE TABLE and one bucket.

CREATE TABLE IF NOT EXISTS public.legal_matter_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  title text NOT NULL,
  -- One line the firm reads beside the title: what the document shows.
  shows text NOT NULL,
  -- <matter_id>/<id>-<original name>, in the legal-matter-documents bucket.
  storage_path text NOT NULL,
  mime text NOT NULL DEFAULT '',
  size_bytes integer NOT NULL DEFAULT 0,
  original_name text NOT NULL DEFAULT '',
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  -- '' = goes to counsel; a reason holds it back, as held_overrides does for an entry.
  held_reason text NOT NULL DEFAULT '',
  voided_at timestamp with time zone,
  voided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT legal_matter_documents_title_check CHECK (length(btrim(title)) > 0),
  CONSTRAINT legal_matter_documents_shows_check CHECK (length(btrim(shows)) > 0)
);

COMMENT ON TABLE public.legal_matter_documents IS
  'Documents the office puts on a legal matter for the firm (v2.4810): a title, one line on what it shows, the file in the legal-matter-documents bucket. held_reason keeps one back; voided_at retires one. The portal reads them through signed links.';

CREATE INDEX IF NOT EXISTS legal_matter_documents_matter_idx ON public.legal_matter_documents (matter_id, added_at) WHERE voided_at IS NULL;

-- Who added and who removed a document come from the session, never from the browser's payload.
CREATE OR REPLACE FUNCTION public.legal_matter_documents_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.added_by := COALESCE(auth.uid(), NEW.added_by);
    NEW.added_at := now();
  ELSIF NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    NEW.voided_by := COALESCE(auth.uid(), NEW.voided_by);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS legal_matter_documents_stamp ON public.legal_matter_documents;
CREATE TRIGGER legal_matter_documents_stamp BEFORE INSERT OR UPDATE ON public.legal_matter_documents
  FOR EACH ROW EXECUTE FUNCTION public.legal_matter_documents_stamp();

ALTER TABLE public.legal_matter_documents ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_matter_documents' AND policyname = 'legal_matter_documents_office_select') THEN
    CREATE POLICY legal_matter_documents_office_select ON public.legal_matter_documents FOR SELECT TO authenticated USING (public.legal_office_can_read());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_matter_documents' AND policyname = 'legal_matter_documents_office_insert') THEN
    CREATE POLICY legal_matter_documents_office_insert ON public.legal_matter_documents FOR INSERT TO authenticated WITH CHECK (public.legal_office_can_read());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_matter_documents' AND policyname = 'legal_matter_documents_office_update') THEN
    CREATE POLICY legal_matter_documents_office_update ON public.legal_matter_documents FOR UPDATE TO authenticated USING (public.legal_office_can_read()) WITH CHECK (public.legal_office_can_read());
  END IF;
  -- No DELETE policy on purpose: a document is retired (voided_at), never deleted.
END
$policies$;

REVOKE ALL ON TABLE public.legal_matter_documents FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.legal_matter_documents TO authenticated;

-- The files: a private bucket; the office cohort reads and writes under the matter's folder; the
-- portal function reads as the service role, which bypasses these policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-matter-documents', 'legal-matter-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS legal_matter_documents_office_rw ON storage.objects;
CREATE POLICY legal_matter_documents_office_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'legal-matter-documents'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.legal_office_can_read()
  )
  WITH CHECK (
    bucket_id = 'legal-matter-documents'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.legal_office_can_read()
  );

-- The fences every new table carries (training mode, read-only statements, digital twins).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
