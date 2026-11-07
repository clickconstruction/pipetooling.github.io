SET lock_timeout = '3s';

-- Documents → Photos reads task photos (punch list #273, v2.6635). The view uploaded_photos (20261101084330, the job
-- branch 20261102171500) gains a sixth branch, 'task': a photo taken on a task card (task_photos, 20261106230000), at a
-- percent, at the finish or on a Done when… line. A card has no job, so the job columns are null and the card's own
-- words ride the shape instead: caption carries the card's title (so the server-side search finds it), stage_name the
-- shot's own caption ('75%', 'finish', the line's words) and status the shot's kind ('progress', 'finish', 'line'), the
-- way a box photo's status and a line's left_in_gmail ride the same column. The bucket copy stays after the sweep files
-- a task photo, so the thumbnail reads from task-photos whether or not Drive has it. The other five branches are as
-- 20261102171500 wrote them. A view: CREATE OR REPLACE with the same columns; no table is made, so no fence.
--
-- The gates: security_invoker, so task_photos' own policy (can_see_checklist_instance: the office, an assignee, the
-- card's writer) decides the row, and the joins on checklist_instances and checklist_items run under their own policies,
-- left joins so a row the taker may see never disappears for a title they may not.

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
  'Every photo uploaded, one list (punch list #232, v2.6264; the job branch #244, v2.6359; the task branch #273, v2.6635): report_photos (saved reports), job_box_photos, stage_checklist_answers (the sheet''s own photo, never one that names a report photo), job_photo_notes (added job photos, the description as the caption), task_photos (a task card''s photo: the card''s title as the caption, the shot''s own caption as stage_name, its kind as status, no job) and message_attachments (pictures, with their line) as one shape, with the job''s number, name and customer. security_invoker: each table''s own policy and the ledger''s scope decide what the caller sees. Documents → Photos reads it newest first.';

REVOKE ALL ON public.uploaded_photos FROM anon;
GRANT SELECT ON public.uploaded_photos TO authenticated;
