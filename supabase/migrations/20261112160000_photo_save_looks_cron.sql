SET lock_timeout = '3s';

-- The photo sweep is called for a First look's files (punch list #319, v2.7025). PR 2 (v2.7001) gave photo-save a
-- twelfth source, the files a customer sends through a look's link. The cron only calls the function while one of its
-- sources has something waiting, and the new source was not on that list, so a look's files sat until some other
-- source happened to wake the sweep. The live walk of 2026-11-12 found it: a photo and two videos sent at 18:50 UTC
-- were not in Drive at 18:57.
--
-- Two clauses join the eleven, every earlier one written again as 20261111024500_box_photo_refile_due.sql held it.
-- Unscheduled first, so a second run leaves one row. No table, so no fence call.
--
--   12. A look's file that is finished, not removed and not in Drive, under 30 days old, and either never tried or
--       last tried over 15 minutes ago. A file that cannot file yet (a caller who is not a customer) is tried every
--       quarter hour and not every five minutes, and stops waking the sweep after a month. A video part way through
--       its copy is not stamped as tried (photo-save, the same PR), so the next run five minutes on picks it up.
--   13. A picture or a video texted in since the ask, by a customer an open look was asked of: kept by us, in Drive
--       nowhere yet. Looks under 14 days old. A caller who is not a customer yet has no folder, so does not wake it.

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
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE refile_due_at IS NOT NULL AND refile_due_at <= now())
     OR EXISTS (
       SELECT 1 FROM public.first_look_files f
       WHERE f.drive_file_id IS NULL AND f.finished_at IS NOT NULL AND f.removed_at IS NULL
         AND f.finished_at > now() - interval '30 days'
         AND (f.drive_tried_at IS NULL OR f.drive_tried_at < now() - interval '15 minutes')
     )
     OR EXISTS (
       SELECT 1 FROM public.first_looks l
       JOIN public.contacts c ON c.id = l.contact_id AND c.customer_id IS NOT NULL
       JOIN public.messages m ON m.contact_id = l.contact_id AND m.direction = 'in' AND m.at >= l.made_at
       JOIN public.message_attachments a ON a.message_id = m.id
       WHERE l.closed_at IS NULL AND l.made_at > now() - interval '14 days'
         AND a.kind = 'file' AND a.drive_file_id IS NULL AND a.sent_as IS NULL AND a.bucket_path IS NOT NULL
         AND (a.mime LIKE 'image/%' OR a.mime LIKE 'video/%')
     );
  $$
);
