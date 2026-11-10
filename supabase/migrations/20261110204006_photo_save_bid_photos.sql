SET lock_timeout = '3s';

-- Bid photos, the Drive leg (punch list #306, PR 2, v2.6856). The photo-save sweep gains a tenth source, bid_photos
-- (20261110195527): a photo added to a bid is filed into the bid's project folder, Team only › Photos. Two things the
-- sweep needs from the database. See docs/migrations/20261110204006_photo_save_bid_photos.md.
--
-- 1. tried_at: when the sweep last tried a photo and could not file it. Most hand-made bid folders sit in a personal
--    Drive the app cannot file into (card #240, call 4), so a held bid photo is the common case, not the rare one. A
--    held row of any other source is tried every five minutes for as long as it waits; a bid's is tried again an hour
--    after it failed, so a week of held photos is a few hundred calls and not thousands. bid_photos is new and empty, so
--    the ALTER takes its lock on nothing.
ALTER TABLE public.bid_photos ADD COLUMN IF NOT EXISTS tried_at timestamptz;
COMMENT ON COLUMN public.bid_photos.tried_at IS 'When the photo-save sweep last tried to file the photo and could not (fail_why says why). The sweep and its cron leave the row alone for an hour after it. Null on a photo not tried yet; cleared when it files.';

-- The sweep's read follows the rule: added, still in the bucket, not removed, not filed.
DROP INDEX IF EXISTS public.bid_photos_unfiled_idx;
CREATE INDEX IF NOT EXISTS bid_photos_unfiled_idx ON public.bid_photos (taken_at)
  WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL AND removed_at IS NULL;

-- 2. The cron: photo-save calls while any source waits; a tenth clause for an added bid photo that is due a try. Every
--    earlier clause is written again (20261109190000_counter_tickets.sql held nine). Unscheduled first, so a second
--    run leaves one row.
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
     );
  $$
);
