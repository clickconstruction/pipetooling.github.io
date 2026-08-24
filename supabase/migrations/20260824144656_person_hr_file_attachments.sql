SET lock_timeout = '3s';

-- v2.2231 (HR files: exhibits). person_file_attachments — files (evidence
-- exhibits, statements, screenshots) attached to a person's HR file, optionally
-- linked to a specific raw entry. Bytes live in the private 'hr-files' storage
-- bucket; this table is the metadata + linkage. Dev-only like the rest of the
-- HR system; hr_agent may read + insert (no update/delete — corrections follow
-- the entries convention: upload a replacement and note it).
--
-- NOTE (storage): the 'hr-files' bucket and its storage.objects policies are
-- created OUT-OF-BAND, matching how this project's existing buckets
-- (estimate-acceptor-signatures, contract-signer-signatures) were set up —
-- storage schema objects are not tracked by this migration ledger. See
-- docs/HR_FILES.md § "Exhibits" for the exact bucket + policy SQL.
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.person_file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.person_file_entries(id) ON DELETE SET NULL,
  -- object path inside the 'hr-files' bucket: <person_id>/<uuid>-<filename>
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  author_label text,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.person_file_attachments IS
  'HR file exhibits (v2.2231): metadata for files in the private hr-files bucket, attached to a person''s HR file and optionally a specific raw entry. Dev-only; hr_agent may read/insert. No UPDATE policies — replace-and-note, like entry corrections.';

CREATE INDEX IF NOT EXISTS idx_person_file_attachments_person
  ON public.person_file_attachments (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_person_file_attachments_entry
  ON public.person_file_attachments (entry_id);

ALTER TABLE public.person_file_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs can read person file attachments" ON public.person_file_attachments;
CREATE POLICY "Devs can read person file attachments" ON public.person_file_attachments
  FOR SELECT USING (public.is_dev());
DROP POLICY IF EXISTS "Devs can add person file attachments" ON public.person_file_attachments;
CREATE POLICY "Devs can add person file attachments" ON public.person_file_attachments
  FOR INSERT WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs can remove person file attachments" ON public.person_file_attachments;
CREATE POLICY "Devs can remove person file attachments" ON public.person_file_attachments
  FOR DELETE USING (public.is_dev());

GRANT SELECT, INSERT ON public.person_file_attachments TO hr_agent;
DROP POLICY IF EXISTS "hr_agent reads person file attachments" ON public.person_file_attachments;
CREATE POLICY "hr_agent reads person file attachments" ON public.person_file_attachments
  FOR SELECT TO hr_agent USING (true);
DROP POLICY IF EXISTS "hr_agent adds person file attachments" ON public.person_file_attachments;
CREATE POLICY "hr_agent adds person file attachments" ON public.person_file_attachments
  FOR INSERT TO hr_agent WITH CHECK (true);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
