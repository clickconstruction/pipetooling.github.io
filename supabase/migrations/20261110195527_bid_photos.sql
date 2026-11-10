SET lock_timeout = '3s';

-- Bid photos (punch list #306, PR 1, v2.6854). The owner's ask of 2026-11-10: a photos icon in the Bid Board's Links
-- column that is always in its place, grey until the bid has photos, with upload tools and the photos kept in Google
-- Drive and managed in the app, the way a job's are. A bid's picture reached Drive only from a text (photo-save's
-- Messages source); nothing on a bid was "just a photo". This migration is the ground alone: one table and one bucket.
-- No screen reads or writes either yet. See docs/migrations/20261110195527_bid_photos.md.
--
-- 1. The table: a job photo's shape (20261102171500_job_photo_notes.sql) keyed on the bid. The phone or the desk
--    shrinks the shot and puts it in the bid-photos bucket with a row; the press that adds the photos writes added_at;
--    the photo-save sweep (PR 2) files a row with added_at into the bid's project folder, Team only › Photos, writes
--    drive_file_id and filed_at and deletes the bucket copy. A row with no added_at is a window closed without the
--    press; the client discards it, and the sweep never files it. A picture found in that Drive folder with no row
--    (dragged in through Drive, or saved from a text) is adopted as a row by the service role, with no storage_path.
--    A photo is never deleted here once added: removing one stamps removed_at, and Drive's trash holds the file.
CREATE TABLE IF NOT EXISTS public.bid_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT ''
    CONSTRAINT bid_photos_name_length CHECK (length(name) <= 200),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT ''
    CONSTRAINT bid_photos_by_name_length CHECK (length(by_name) <= 120),
  taken_at timestamptz NOT NULL DEFAULT now(),
  added_at timestamptz,
  bytes integer NOT NULL DEFAULT 0
    CONSTRAINT bid_photos_bytes_nonneg CHECK (bytes >= 0),
  original_bytes integer NOT NULL DEFAULT 0
    CONSTRAINT bid_photos_original_bytes_nonneg CHECK (original_bytes >= 0),
  width integer NOT NULL DEFAULT 0
    CONSTRAINT bid_photos_width_nonneg CHECK (width >= 0),
  height integer NOT NULL DEFAULT 0
    CONSTRAINT bid_photos_height_nonneg CHECK (height >= 0),
  storage_path text
    CONSTRAINT bid_photos_storage_path_length CHECK (storage_path IS NULL OR length(storage_path) <= 300),
  drive_file_id text
    CONSTRAINT bid_photos_drive_file_id_length CHECK (drive_file_id IS NULL OR length(drive_file_id) <= 120),
  filed_at timestamptz,
  fail_why text
    CONSTRAINT bid_photos_fail_why_length CHECK (fail_why IS NULL OR length(fail_why) <= 300),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The board counts a bid's photos and the window lists them, newest first.
CREATE INDEX IF NOT EXISTS bid_photos_bid_idx ON public.bid_photos (bid_id, taken_at DESC);
-- The sweep's own read: added, still in the bucket, not yet in Drive.
CREATE INDEX IF NOT EXISTS bid_photos_unfiled_idx ON public.bid_photos (taken_at)
  WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL;
-- One row per Drive file, so adopting a folder's pictures twice makes nothing twice.
CREATE UNIQUE INDEX IF NOT EXISTS bid_photos_drive_file_uidx ON public.bid_photos (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

COMMENT ON TABLE public.bid_photos IS
  'Bid photos (punch list #306): one row per photo on a bid, added from the Bid Board''s photos icon. The shot is shrunk and put in the bid-photos bucket; the press that adds it writes added_at; the photo-save sweep files a row with added_at into the bid''s project folder (Team only › Photos), writes drive_file_id and filed_at and deletes the bucket copy. A picture found in that folder with no row is adopted as one by the service role. Read by whoever can read the bid; added by the same people as themselves; changed by the adder or the office; never deleted once added (removed_at).';
COMMENT ON COLUMN public.bid_photos.name IS 'The photo''s name as the window shows it, and the Drive file''s name once filed. Empty until someone names it; the sweep then names the file by day and sender.';
COMMENT ON COLUMN public.bid_photos.added_at IS 'When the person pressed the button that adds the photos; null while the pick waits on an open window. The sweep files only rows with it, and the board counts only rows with it.';
COMMENT ON COLUMN public.bid_photos.storage_path IS 'The object in the bid-photos bucket, <bid_id>/<photo_id>.jpg, until the sweep files it and deletes the copy. Null on a row adopted from Drive.';
COMMENT ON COLUMN public.bid_photos.fail_why IS 'Why the sweep could not file it yet (the bid''s folder sits where the app cannot write, Drive refused); the window reads it as not in Drive yet. The photo stays in the bucket meanwhile.';
COMMENT ON COLUMN public.bid_photos.removed_at IS 'When the photo was removed in the app; the Drive file goes to Drive''s trash. The row stays so an Undo can bring it back. Null on a photo that stands.';

-- 2. The gate is the bid's own. Each policy asks whether the caller can read the bid, with a sub-select on bids that
--    runs under bids' own policies: the six roles that read a bid, a primary only on the bids they estimate, manage or
--    made (primary_scope_bids), and nobody archived. A helper such as can_access_bid_for_pricing would let any primary
--    through, so none is used. Insert as oneself. Update (the name, the removal stamp) by the adder or the office
--    (dev, master, assistant, controller). Delete only one's own shot while the window has not added it.
ALTER TABLE public.bid_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bid_photos_select ON public.bid_photos;
CREATE POLICY bid_photos_select ON public.bid_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_photos.bid_id));

DROP POLICY IF EXISTS bid_photos_insert_own ON public.bid_photos;
CREATE POLICY bid_photos_insert_own ON public.bid_photos FOR INSERT TO authenticated
  WITH CHECK (
    by_user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_photos.bid_id)
  );

DROP POLICY IF EXISTS bid_photos_update_own_or_office ON public.bid_photos;
CREATE POLICY bid_photos_update_own_or_office ON public.bid_photos FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_photos.bid_id)
    AND (by_user_id = (SELECT auth.uid()) OR (SELECT public.is_office_staff()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_photos.bid_id)
    AND (by_user_id = (SELECT auth.uid()) OR (SELECT public.is_office_staff()))
  );

DROP POLICY IF EXISTS bid_photos_delete_unadded_own ON public.bid_photos;
CREATE POLICY bid_photos_delete_unadded_own ON public.bid_photos FOR DELETE TO authenticated
  USING (by_user_id = (SELECT auth.uid()) AND added_at IS NULL);

-- 3. The bucket: private, 2 MB a file, images only, as job-photo-notes is. Objects are named <bid_id>/<photo_id>.jpg,
--    so the same gate reads the bid from the path's first folder. A path whose first folder is not a uuid is refused
--    by the pattern before the cast is reached. The sweep deletes with the service role; the adder may delete their
--    own object.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bid-photos', 'bid-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS bid_photos_files_insert ON storage.objects;
CREATE POLICY bid_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bid-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id::text = lower((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS bid_photos_files_select ON storage.objects;
CREATE POLICY bid_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bid-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id::text = lower((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS bid_photos_files_delete_own ON storage.objects;
CREATE POLICY bid_photos_files_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bid-photos' AND owner = (SELECT auth.uid()));

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
