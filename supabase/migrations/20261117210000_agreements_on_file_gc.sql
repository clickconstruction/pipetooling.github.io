SET lock_timeout = '3s';

-- Documents → Agreements reads GC mode's papers too (punch list #376, the last step). The agreements_on_file view
-- (20261117200000) gains what it left for later:
--
--   company_agreement   a trade company's agreement: a person_contract_documents row with a company_id, which the
--                       person branch left out. Its party is the company's name, never the 'gc-company:<id>' name the
--                       row is filed under.
--   owner_contract      our contract with the owner on a GC project (gc_owner_contract_sends). Every send is a row, and
--                       the newest is the one to sign, so it is the one line a project has. signed once signed_on is set.
--   sow                 a trade's statement of work (gc_sows), once sent: sent waits, signed is signed, cancelled is ended.
--
-- A GC project is not a jobs_ledger job, so job_id and the job's numbers are null and the project's name rides job_name.
-- The other three branches are as 20261117200000 wrote them. A view: CREATE OR REPLACE with the same columns; no table
-- is made, so no fence.
--
-- The gates stay each table's own (security_invoker). gc_owner_contract_sends answers a dev; gc_sows a dev, the owner
-- and the controller; a company's paper whoever reads person_contract_documents, the office. The joins on projects,
-- customers, gc_trade_packages and gc_companies are left joins under their own policies, so a row the caller may read
-- never disappears for a name they may not.

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
    co.name AS company_name,
    EXISTS (
      SELECT 1 FROM public.person_contract_documents newer WHERE newer.supersedes_person_contract_document_id = d.id
    ) AS replaced
  FROM public.person_contract_documents d
  LEFT JOIN public.people p ON p.id = d.person_id
  LEFT JOIN public.gc_companies co ON co.id = d.company_id
  WHERE d.doc_type = 'agreement'
    AND d.status IN ('sent', 'signed')
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
),
-- GC mode: our contract with the owner. Every send is a row (the first, each reminder, each new price); the newest is
-- the one to sign, so it is the line.
owner_rows AS (
  SELECT DISTINCT ON (s.project_id)
    s.*,
    pr.name AS project_name,
    cu.name AS customer_name,
    CASE WHEN s.signed_on IS NOT NULL THEN 'signed' ELSE 'waiting' END AS state,
    (COALESCE(s.signed_on, s.sent_on)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago' AS happened
  FROM public.gc_owner_contract_sends s
  LEFT JOIN public.projects pr ON pr.id = s.project_id
  LEFT JOIN public.customers cu ON cu.id = s.customer_id
  ORDER BY s.project_id, s.created_at DESC, s.id DESC
),
-- GC mode: a trade's statement of work, once it is sent.
sow_rows AS (
  SELECT
    w.*,
    tp.trade,
    pr.name AS project_name,
    co.name AS company_name,
    CASE w.status WHEN 'signed' THEN 'signed' WHEN 'sent' THEN 'waiting' ELSE 'ended' END AS state,
    COALESCE((COALESCE(CASE WHEN w.status = 'signed' THEN w.signed_on END, w.sent_on)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago', w.created_at) AS happened
  FROM public.gc_sows w
  LEFT JOIN public.gc_trade_packages tp ON tp.id = w.package_id
  LEFT JOIN public.projects pr ON pr.id = tp.project_id
  LEFT JOIN public.gc_companies co ON co.id = w.company_id
  WHERE w.status <> 'draft'
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
  (CASE WHEN d.company_id IS NOT NULL THEN 'company_agreement' WHEN d.partnership_id IS NOT NULL THEN 'partner_agreement' ELSE 'person_agreement' END || ':' || d.id::text)::text AS id,
  (CASE WHEN d.company_id IS NOT NULL THEN 'company_agreement' WHEN d.partnership_id IS NOT NULL THEN 'partner_agreement' ELSE 'person_agreement' END)::text AS kind,
  d.id AS source_id,
  d.state::text AS state,
  COALESCE(btrim(d.document_name), '')::text AS paper_name,
  (CASE
    -- A company's paper is filed under a name no person can have ('gc-company:<id>'), which is never shown.
    WHEN d.company_id IS NOT NULL THEN COALESCE(NULLIF(btrim(d.company_name), ''), '')
    ELSE COALESCE(NULLIF(btrim(d.roster_name), ''), btrim(d.person_name), '')
  END)::text AS with_name,
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
      d.company_name,
      CASE WHEN d.company_id IS NULL THEN d.person_name END,
      CASE WHEN d.company_id IS NOT NULL THEN 'trade company' WHEN d.partnership_id IS NOT NULL THEN 'partner' WHEN d.roster_kind = 'sub' THEN 'sub' ELSE 'staff' END
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
FROM order_rows o

UNION ALL

SELECT
  ('owner_contract:' || s.id::text)::text AS id,
  'owner_contract'::text AS kind,
  s.id AS source_id,
  s.state::text AS state,
  ''::text AS paper_name,
  COALESCE(btrim(s.customer_name), '')::text AS with_name,
  NULL::uuid AS job_id,
  NULL::text AS job_hcp_number,
  NULL::text AS job_click_number,
  s.project_name::text AS job_name,
  NULL::text AS job_address,
  0::integer AS more_jobs,
  NULL::uuid AS person_id,
  NULL::text AS person_kind,
  s.happened AS at,
  (s.happened AT TIME ZONE 'America/Chicago')::date AS at_day,
  jsonb_strip_nulls(jsonb_build_object('sent_on', s.sent_on, 'sign_by', s.sign_by, 'signed_on', s.signed_on)) AS facts,
  lower(concat_ws(' ', 'owner contract', 'our contract with the owner', s.customer_name, s.project_name, s.signer_printed_name))::text AS find_text
FROM owner_rows s

UNION ALL

SELECT
  ('sow:' || w.id::text)::text AS id,
  'sow'::text AS kind,
  w.id AS source_id,
  w.state::text AS state,
  COALESCE('Statement of work · ' || NULLIF(btrim(w.trade), ''), '')::text AS paper_name,
  COALESCE(btrim(w.company_name), '')::text AS with_name,
  NULL::uuid AS job_id,
  NULL::text AS job_hcp_number,
  NULL::text AS job_click_number,
  w.project_name::text AS job_name,
  NULL::text AS job_address,
  0::integer AS more_jobs,
  NULL::uuid AS person_id,
  NULL::text AS person_kind,
  w.happened AS at,
  (w.happened AT TIME ZONE 'America/Chicago')::date AS at_day,
  jsonb_strip_nulls(jsonb_build_object('status', w.status, 'sent_on', w.sent_on, 'signed_on', w.signed_on)) AS facts,
  lower(concat_ws(' ', 'statement of work', w.trade, w.company_name, w.project_name, w.signer_printed_name))::text AS find_text
FROM sow_rows w;

COMMENT ON VIEW public.agreements_on_file IS
  'Every agreement on file, one list (punch list #376): job_contracts (a contract, a warranty, a GC''s own paper, a signed paper the office filed; one row for a paper over several jobs), person_contract_documents (a person''s agreement, staff, sub or partner, and a trade company''s, sent or signed), step_commitments (a sub work order), gc_owner_contract_sends (our contract with the owner on a GC project, its newest send) and gc_sows (a trade''s statement of work) as one shape, with a common state (waiting, signed, ended), the job, the day and the words the find box searches. Drafts are left out. security_invoker: each table''s own policy decides what the caller sees. Documents → Agreements reads it newest first.';

GRANT SELECT ON public.agreements_on_file TO authenticated;
