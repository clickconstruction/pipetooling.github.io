SET lock_timeout = '3s';

-- Documents → Photos reads again on All and on Texts & email (v2.8301). The list answered "canceling statement due to
-- statement timeout": the view's message branch found a picture's job with
--   LEFT JOIN jobs_ledger j ON j.id = COALESCE(m.jobs_ledger_id, gp.billing_job_id)
-- and Postgres will not use a COALESCE as an index condition on a table with row policies. It cannot prove the
-- expression leaks nothing, so it must run the table's policies first. The join became a walk of every job under its
-- policies, once per picture: 111 pictures at about 170 ms a walk. Read on prod on 2026-11-22: 14 seconds for the
-- branch alone as a dev and 29 seconds for the whole list as an assistant, against the 8 second limit. The gateway's
-- log shows the same read failing on 2026-11-17.
--
-- The join says the same thing as a CASE, which Postgres does trust: the line's own job when it names one, the
-- project's billing job when it does not. The job is then found by its key. Read on prod the same day, in a read-only
-- transaction, with this file's SELECT in place of the view: the branch in 31 ms and the whole list in under half a
-- second as each of nine roles. The old and the new join hand back the same 111 rows.
--
-- Nothing else changes. The other six branches, the thirty columns and their order, the comment's facts, the grants
-- and security_invoker are as 20261121222237 wrote them, word for word. A view: CREATE OR REPLACE with the same
-- columns; no table is made, so no fence. See docs/migrations/20261122063000_uploaded_photos_message_job_join.md.

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
  'job'::text,
  n.id,
  n.job_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  CASE WHEN length(n.description) > 0 THEN n.description ELSE n.caption END,
  n.stage_name,
  n.by_user_id,
  n.by_name,
  NULL::text,
  NULL::text,
  n.taken_at,
  n.bytes::bigint,
  n.original_bytes::bigint,
  'job-photo-notes'::text,
  n.storage_path,
  n.drive_file_id,
  n.filed_at,
  n.fail_why,
  NULL::text,
  j.hcp_number,
  j.click_number,
  j.job_name,
  c.name,
  NULL::text
FROM public.job_photo_notes n
JOIN public.jobs_ledger j ON j.id = n.job_id
LEFT JOIN public.customers c ON c.id = j.customer_id
WHERE n.added_at IS NOT NULL

UNION ALL

SELECT
  'task'::text,
  tp.id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  COALESCE(ci.title, ''),
  tp.caption,
  tp.by_user_id,
  tp.by_name,
  NULL::text,
  NULL::text,
  tp.taken_at,
  tp.bytes::bigint,
  tp.original_bytes::bigint,
  'task-photos'::text,
  tp.storage_path,
  tp.drive_file_id,
  tp.filed_at,
  tp.fail_why,
  tp.kind,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text
FROM public.task_photos tp
LEFT JOIN public.checklist_instances i ON i.id = tp.instance_id
LEFT JOIN public.checklist_items ci ON ci.id = i.checklist_item_id
WHERE tp.storage_path IS NOT NULL OR tp.drive_file_id IS NOT NULL

UNION ALL

SELECT
  'bid'::text,
  bp.id,
  NULL::uuid,
  bp.bid_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  bp.name,
  ''::text,
  bp.by_user_id,
  bp.by_name,
  NULL::text,
  NULL::text,
  bp.taken_at,
  bp.bytes::bigint,
  bp.original_bytes::bigint,
  'bid-photos'::text,
  bp.storage_path,
  bp.drive_file_id,
  bp.filed_at,
  bp.fail_why,
  NULL::text,
  NULL::text,
  NULL::text,
  bd.project_name,
  cb.name,
  bd.bid_number::text
FROM public.bid_photos bp
LEFT JOIN public.bids bd ON bd.id = bp.bid_id
LEFT JOIN public.customers cb ON cb.id = bd.customer_id
WHERE bp.added_at IS NOT NULL
  AND bp.removed_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.message_attachments att
    JOIN public.messages m ON m.id = att.message_id
    WHERE att.drive_file_id = bp.drive_file_id
      AND att.kind = 'file'
      AND att.mime ILIKE 'image/%'
  )

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
-- A CASE, never a COALESCE: under jobs_ledger's row policies a COALESCE here cannot be an index condition (v2.8301).
LEFT JOIN public.jobs_ledger j
  ON j.id = CASE WHEN m.jobs_ledger_id IS NOT NULL THEN m.jobs_ledger_id ELSE gp.billing_job_id END
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.bids bd ON bd.id = m.bid_id
LEFT JOIN public.customers cb ON cb.id = bd.customer_id
WHERE att.kind = 'file'
  AND att.mime ILIKE 'image/%';

COMMENT ON VIEW public.uploaded_photos IS
  'Every photo uploaded, one list (punch list #232, v2.6264; the job branch #244, v2.6359; the task branch #273, v2.6635; the bid branch #306, v2.8215): report_photos (saved reports), job_box_photos, stage_checklist_answers (the sheet''s own photo, never one that names a report photo), job_photo_notes (added job photos, the description as the caption), task_photos (a task card''s photo: the card''s title as the caption, the shot''s own caption as stage_name, its kind as status, no job), bid_photos (a bid''s photo that stands: added and not removed, its name as the caption, the bid in bid_id and no job, never one whose Drive file a text''s picture already carries) and message_attachments (pictures, with their line) as one shape, with the job''s or the bid''s number, name and customer. security_invoker: each table''s own policy and the ledger''s scope decide what the caller sees. Documents → Photos reads it newest first.';

REVOKE ALL ON public.uploaded_photos FROM anon;
GRANT SELECT ON public.uploaded_photos TO authenticated;
