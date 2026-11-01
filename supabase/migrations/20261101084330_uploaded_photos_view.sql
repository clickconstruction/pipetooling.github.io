SET lock_timeout = '3s';

-- Every photo uploaded, one list (punch list #232, PR 1, v2.6264). The owner's ask of 2026-11-01: one view of every photo
-- uploaded to the app, newest first, with where each is saved and who uploaded it. A photo reaches the app through four
-- doors, each with its own table and bucket, and the photo-save sweep files each into the job's Drive folder:
--
--   report     report_photos            a shot on a field report (#189), saved reports only
--   box        job_box_photos           a shot of a box on the Tally's On site tab (#209)
--   checklist  stage_checklist_answers  the sheet's own photo on a stage checklist question (#164); an answer that names a
--                                       report photo (report_photo_id, v2.6219) is that same shot and is left to the report
--   message    message_attachments      a picture on a text or an email (Messages cut 6), with the line it came on
--
-- One view reads the four as one shape. It runs as the caller (security_invoker), so each table's own policy decides what
-- a person sees and no new gate is written; the join on jobs_ledger runs under the ledger's own RLS too, so a primary's
-- or a superintendent's list follows their jobs scope (the report photos' gate alone names them on every job). The job's
-- number, name and customer ride on the row so the tab can search them on the server and draw the row from one read.
-- A view, so no table is made and the three fence calls are not needed.

CREATE OR REPLACE VIEW public.uploaded_photos
WITH (security_invoker = true)
AS
SELECT
  'report'::text AS source,
  p.id,
  p.job_id,
  NULL::uuid AS bid_id,
  NULL::uuid AS project_id,
  p.report_id,
  NULL::uuid AS container_id,
  NULL::uuid AS question_id,
  NULL::uuid AS message_id,
  NULL::uuid AS contact_id,
  p.caption,
  p.stage_name,
  p.by_user_id,
  p.by_name,
  NULL::text AS direction,
  NULL::text AS channel,
  p.taken_at,
  p.bytes::bigint AS bytes,
  p.original_bytes::bigint AS original_bytes,
  'report-photos'::text AS bucket,
  p.storage_path,
  p.drive_file_id,
  p.filed_at,
  p.fail_why,
  NULL::text AS status,
  j.hcp_number AS job_hcp_number,
  j.click_number AS job_click_number,
  j.job_name,
  c.name AS customer_name,
  NULL::text AS bid_number
FROM public.report_photos p
JOIN public.jobs_ledger j ON j.id = p.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
WHERE p.report_id IS NOT NULL

UNION ALL

SELECT
  'box'::text,
  b.id,
  b.job_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  b.container_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  b.words,
  COALESCE(k.label, ''),
  b.by_user_id,
  b.by_name,
  NULL::text,
  NULL::text,
  b.taken_at,
  b.bytes::bigint,
  0::bigint,
  'box-photos'::text,
  b.storage_path,
  b.drive_file_id,
  b.filed_at,
  b.fail_why,
  b.status,
  j.hcp_number,
  j.click_number,
  j.job_name,
  c.name,
  NULL::text
FROM public.job_box_photos b
JOIN public.jobs_ledger j ON j.id = b.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.job_containers k ON k.id = b.container_id

UNION ALL

SELECT
  'checklist'::text,
  a.id,
  a.job_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  a.question_id,
  NULL::uuid,
  NULL::uuid,
  COALESCE(t.words, ''),
  COALESCE(f.name, ''),
  a.answered_by,
  a.answered_by_name,
  NULL::text,
  NULL::text,
  COALESCE(a.photo_taken_at, a.answered_at, a.created_at),
  a.photo_bytes::bigint,
  0::bigint,
  'stage-checklist-photos'::text,
  a.photo_storage_path,
  a.photo_drive_file_id,
  a.photo_filed_at,
  a.photo_fail_why,
  NULL::text,
  j.hcp_number,
  j.click_number,
  j.job_name,
  c.name,
  NULL::text
FROM public.stage_checklist_answers a
JOIN public.jobs_ledger j ON j.id = a.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.stage_checklist_templates t ON t.id = a.question_id
LEFT JOIN public.jobs_ledger_fixtures f ON f.id = a.fixture_id
WHERE a.report_photo_id IS NULL
  AND (a.photo_storage_path IS NOT NULL OR a.photo_drive_file_id IS NOT NULL)

UNION ALL

SELECT
  'message'::text,
  att.id,
  COALESCE(m.jobs_ledger_id, gp.billing_job_id),
  m.bid_id,
  m.project_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  m.id,
  m.contact_id,
  att.name,
  ''::text,
  m.who_user_id,
  m.who_text,
  m.direction,
  m.channel,
  COALESCE(m.at, m.created_at),
  COALESCE(att.size_bytes, 0)::bigint,
  0::bigint,
  'message-attachments'::text,
  att.bucket_path,
  att.drive_file_id,
  NULL::timestamptz,
  NULL::text,
  att.left_in_gmail,
  j.hcp_number,
  j.click_number,
  COALESCE(j.job_name, bd.project_name),
  COALESCE(c.name, cb.name),
  bd.bid_number::text
FROM public.message_attachments att
JOIN public.messages m ON m.id = att.message_id
LEFT JOIN public.gc_projects gp ON gp.project_id = m.project_id
LEFT JOIN public.jobs_ledger j ON j.id = COALESCE(m.jobs_ledger_id, gp.billing_job_id)
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.bids bd ON bd.id = m.bid_id
LEFT JOIN public.customers cb ON cb.id = bd.customer_id
WHERE att.kind = 'file'
  AND att.mime ILIKE 'image/%';

COMMENT ON VIEW public.uploaded_photos IS
  'Every photo uploaded, one list (punch list #232, v2.6264): report_photos (saved reports), job_box_photos, stage_checklist_answers (the sheet''s own photo, never one that names a report photo) and message_attachments (pictures, with their line) as one shape, with the job''s number, name and customer. security_invoker: each table''s own policy and the ledger''s scope decide what the caller sees. Documents → Photos reads it newest first.';

REVOKE ALL ON public.uploaded_photos FROM anon;
GRANT SELECT ON public.uploaded_photos TO authenticated;
