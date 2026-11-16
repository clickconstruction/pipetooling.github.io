SET lock_timeout = '3s';

-- The dev seat's staging bucket (v2.7510): where a file an agent hands the dev MCP server waits between its plan and
-- its apply. The first use is a filed lien's scanned copy (plan_lien_filing → apply_lien_filing): the plan commits to
-- the file's size and sha256 and hands back a signed upload address, the agent PUTs the file, and the apply reads the
-- staged copy back as the dev, files it in the job's Drive folder and removes it. Nothing stays here.
--
-- Private. A dev alone, and only inside the folder named for their own user id (<auth.uid()>/…), so one dev's key
-- never reads or replaces another's staged file. 10 MB a file, the job folder's own cap; a PDF or a picture.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dev-seat-staging', 'dev-seat-staging', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS dev_seat_staging_select ON storage.objects;
CREATE POLICY dev_seat_staging_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dev-seat-staging' AND public.is_dev() AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS dev_seat_staging_insert ON storage.objects;
CREATE POLICY dev_seat_staging_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dev-seat-staging' AND public.is_dev() AND (storage.foldername(name))[1] = auth.uid()::text);

-- An upload to a signed address is an upsert: a second PUT of the same file replaces the first.
DROP POLICY IF EXISTS dev_seat_staging_update ON storage.objects;
CREATE POLICY dev_seat_staging_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dev-seat-staging' AND public.is_dev() AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'dev-seat-staging' AND public.is_dev() AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS dev_seat_staging_delete ON storage.objects;
CREATE POLICY dev_seat_staging_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dev-seat-staging' AND public.is_dev() AND (storage.foldername(name))[1] = auth.uid()::text);
