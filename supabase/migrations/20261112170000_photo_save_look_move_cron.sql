SET lock_timeout = '3s';

-- The photo sweep is called for a look whose Drive folder is due a move (punch list #319 PR 6, v2.7005). When a job is
-- made from a look whose files are already in Drive, the sweep moves the look's folder under the job's own Customer
-- supplied photos (20261112130000_first_look_job.sql). The cron only calls the function while one of its sources has
-- something waiting, which v2.7025 taught, so the move gets its own clause here: a look with a job and a Drive folder
-- and no move stamped, under 90 days old.
--
-- A file of its own, stamped after 20261112160000_photo_save_looks_cron.sql, because both schedule the same cron: a
-- database built from the files in order must end on the fullest list. Every earlier clause is written again
-- unchanged. Unscheduled first, so a second run leaves one row. No table, so no fence call.

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
     )
     OR EXISTS (
       SELECT 1 FROM public.first_looks l
       WHERE l.job_id IS NOT NULL AND l.drive_folder_id IS NOT NULL AND l.drive_job_folder_at IS NULL
         AND l.made_at > now() - interval '90 days'
     );
  $$
);
