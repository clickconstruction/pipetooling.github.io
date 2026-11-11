SET lock_timeout = '3s';

-- Box photos: the Drive files follow a job that moved (punch list #297, the engine, v2.6915).
--
-- v2.6885 gave photo-save an ask ({ refile_box_photos: <job_id> }) that moves a job's filed box photos into the
-- folder the job's photos land in, and the dev seat makes it after apply_materials_move. A whole-job combine carries
-- the rows the same way (on_site_carry_job) and nothing asked for it, and an ask that failed or was cut short was
-- never finished. This is the counter tickets' pattern (20261109190000): the database marks the row when its job
-- changes, and the sweep that already runs every five minutes moves what is marked. No caller has to remember it.
--
-- 1. The mark. refile_due_at is when the photo's file is next due a move into its job's photo folder: null when it is
--    where it belongs (or was never filed), the time the job changed when it has to follow, and a day later after a
--    try that was held (a file in Drive's trash, a Drive refusal), whose reason sits in fail_why.
ALTER TABLE public.job_box_photos ADD COLUMN IF NOT EXISTS refile_due_at timestamptz;

COMMENT ON COLUMN public.job_box_photos.refile_due_at IS
  'Materials on site (#297, v2.6915): when this photo''s Drive file is next due a move into its job''s photo folder. Null when it is where it belongs. Set by job_box_photo_job_changed when a filed photo''s job changes; photo-save clears it once the file is in the folder, or sets it a day on with the reason in fail_why when the file was held.';

CREATE INDEX IF NOT EXISTS job_box_photos_refile_due_idx ON public.job_box_photos (refile_due_at) WHERE refile_due_at IS NOT NULL;

-- 2. The trigger: a filed photo whose job changes is due at once, and an older hold's reason is cleared so the new
--    job's try starts clean. A photo still waiting in the bucket needs nothing: the sweep files it for the row's job.
--    SECURITY INVOKER, and it writes only the row being updated, so it gives no caller anything they did not have.
CREATE OR REPLACE FUNCTION public.job_box_photo_job_changed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.job_id IS DISTINCT FROM OLD.job_id AND NEW.drive_file_id IS NOT NULL THEN
    NEW.refile_due_at := now();
    NEW.fail_why := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.job_box_photo_job_changed() IS
  'Materials on site (#297, v2.6915): a filed box photo whose job changes (a whole-job combine, the dev seat''s move, any later door) is marked due a move of its Drive file into the new job''s photo folder. photo-save moves what is due.';

REVOKE ALL ON FUNCTION public.job_box_photo_job_changed() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER job_box_photos_job_changed BEFORE UPDATE OF job_id ON public.job_box_photos
  FOR EACH ROW EXECUTE FUNCTION public.job_box_photo_job_changed();

-- 3. The cron: photo-save calls while any source waits; an eleventh clause for a box photo due a move. Every earlier
--    clause is written again (20261110204006_photo_save_bid_photos.sql held ten). Unscheduled first, so a second run
--    leaves one row.
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
     OR EXISTS (SELECT 1 FROM public.report_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL AND report_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_answers WHERE photo_filed_at IS NULL AND photo_storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_photo_notes WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.machine_check_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_records WHERE pdf_filed_at IS NULL AND pdf_tries < 5)
     OR EXISTS (SELECT 1 FROM public.task_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (
       SELECT 1 FROM public.counter_ticket_pages p
       JOIN public.counter_tickets t ON t.id = p.ticket_id
       WHERE p.filed_at IS NULL AND p.storage_path IS NOT NULL
         AND t.job_id IS NOT NULL AND t.added_at IS NOT NULL AND t.removed_at IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM public.bid_photos
       WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL AND removed_at IS NULL
         AND (tried_at IS NULL OR tried_at < now() - interval '1 hour')
     )
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE refile_due_at IS NOT NULL AND refile_due_at <= now());
  $$
);
