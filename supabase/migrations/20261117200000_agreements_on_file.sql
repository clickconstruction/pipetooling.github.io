SET lock_timeout = '3s';

-- Documents → Agreements reads every agreement as one list (punch list #376). The app keeps agreements in three tables,
-- each with its own window and its own words: a job's contract, the warranty sent in place of one, a GC's own paper and
-- a signed paper the office filed (job_contracts); a person's agreement, staff, sub or partner
-- (person_contract_documents); and a sub work order (step_commitments). The Documents page listed none of them as
-- agreements. This view answers one shape over the three, so the page can sort, filter, search and page on the server:
--
--   id, kind, source_id      'job_contract:<uuid>'; kind is job_contract · job_warranty · their_paper ·
--                            person_agreement · partner_agreement · work_order
--   state                    waiting (out to be signed) · signed · ended (voided, declined, cancelled, expired, replaced)
--   paper_name, with_name    the paper's own name, and who it is with
--   job_id, job_*            the job it is on; more_jobs counts the other jobs one filed paper covers
--   person_id, person_kind   a person's agreement: people.kind, so the page can say Staff or Sub
--   at, at_day               the moment the list sorts on, and its day in the company's calendar: the signed day, the
--                            sent day, or the day it ended
--   facts                    the few columns of the kind's own table that its words are made from. No money column.
--   find_text                lower-case words for the find box: the paper, who, the job's number, name and address
--
-- Drafts are not here: a draft is not an agreement yet and stays in the window that made it. A trade company's paper
-- (company_id) and GC mode's own papers join in a later migration.
--
-- The gates: security_invoker, so each table's own policy decides its branch for the caller, and the joins on
-- jobs_ledger, customers and people run under their own. Nothing here widens who reads what: today job_contracts and
-- person_contract_documents open to the office, and step_commitments also to the estimator, a superintendent on their own
-- jobs and the sub named on the row. Left joins, so a row the caller may read never disappears for a job or a person
-- they may not. A view makes no table, so there is no fence to call. CREATE OR REPLACE: a second run changes nothing.

CREATE OR REPLACE VIEW public.agreements_on_file
WITH (security_invoker = true)
AS
WITH contracts AS (
  SELECT
    c.*,
    CASE
      WHEN c.voided_at IS NOT NULL OR c.status = 'voided' THEN 'ended'
      WHEN c.status = 'signed' THEN 'signed'
      ELSE 'waiting'
    END AS state,
    j.hcp_number,
    j.click_number,
    j.job_name,
    j.job_address,
    cu.name AS customer_name,
    gcu.name AS gc_name
  FROM public.job_contracts c
  LEFT JOIN public.jobs_ledger j ON j.id = c.job_id
  LEFT JOIN public.customers cu ON cu.id = j.customer_id
  LEFT JOIN public.customers gcu ON gcu.id = j.gc_customer_id
  WHERE c.status <> 'draft'
),
-- One signed paper filed over several jobs is one row per job with a shared covers_group_id: one line here, the first
-- job named, the rest counted, and every covered job's words kept for the find box. Live and ended rows of one group
-- stay apart, so taking a paper off one job does not hide it on the others.
contract_lines AS (
  SELECT
    c.*,
    row_number() OVER (PARTITION BY COALESCE(c.covers_group_id, c.id), c.state ORDER BY c.created_at, c.id) AS line_no,
    count(*) OVER w AS line_jobs,
    string_agg(
      concat_ws(' ', 'J' || NULLIF(btrim(c.hcp_number), ''), 'J' || NULLIF(btrim(c.click_number), ''), c.job_name, c.job_address),
      ' '
    ) OVER w AS all_jobs
  FROM contracts c
  WINDOW w AS (PARTITION BY COALESCE(c.covers_group_id, c.id), c.state)
),
contract_rows AS (
  SELECT
    c.*,
    CASE c.state
      WHEN 'signed' THEN COALESCE(c.signed_at, c.co_signed_at, (c.our_signed_on::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago', c.created_at)
      WHEN 'waiting' THEN COALESCE(c.sent_at, c.last_sent_at, c.created_at)
      ELSE COALESCE(c.voided_at, c.updated_at, c.created_at)
    END AS happened
  FROM contract_lines c
  WHERE c.line_no = 1
),
person_docs AS (
  SELECT
    d.*,
    p.name AS roster_name,
    p.kind AS roster_kind,
    EXISTS (
      SELECT 1 FROM public.person_contract_documents newer WHERE newer.supersedes_person_contract_document_id = d.id
    ) AS replaced
  FROM public.person_contract_documents d
  LEFT JOIN public.people p ON p.id = d.person_id
  WHERE d.doc_type = 'agreement'
    AND d.status IN ('sent', 'signed')
    AND d.company_id IS NULL
),
person_rows AS (
  SELECT
    d.*,
    CASE WHEN d.replaced THEN 'ended' WHEN d.status = 'signed' THEN 'signed' ELSE 'waiting' END AS state,
    CASE
      WHEN d.status = 'signed' AND d.signed_at IS NOT NULL THEN (d.signed_at::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago'
      ELSE COALESCE(d.sent_at, d.created_at, now())
    END AS happened
  FROM person_docs d
),
order_rows AS (
  SELECT
    sc.*,
    j.hcp_number,
    j.click_number,
    j.job_name,
    j.job_address,
    CASE
      WHEN sc.status IN ('accepted', 'approved', 'settled') THEN 'signed'
      WHEN sc.status = 'offered' AND (sc.offer_expires_at IS NULL OR sc.offer_expires_at >= (now() AT TIME ZONE 'America/Chicago')::date) THEN 'waiting'
      ELSE 'ended'
    END AS state,
    CASE
      WHEN sc.status IN ('accepted', 'approved', 'settled') THEN COALESCE(sc.signed_at, sc.accepted_at, sc.approved_at, sc.updated_at)
      WHEN sc.status = 'declined' THEN COALESCE(sc.declined_at, sc.updated_at)
      WHEN sc.status = 'offered' AND sc.offer_expires_at < (now() AT TIME ZONE 'America/Chicago')::date
        THEN (sc.offer_expires_at::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago'
      WHEN sc.status = 'offered' THEN COALESCE(sc.offered_at, sc.created_at)
      ELSE sc.updated_at
    END AS happened
  FROM public.step_commitments sc
  LEFT JOIN public.jobs_ledger j ON j.id = sc.job_id
  WHERE sc.status <> 'draft'
)

SELECT
  (CASE c.kind WHEN 'warranty' THEN 'job_warranty' WHEN 'their_paper' THEN 'their_paper' ELSE 'job_contract' END || ':' || c.id::text)::text AS id,
  (CASE c.kind WHEN 'warranty' THEN 'job_warranty' WHEN 'their_paper' THEN 'their_paper' ELSE 'job_contract' END)::text AS kind,
  c.id AS source_id,
  c.state::text AS state,
  COALESCE(NULLIF(btrim(c.paper_title), ''), NULLIF(btrim(c.template_name), ''), '')::text AS paper_name,
  (CASE
    WHEN c.kind = 'their_paper' THEN COALESCE(NULLIF(btrim(c.gc_name), ''), NULLIF(btrim(c.customer_name), ''), NULLIF(btrim(c.recipient_name), ''), '')
    ELSE COALESCE(NULLIF(btrim(c.customer_name), ''), NULLIF(btrim(c.recipient_name), ''), NULLIF(btrim(c.signer_printed_name), ''), '')
  END)::text AS with_name,
  c.job_id,
  c.hcp_number::text AS job_hcp_number,
  c.click_number::text AS job_click_number,
  c.job_name::text AS job_name,
  c.job_address::text AS job_address,
  (c.line_jobs - 1)::integer AS more_jobs,
  NULL::uuid AS person_id,
  NULL::text AS person_kind,
  c.happened AS at,
  (c.happened AT TIME ZONE 'America/Chicago')::date AS at_day,
  jsonb_strip_nulls(
    jsonb_build_object(
      'status', c.status,
      'voided_at', c.voided_at,
      'signer_mode', c.signer_mode,
      'co_signer_mode', c.co_signer_mode,
      'send_count', c.send_count,
      'view_count', c.view_count,
      'sent_channel', c.sent_channel,
      'signed_at', c.signed_at,
      'recipient_name', c.recipient_name,
      'signer_printed_name', c.signer_printed_name,
      'signer_consented_at', c.signer_consented_at,
      'co_signer_name', c.co_signer_name,
      'co_signer_email', c.co_signer_email,
      'co_signed_at', c.co_signed_at,
      'co_signer_printed_name', c.co_signer_printed_name,
      'co_signer_consented_at', c.co_signer_consented_at,
      'signed_document_url', c.signed_document_url,
      'has_upload', CASE WHEN c.paper_upload_path IS NOT NULL THEN true END,
      'paper_title', c.paper_title,
      'our_signer_name', c.our_signer_name,
      'our_signed_on', c.our_signed_on,
      'our_signed_how', c.our_signed_how,
      'their_signed_on', c.their_signed_on,
      'relied_on_on', c.relied_on_on,
      'relied_on_what', c.relied_on_what
    )
  ) AS facts,
  lower(
    concat_ws(
      ' ',
      c.paper_title,
      c.template_name,
      CASE c.kind WHEN 'warranty' THEN 'warranty' WHEN 'their_paper' THEN 'their paper' ELSE 'contract' END,
      c.customer_name,
      c.gc_name,
      c.recipient_name,
      c.signer_printed_name,
      c.all_jobs
    )
  )::text AS find_text
FROM contract_rows c

UNION ALL

SELECT
  (CASE WHEN d.partnership_id IS NOT NULL THEN 'partner_agreement' ELSE 'person_agreement' END || ':' || d.id::text)::text AS id,
  (CASE WHEN d.partnership_id IS NOT NULL THEN 'partner_agreement' ELSE 'person_agreement' END)::text AS kind,
  d.id AS source_id,
  d.state::text AS state,
  COALESCE(btrim(d.document_name), '')::text AS paper_name,
  COALESCE(NULLIF(btrim(d.roster_name), ''), btrim(d.person_name), '')::text AS with_name,
  NULL::uuid AS job_id,
  NULL::text AS job_hcp_number,
  NULL::text AS job_click_number,
  NULL::text AS job_name,
  NULL::text AS job_address,
  0::integer AS more_jobs,
  d.person_id,
  d.roster_kind::text AS person_kind,
  d.happened AS at,
  (d.happened AT TIME ZONE 'America/Chicago')::date AS at_day,
  jsonb_strip_nulls(
    jsonb_build_object(
      'status', d.status,
      'sent_at', d.sent_at,
      'signer_last_viewed_at', d.signer_last_viewed_at,
      'signed_at', d.signed_at,
      'replaced', CASE WHEN d.replaced THEN true END
    )
  ) AS facts,
  lower(
    concat_ws(
      ' ',
      d.document_name,
      d.roster_name,
      d.person_name,
      CASE WHEN d.partnership_id IS NOT NULL THEN 'partner' WHEN d.roster_kind = 'sub' THEN 'sub' ELSE 'staff' END
    )
  )::text AS find_text
FROM person_rows d

UNION ALL

SELECT
  ('work_order:' || o.id::text)::text AS id,
  'work_order'::text AS kind,
  o.id AS source_id,
  o.state::text AS state,
  COALESCE(btrim(o.record_id), '')::text AS paper_name,
  COALESCE(btrim(o.display_name), '')::text AS with_name,
  o.job_id,
  o.hcp_number::text AS job_hcp_number,
  o.click_number::text AS job_click_number,
  o.job_name::text AS job_name,
  o.job_address::text AS job_address,
  0::integer AS more_jobs,
  o.person_id,
  NULL::text AS person_kind,
  o.happened AS at,
  (o.happened AT TIME ZONE 'America/Chicago')::date AS at_day,
  jsonb_strip_nulls(
    jsonb_build_object(
      'status', o.status,
      'offered_at', o.offered_at,
      'offer_expires_at', o.offer_expires_at,
      'signed_at', o.signed_at,
      'accepted_at', o.accepted_at,
      'declined_at', o.declined_at
    )
  ) AS facts,
  lower(
    concat_ws(
      ' ',
      o.record_id,
      'work order',
      o.display_name,
      'J' || NULLIF(btrim(o.hcp_number), ''),
      'J' || NULLIF(btrim(o.click_number), ''),
      o.job_name,
      o.job_address
    )
  )::text AS find_text
FROM order_rows o;

COMMENT ON VIEW public.agreements_on_file IS
  'Every agreement on file, one list (punch list #376): job_contracts (a contract, a warranty, a GC''s own paper, a signed paper the office filed; one row for a paper over several jobs), person_contract_documents (a person''s agreement, staff, sub or partner, sent or signed) and step_commitments (a sub work order) as one shape, with a common state (waiting, signed, ended), the job, the day and the words the find box searches. Drafts are left out. security_invoker: each table''s own policy decides what the caller sees. Documents → Agreements reads it newest first.';

GRANT SELECT ON public.agreements_on_file TO authenticated;
