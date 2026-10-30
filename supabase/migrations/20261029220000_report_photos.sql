SET lock_timeout = '3s';

-- Phone first, the camera-first report (punch list #189, PR 5b; the owner's words of 2026-10-26: a field report that
-- starts from the camera, the photos converted from full size to a compact format). A tech's Leave report opens the
-- phone's camera; the phone shrinks the shot to the office's long edge and sends it here, to the report-photos bucket,
-- with a row in report_photos naming the job, the stage it shows and who took it. Save writes the report's id on the
-- rows; the photo-save sweep then copies each into the job's Photos folder under the customer's Drive folder, named by
-- day, sender and caption, keeps drive_file_id and deletes the bucket copy (the v2.2300 pattern: Drive is the home and
-- the bucket a waiting room). A photo on a job with no Drive folder stays in the bucket with the reason on its row,
-- and the report card shows it marked not in Drive yet.
--
--   1. report_photos                 — one row per shot: the job, the report once saved, the stage, the sizes, where it is.
--   2. The gate: the same door as the stage rows (can_report_stage_progress: office roles, or a field user the job is
--      visible to), and a row is written, changed or discarded only by the one who took it.
--   3. The bucket report-photos: private, 2 MB a file so nothing full size slips through, images only, objects named
--      <job_id>/<photo_id>.jpg so the gate reads the job from the path.
--   4. The office's size, app_settings.report_photo_size: small (1200 px), medium (1600, the default) or large (2400).
--   5. The photo-save cron calls while a saved report's photo waits, as it does for a box photo.

-- 1. The photos.
CREATE TABLE IF NOT EXISTS public.report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  fixture_id uuid REFERENCES public.jobs_ledger_fixtures(id) ON DELETE SET NULL,
  stage_name text NOT NULL DEFAULT '' CHECK (length(stage_name) <= 160),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 200),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  taken_at timestamptz NOT NULL DEFAULT now(),
  bytes integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  original_bytes integer NOT NULL DEFAULT 0 CHECK (original_bytes >= 0),
  width integer NOT NULL DEFAULT 0 CHECK (width >= 0),
  height integer NOT NULL DEFAULT 0 CHECK (height >= 0),
  storage_path text CHECK (length(storage_path) <= 300),
  drive_file_id text CHECK (length(drive_file_id) <= 120),
  filed_at timestamptz,
  fail_why text CHECK (length(fail_why) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_photos_report_idx ON public.report_photos (report_id) WHERE report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS report_photos_job_idx ON public.report_photos (job_id, taken_at);
CREATE INDEX IF NOT EXISTS report_photos_unfiled_idx ON public.report_photos (taken_at) WHERE filed_at IS NULL AND storage_path IS NOT NULL AND report_id IS NOT NULL;
COMMENT ON TABLE public.report_photos IS 'Phone first (#189): a photo taken for a field report. The phone shrinks the shot and puts it in the report-photos bucket; Save writes report_id; the photo-save sweep files it in the job''s Drive photo folder named by day, sender and caption, writes drive_file_id and filed_at, and deletes the bucket copy. A row with no report_id is a form that was not saved; the client discards it.';
COMMENT ON COLUMN public.report_photos.fixture_id IS 'The stage the photo shows (jobs_ledger_fixtures), null on a one-stage job or when the tech picked none.';
COMMENT ON COLUMN public.report_photos.caption IS 'What the file is named by: the stage, else the report''s What got done line''s first words, else Report photo.';
COMMENT ON COLUMN public.report_photos.original_bytes IS 'The shot as the camera handed it over, before the phone shrank it; the tile shows both.';
COMMENT ON COLUMN public.report_photos.fail_why IS 'Why the sweep could not file it yet (the job has no Drive folder, Drive refused); the report card reads it as not in Drive yet.';

-- 2. The gate.
ALTER TABLE public.report_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_photos_select ON public.report_photos;
CREATE POLICY report_photos_select ON public.report_photos FOR SELECT TO authenticated USING (public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS report_photos_insert_own ON public.report_photos;
CREATE POLICY report_photos_insert_own ON public.report_photos FOR INSERT TO authenticated
  WITH CHECK (public.can_report_stage_progress(job_id) AND by_user_id = auth.uid());
DROP POLICY IF EXISTS report_photos_update_own ON public.report_photos;
CREATE POLICY report_photos_update_own ON public.report_photos FOR UPDATE TO authenticated
  USING (by_user_id = auth.uid())
  WITH CHECK (by_user_id = auth.uid());
-- A shot the form never saved may be discarded by its taker; a saved report's photo stays.
DROP POLICY IF EXISTS report_photos_delete_unsaved_own ON public.report_photos;
CREATE POLICY report_photos_delete_unsaved_own ON public.report_photos FOR DELETE TO authenticated
  USING (by_user_id = auth.uid() AND report_id IS NULL);

-- 3. The bucket: private, 2 MB a file, images only. Objects are named <job_id>/<photo_id>.jpg, so the same gate reads
--    the job from the path. The sweep deletes with the service role; the taker may delete their own unsaved shot.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-photos', 'report-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS report_photos_files_insert ON storage.objects;
CREATE POLICY report_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-photos' AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS report_photos_files_select ON storage.objects;
CREATE POLICY report_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-photos' AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS report_photos_files_delete_own ON storage.objects;
CREATE POLICY report_photos_files_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-photos' AND owner = auth.uid());

-- 4. The office's size: the long edge the phone shrinks a report photo to. Medium on day one. Master and dev set it on
--    Settings → Jobs & billing → Photos (the gc_card_bill_on_v1 pattern); everyone signed in reads app_settings.
INSERT INTO public.app_settings (key, value_text)
VALUES ('report_photo_size', 'medium')
ON CONFLICT (key) DO NOTHING;
DROP POLICY IF EXISTS "master_or_dev_update_report_photo_size" ON public.app_settings;
CREATE POLICY "master_or_dev_update_report_photo_size"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'report_photo_size' AND public.is_master_or_dev())
  WITH CHECK (key = 'report_photo_size' AND public.is_master_or_dev());

-- 5. The cron: photo-save calls while any job's tick is on, a box photo waits, or a saved report's photo waits.
--    Unscheduled first, so a second run leaves one row (20261029160000's shape).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'photo-save';

SELECT cron.schedule(
  'photo-save',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/photo-save',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.photo_saves WHERE on_since IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.report_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL AND report_id IS NOT NULL);
  $$
);

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
