SET lock_timeout = '3s';

-- Write someone up (punch list #410, PR 5): the photos a leader or a superintendent takes for a write-up.
--   person_report_photos  one row a photo, keyed to the write-up's press (press_id, the id the phone mints when the
--                         writer opens the read-back). A write-up lands in person_reports with the same press_id, so
--                         the two are joined by it and the landing needs no change. A photo is taken before the
--                         write-up is sent, so a row can stand with no report yet: the writer may drop it until then.
--   person-report-photos  the private bucket. Objects are named <author_user_id>/<press_id>/<photo_id>.jpg, so the
--                         policies read the writer from the path.
-- Who: the writer adds and reads their own. A dev reads all of them, as a dev reads the reports. Nobody else reads a
-- row or a file: not the person written about, not another leader. Nothing is updated.
-- Additive and idempotent. The four fences close the file.

CREATE OR REPLACE FUNCTION public.can_write_someone_up()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = (SELECT auth.uid())
       AND u.archived_at IS NULL
       AND u.role::text IN ('dev', 'master_technician', 'superintendent')
  );
$$;
ALTER FUNCTION public.can_write_someone_up() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.can_write_someone_up() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_someone_up() TO authenticated;
COMMENT ON FUNCTION public.can_write_someone_up() IS
  'Write someone up (#410): true for an active leader, superintendent or dev, the roles land_person_report takes a write-up from.';

CREATE TABLE IF NOT EXISTS public.person_report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  press_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  bytes integer NULL CHECK (bytes IS NULL OR bytes >= 0),
  width integer NULL CHECK (width IS NULL OR width > 0),
  height integer NULL CHECK (height IS NULL OR height > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_report_photos_path_key UNIQUE (storage_path)
);

COMMENT ON TABLE public.person_report_photos IS
  'Write someone up (#410): a photo taken for a write-up, in the private person-report-photos bucket. Keyed to the write-up''s press_id, which person_reports.press_id carries once the write-up lands. The writer adds and reads their own; a dev reads all.';
COMMENT ON COLUMN public.person_report_photos.press_id IS 'The write-up''s press: person_reports.press_id once the write-up has landed.';
COMMENT ON COLUMN public.person_report_photos.storage_path IS 'The object in person-report-photos: <author_user_id>/<press_id>/<photo_id>.jpg.';
COMMENT ON COLUMN public.person_report_photos.taken_at IS 'When the photo was taken on the phone.';

CREATE INDEX IF NOT EXISTS idx_person_report_photos_press ON public.person_report_photos (press_id);
CREATE INDEX IF NOT EXISTS idx_person_report_photos_author ON public.person_report_photos (author_user_id, created_at DESC);

ALTER TABLE public.person_report_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_report_photos_select ON public.person_report_photos;
CREATE POLICY person_report_photos_select ON public.person_report_photos
  FOR SELECT TO authenticated
  USING ((SELECT public.is_dev()) OR author_user_id = (SELECT auth.uid()));

-- The writer adds a photo under their own name and their own folder.
DROP POLICY IF EXISTS person_report_photos_insert ON public.person_report_photos;
CREATE POLICY person_report_photos_insert ON public.person_report_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = (SELECT auth.uid())
    AND (SELECT public.can_write_someone_up())
    AND storage_path LIKE (SELECT auth.uid())::text || '/' || press_id::text || '/%'
  );

-- The writer drops a photo while the write-up has not been sent. Once it has landed the photo stays with it.
DROP POLICY IF EXISTS person_report_photos_delete ON public.person_report_photos;
CREATE POLICY person_report_photos_delete ON public.person_report_photos
  FOR DELETE TO authenticated
  USING (
    author_user_id = (SELECT auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.person_reports r WHERE r.press_id = person_report_photos.press_id)
  );

-- A new table in public starts with every right for signed-in users, by the project's default privileges. Take them
-- all away first, so a row can never be changed: there is no UPDATE right to go with the missing UPDATE policy.
REVOKE ALL ON TABLE public.person_report_photos FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.person_report_photos TO authenticated;

-- Private, 2 MB a file, images only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('person-report-photos', 'person-report-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS person_report_photos_files_insert ON storage.objects;
CREATE POLICY person_report_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'person-report-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.can_write_someone_up())
  );
DROP POLICY IF EXISTS person_report_photos_files_select ON storage.objects;
CREATE POLICY person_report_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'person-report-photos'
    AND ((SELECT public.is_dev()) OR (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  );
-- The writer removes a file of their own that no landed write-up holds.
DROP POLICY IF EXISTS person_report_photos_files_delete ON storage.objects;
CREATE POLICY person_report_photos_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'person-report-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND NOT EXISTS (
      SELECT 1 FROM public.person_reports r
       WHERE r.press_id::text = (storage.foldername(name))[2]
    )
  );

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
