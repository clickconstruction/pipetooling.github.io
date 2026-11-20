SET lock_timeout = '3s';

-- Where an outside signer lives, PR 1 of seven: the ground (punch list #403, to-dos/outside-signer-record/README.md).
-- A migration and no screen. The owner's calls of 2026-11-19: a paper names a contact the app already keeps (call 1),
-- a business and the person who signs for it are two things (call 2), the office's four roles and the estimator read an
-- outside party's paper (call 4), a paper may go to someone on no list (call 6), and a sub's company is the trade
-- company the app already keeps (call 7).
--
--   1. person_contract_documents gains six columns. party_contact_id is the contacts row of who the paper is with.
--      party_name is that party's name as it stood when the paper was made. signer_name, signer_title and signer_email
--      say who signs and where the link went. signing_for is the business the signer signs for, in words.
--   2. A party's paper is filed under 'party:<contact id>', a name no person can have, as a trade company's paper is
--      filed under 'gc-company:<id>'. So a party named like a teammate never lands on the teammate. A check holds the
--      shape both ways, and the name trigger leaves such a paper with no roster person.
--   3. contacts_fold_papers carries a party's papers when two contacts become one (Who is this?, a customer merge, a
--      record deleted by a screen). The spine's contacts_fold runs every contacts_fold_<something>.
--   4. One new read policy: an estimator reads an agreement whose party is a customer, a supply house or a trade
--      company, a trade company's company_id agreement among them. Nothing filed under a person, and no tax form or
--      certificate (doc_type agreement only): those stay the four roles', as gc_company_paper_states left them.
--   5. agreements_on_file is restated from its newest definition, 20261118050000_agreements_job_papers.sql, with the
--      person branch changed and nothing else: a party's paper is a line of one of four new kinds.
--   6. esign_consents takes one more audience, 'outside', for a signer who is neither a customer nor a sub.
--   7. paper_party_contact is the door Send a paper finds a party's contact through, and makes one when the record has
--      none yet. A signed-in client cannot insert a contact.
--
-- No table is made, so there is no fence to call. Every statement is safe to run twice. Nothing writes the new
-- columns yet, and no client calls the door: PR 2 writes the signer on every send, and PR 3 makes the first party's
-- paper.

-- ---------- 1. The six columns ----------

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS party_contact_id uuid REFERENCES public.contacts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS party_name text,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_title text,
  ADD COLUMN IF NOT EXISTS signer_email text,
  ADD COLUMN IF NOT EXISTS signing_for text;

CREATE INDEX IF NOT EXISTS idx_person_contract_documents_party
  ON public.person_contract_documents (party_contact_id) WHERE party_contact_id IS NOT NULL;

COMMENT ON COLUMN public.person_contract_documents.party_contact_id IS
  'Punch list #403: the contact (contacts.id) of the outside party this paper is with: a customer, a person at one, a supply house, a rep, a trade company, or someone on no list yet. Its person_name is then ''party:'' || party_contact_id, which no person can have, and person_id is null. Null on a staff or sub paper and on a trade company''s company_id paper. ON DELETE RESTRICT: contacts_fold_papers moves the paper before a folded contact goes.';
COMMENT ON COLUMN public.person_contract_documents.party_name IS
  'Punch list #403: the party''s name as it stood when the paper was made, so a paper never loses the name of who it was with. Required on a party''s paper.';
COMMENT ON COLUMN public.person_contract_documents.signer_name IS
  'Punch list #403: who signs, as the office named them when the paper was sent. Kept on every paper from the second PR on. signer_printed_name is what the signer typed.';
COMMENT ON COLUMN public.person_contract_documents.signer_title IS
  'Punch list #403: the signer''s title, as the office typed it. Optional.';
COMMENT ON COLUMN public.person_contract_documents.signer_email IS
  'Punch list #403: the address the signing link went to. What a reminder and the signer''s copy are sent to.';
COMMENT ON COLUMN public.person_contract_documents.signing_for IS
  'Punch list #403: the business the signer signs for, in words, as the paper says it. Null when they sign for themselves.';

-- ---------- 2. A party's paper, held both ways ----------

-- Words are trimmed text or null, never ''. A CHECK passes on unknown, so every term says IS NULL first.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_party_words' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_party_words
      CHECK (
        (party_name IS NULL OR length(btrim(party_name)) BETWEEN 1 AND 200)
        AND (signer_name IS NULL OR length(btrim(signer_name)) BETWEEN 1 AND 200)
        AND (signer_title IS NULL OR length(btrim(signer_title)) BETWEEN 1 AND 200)
        AND (signer_email IS NULL OR (length(btrim(signer_email)) BETWEEN 3 AND 320 AND position('@' IN signer_email) > 1))
        AND (signing_for IS NULL OR length(btrim(signing_for)) BETWEEN 1 AND 200)
      ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_party_words;

-- A party's paper carries the party's stored name, no roster person, no company and no partnership, and its frozen
-- name. That stored name never stands without its party.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_party_paper' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_party_paper
      CHECK (
        (party_contact_id IS NULL AND person_name NOT LIKE 'party:%')
        OR (party_contact_id IS NOT NULL
            AND person_id IS NULL AND company_id IS NULL AND partnership_id IS NULL
            AND party_name IS NOT NULL
            AND person_name = 'party:' || party_contact_id::text)
      ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_party_paper;

-- The name trigger, restated from 20261010009000_gc_papers.sql with a party's paper beside a company's. A copy that
-- lost its party takes it back from the name (the Contract Book's new versions copy person_name only), and takes the
-- party's frozen name from the party's newest paper, else from the contact. A party's paper keeps no roster person. It
-- fires on party_contact_id too.
CREATE OR REPLACE FUNCTION public.contract_docs_set_person_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.person_name ~ '^gc-company:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    NEW.company_id := substr(NEW.person_name, 12)::uuid;
  END IF;
  IF NEW.company_id IS NOT NULL THEN
    NEW.person_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.party_contact_id IS NULL AND NEW.person_name ~ '^party:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    NEW.party_contact_id := substr(NEW.person_name, 7)::uuid;
  END IF;
  IF NEW.party_contact_id IS NOT NULL THEN
    NEW.person_id := NULL;
    IF NEW.party_name IS NULL THEN
      NEW.party_name := (
        SELECT d.party_name FROM public.person_contract_documents d
        WHERE d.party_contact_id = NEW.party_contact_id AND d.party_name IS NOT NULL
        ORDER BY (d.contract_lineage_id = NEW.contract_lineage_id) DESC, d.created_at DESC NULLS LAST, d.id
        LIMIT 1
      );
    END IF;
    IF NEW.party_name IS NULL THEN
      NEW.party_name := left(public.contact_display_name(NEW.party_contact_id), 200);
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.person_id IS NULL THEN
      NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
    END IF;
  ELSE
    IF NEW.person_id IS NOT DISTINCT FROM OLD.person_id THEN
      NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER set_person_id_on_write
  BEFORE INSERT OR UPDATE OF person_name, company_id, party_contact_id ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_docs_set_person_id();

-- ---------- 3. A fold keeps the paper ----------

-- The spine's contacts_fold runs every contacts_fold_<something>(p_from, p_into) after it moves the lines, numbers and
-- jobs, and before p_from goes. Without this, p_from's delete would be refused for the papers that name it. The stored
-- name moves with the party, so the check above holds. A definer: the papers are the four roles' to write, and a fold
-- runs as whoever names the number, merges the customers or deletes the record. It stands behind the row fences, so it
-- refuses by itself: outside a trigger, a call from someone signed in who is off the office team, a training account, a
-- digital twin or an archived account moves nothing, as the fold's own statements move nothing for them.
CREATE OR REPLACE FUNCTION public.contacts_fold_papers(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 0
     AND (NOT public.gc_office_team() OR public.is_read_only() OR public.is_digital_twin() OR public.caller_is_archived()) THEN
    RETURN;
  END IF;
  UPDATE public.person_contract_documents
  SET party_contact_id = p_into, person_name = 'party:' || p_into::text
  WHERE party_contact_id = p_from;
END;
$$;

COMMENT ON FUNCTION public.contacts_fold_papers(uuid, uuid) IS
  'Punch list #403: the spine''s contacts_fold runs it, so a folded contact''s papers are with the contact it folds into, under that contact''s stored name. A definer, since the papers are the four roles'' to write. Outside a trigger, a call from someone signed in off the office team, a training account, a digital twin or an archived account moves nothing.';

REVOKE EXECUTE ON FUNCTION public.contacts_fold_papers(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_fold_papers(uuid, uuid) TO authenticated, service_role;

-- ---------- 4. The estimator reads an outside company's agreement ----------

-- The owner's calls 4 and 7. Beside the table's own read policy (a dev, the leaders, the assistants and the
-- controller), an estimator reads an agreement that is with an outside company: a trade company's own paper
-- (company_id), or a party's paper whose contact is a customer, a person at one, a supply house, a rep, a trade company
-- or a person at one. The contact is read under the estimator's own contacts policy. What it leaves closed:
--   * every paper filed under a person: a staff paper, a sub's own, a partner's, a person's copy of a job's paper;
--   * a party who is on no list yet, until Add to a list says what they are;
--   * a W-9, a certificate and every other kind that is not an agreement, which the Board's call of 2026-10-10 kept to
--     their states for the office (gc_company_paper_states);
--   * a digital twin, which reads as an estimator.
-- Reading only: no write policy changes, and an archived account is closed by the fence already on the table.
DROP POLICY IF EXISTS person_contract_documents_estimator_outside ON public.person_contract_documents;
CREATE POLICY person_contract_documents_estimator_outside ON public.person_contract_documents
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_estimator())
    AND NOT (SELECT public.is_digital_twin())
    AND doc_type = 'agreement'
    AND person_id IS NULL
    AND partnership_id IS NULL
    AND (
      company_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = person_contract_documents.party_contact_id
          AND num_nonnulls(c.customer_id, c.customer_contact_person_id, c.supply_house_id, c.supply_house_contact_id,
                           c.gc_company_id, c.gc_company_person_id) = 1
      )
    )
  );

-- ---------- 5. Documents → Agreements lists a party's paper ----------

-- agreements_on_file (punch list #376) restated from 20261118050000_agreements_job_papers.sql. Only the person branch
-- changes:
--   * a party's paper is a line of the kind customer_agreement, supply_house_agreement, trade_agreement or
--     outside_agreement, by the record its contact points at today. outside_agreement is a party on no list, and
--     anyone whose record is none of the three;
--   * its name is the record's own name today (the customer, the supply house, the trade company), else the name
--     frozen on the paper, else the signer. The stored name 'party:<id>' is never shown or searched;
--   * every person-branch line's facts gain who signs (signer_name, signer_title, signing_for, signer_printed_name),
--     and a party's line gains party_kind and party_contact_id. A key with no value is left out, as before;
--   * the find box finds a party's paper by the party, the signer and the kind's words.
-- A staff, sub, partner or trade company paper reads as before. The columns are the same and in the same order, so the
-- tab, its search and every grant stay as they are. security_invoker as before: each table's own policy decides.

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
    ) AS replaced,
    -- Papers before a job opens: a person's copy of a paper a job requires carries that job, and the paper's own name.
    pj.hcp_number AS paper_job_hcp_number,
    pj.click_number AS paper_job_click_number,
    pj.job_name AS paper_job_name,
    pj.job_address AS paper_job_address,
    rp.paper_name AS required_paper_name,
    -- A party's paper (punch list #403): what its contact points at today, and that record's own name. A person at a
    -- customer, a rep and a person at a trade company read as the business they are at.
    CASE
      WHEN d.party_contact_id IS NULL THEN NULL
      WHEN pc.customer_id IS NOT NULL OR pc.customer_contact_person_id IS NOT NULL THEN 'customer'
      WHEN pc.supply_house_id IS NOT NULL OR pc.supply_house_contact_id IS NOT NULL THEN 'supply_house'
      WHEN pc.gc_company_id IS NOT NULL OR pc.gc_company_person_id IS NOT NULL THEN 'trade'
      WHEN pc.person_id IS NOT NULL THEN 'person'
      WHEN pc.prospect_id IS NOT NULL OR pc.team_prospect_id IS NOT NULL THEN 'other'
      ELSE 'none'
    END AS party_kind,
    COALESCE(NULLIF(btrim(pcu.name), ''), NULLIF(btrim(psh.name), ''), NULLIF(btrim(pgc.name), '')) AS party_record_name
  FROM public.person_contract_documents d
  LEFT JOIN public.people p ON p.id = d.person_id
  LEFT JOIN public.gc_companies co ON co.id = d.company_id
  LEFT JOIN public.jobs_ledger pj ON pj.id = d.job_id
  LEFT JOIN public.job_required_papers rp ON rp.id = d.job_required_paper_id
  LEFT JOIN public.contacts pc ON pc.id = d.party_contact_id
  LEFT JOIN public.customer_contact_persons pcp ON pcp.id = pc.customer_contact_person_id
  LEFT JOIN public.customers pcu ON pcu.id = COALESCE(pc.customer_id, pcp.customer_id)
  LEFT JOIN public.supply_house_contacts psr ON psr.id = pc.supply_house_contact_id
  LEFT JOIN public.supply_houses psh ON psh.id = COALESCE(pc.supply_house_id, psr.supply_house_id)
  LEFT JOIN public.gc_company_people pgp ON pgp.id = pc.gc_company_person_id
  LEFT JOIN public.gc_companies pgc ON pgc.id = COALESCE(pc.gc_company_id, pgp.company_id)
  -- A paper a job requires is an agreement whatever its form says it is: an NDA can be filed as a form of any kind.
  WHERE (d.doc_type = 'agreement' OR d.job_required_paper_id IS NOT NULL)
    AND d.status IN ('sent', 'signed')
),
person_rows AS (
  SELECT
    d.*,
    CASE WHEN d.replaced THEN 'ended' WHEN d.status = 'signed' THEN 'signed' ELSE 'waiting' END AS state,
    CASE
      WHEN d.status = 'signed' AND d.signed_at IS NOT NULL THEN (d.signed_at::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago'
      ELSE COALESCE(d.sent_at, d.created_at, now())
    END AS happened,
    CASE
      WHEN d.company_id IS NOT NULL THEN 'company_agreement'
      WHEN d.party_contact_id IS NOT NULL THEN
        CASE d.party_kind
          WHEN 'customer' THEN 'customer_agreement'
          WHEN 'supply_house' THEN 'supply_house_agreement'
          WHEN 'trade' THEN 'trade_agreement'
          ELSE 'outside_agreement'
        END
      WHEN d.partnership_id IS NOT NULL THEN 'partner_agreement'
      ELSE 'person_agreement'
    END AS line_kind
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
  (d.line_kind || ':' || d.id::text)::text AS id,
  d.line_kind::text AS kind,
  d.id AS source_id,
  d.state::text AS state,
  -- A job's paper is filed as '<paper> (job <number>)' so the Contract Book's name-keyed paths never take it for the
  -- person's own copy. The line shows the paper's own name, and the job beside it.
  COALESCE(NULLIF(btrim(d.required_paper_name), ''), btrim(d.document_name), '')::text AS paper_name,
  (CASE
    -- A company's paper is filed under a name no person can have ('gc-company:<id>'), which is never shown.
    WHEN d.company_id IS NOT NULL THEN COALESCE(NULLIF(btrim(d.company_name), ''), '')
    -- A party's paper is filed under 'party:<contact id>', never shown: the record's name today, else the frozen one.
    WHEN d.party_contact_id IS NOT NULL THEN COALESCE(d.party_record_name, NULLIF(btrim(d.party_name), ''), NULLIF(btrim(d.signer_name), ''), '')
    ELSE COALESCE(NULLIF(btrim(d.roster_name), ''), btrim(d.person_name), '')
  END)::text AS with_name,
  d.job_id,
  d.paper_job_hcp_number::text AS job_hcp_number,
  d.paper_job_click_number::text AS job_click_number,
  d.paper_job_name::text AS job_name,
  d.paper_job_address::text AS job_address,
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
      'replaced', CASE WHEN d.replaced THEN true END,
      'signer_name', NULLIF(btrim(d.signer_name), ''),
      'signer_title', NULLIF(btrim(d.signer_title), ''),
      'signing_for', NULLIF(btrim(d.signing_for), ''),
      'signer_printed_name', NULLIF(btrim(d.signer_printed_name), ''),
      'party_kind', d.party_kind,
      'party_contact_id', d.party_contact_id
    )
  ) AS facts,
  lower(
    concat_ws(
      ' ',
      d.document_name,
      d.roster_name,
      d.company_name,
      CASE WHEN d.company_id IS NULL AND d.party_contact_id IS NULL THEN d.person_name END,
      d.party_record_name,
      d.party_name,
      d.signer_name,
      d.signing_for,
      CASE
        WHEN d.company_id IS NOT NULL THEN 'trade company'
        WHEN d.party_contact_id IS NOT NULL THEN
          CASE d.party_kind
            WHEN 'customer' THEN 'customer outside company'
            WHEN 'supply_house' THEN 'supply house outside company'
            WHEN 'trade' THEN 'trade company'
            WHEN 'none' THEN 'not on a list outside company'
            ELSE 'outside company'
          END
        WHEN d.partnership_id IS NOT NULL THEN 'partner'
        WHEN d.roster_kind = 'sub' THEN 'sub'
        ELSE 'staff'
      END,
      -- A job's paper is found by the job too: its numbers, its name and its address.
      CASE WHEN d.job_required_paper_id IS NOT NULL THEN 'job paper' END,
      'J' || NULLIF(btrim(d.paper_job_hcp_number), ''),
      'J' || NULLIF(btrim(d.paper_job_click_number), ''),
      d.paper_job_name,
      d.paper_job_address
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
  'Every agreement on file, one list (punch list #376): job_contracts (a contract, a warranty, a GC''s own paper, a signed paper the office filed; one row for a paper over several jobs), person_contract_documents (a person''s agreement, staff, sub or partner, a trade company''s, a person''s copy of a paper a job requires, with its job and the paper''s own name, and since punch list #403 an outside party''s, named by the contact it is with: a customer''s, a supply house''s, a trade company''s, or someone on no list; sent or signed), step_commitments (a sub work order), gc_owner_contract_sends (our contract with the owner on a GC project, its newest send) and gc_sows (a trade''s statement of work) as one shape, with a common state (waiting, signed, ended), the job, the day and the words the find box searches. Drafts are left out. security_invoker: each table''s own policy decides what the caller sees. Documents → Agreements reads it newest first.';

GRANT SELECT ON public.agreements_on_file TO authenticated;

-- ---------- 6. A signer who is neither a customer nor a sub ----------

-- esign_consents keeps the consent words a signer agreed to, and its audience says who the signer was to us: a customer,
-- a sub (a subcontractor or a teammate) or a GC in the Bid Room. A supply house's rep or someone on no list is none of
-- those. 'outside' is theirs. The list below is the one the table was made with (20260908030946_esign_consents.sql,
-- never restated since) and 'outside'. NOT VALID then VALIDATE, as the kinds' check beside it: the ADD holds its lock
-- for an instant, and the VALIDATE reads the rows under a lock that blocks no read or write.
ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_audience_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_audience_check
  CHECK (audience IN ('customer', 'sub', 'gc', 'outside')) NOT VALID;
ALTER TABLE public.esign_consents VALIDATE CONSTRAINT esign_consents_audience_check;

-- ---------- 7. A party's contact, found or made ----------

-- Send a paper names the party by the record the app keeps: a customer, a person at one, a supply house, a rep, a trade
-- company or a person at one. Messages makes a contact for most of them, by its seeds or on first use, and a record
-- made since has none. A signed-in client has no INSERT on contacts (20261012010000_messages_spine.sql), so this is the
-- door: the contact that is that record, made when there is none, with the record's own number and address as its
-- channels, as contact_find_or_make makes a customer's. A definer, so it says its refusals first: signed in, not
-- archived, and one of the four roles that send a paper (a dev, the leaders, the assistants, the controller). A training
-- account and a digital twin may find a contact and never make one. One made by two presses at once is one: the second
-- waits on the first's lock and reads its row.
CREATE OR REPLACE FUNCTION public.paper_party_contact(p_record_table text, p_record_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to send a paper.' USING ERRCODE = 'P0001';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot send a paper.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_master_or_dev() OR public.is_assistant()) THEN
    RAISE EXCEPTION 'Only the office sends a paper.' USING ERRCODE = '42501';
  END IF;
  IF p_record_id IS NULL OR p_record_table IS NULL
     OR p_record_table NOT IN ('customers', 'customer_contact_persons', 'supply_houses', 'supply_house_contacts',
                               'gc_companies', 'gc_company_people') THEN
    RAISE EXCEPTION 'Pick who the paper is with.' USING ERRCODE = 'P0001';
  END IF;

  -- A customer's own contact is Messages' to make, with its own refusals.
  IF p_record_table = 'customers' THEN
    RETURN public.contact_find_or_make(p_record_id);
  END IF;

  -- Read into a variable: an IF's condition ends at its first THEN, a CASE's included.
  v_exists := CASE p_record_table
    WHEN 'customer_contact_persons' THEN EXISTS (SELECT 1 FROM public.customer_contact_persons WHERE id = p_record_id)
    WHEN 'supply_houses' THEN EXISTS (SELECT 1 FROM public.supply_houses WHERE id = p_record_id)
    WHEN 'supply_house_contacts' THEN EXISTS (SELECT 1 FROM public.supply_house_contacts WHERE id = p_record_id)
    WHEN 'gc_companies' THEN EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_record_id)
    ELSE EXISTS (SELECT 1 FROM public.gc_company_people WHERE id = p_record_id)
  END;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'That record is not there.' USING ERRCODE = 'P0001';
  END IF;

  -- One at a time per record, so two presses at once make one contact. A company's own contact carries no name.
  PERFORM pg_advisory_xact_lock(hashtextextended('paper_party_contact:' || p_record_table || ':' || p_record_id::text, 0));
  v_contact := CASE p_record_table
    WHEN 'customer_contact_persons' THEN (SELECT x.id FROM public.contacts x WHERE x.customer_contact_person_id = p_record_id)
    WHEN 'supply_houses' THEN (SELECT x.id FROM public.contacts x WHERE x.supply_house_id = p_record_id AND x.name IS NULL)
    WHEN 'supply_house_contacts' THEN (SELECT x.id FROM public.contacts x WHERE x.supply_house_contact_id = p_record_id)
    WHEN 'gc_companies' THEN (SELECT x.id FROM public.contacts x WHERE x.gc_company_id = p_record_id AND x.name IS NULL)
    ELSE (SELECT x.id FROM public.contacts x WHERE x.gc_company_person_id = p_record_id)
  END;
  IF v_contact IS NOT NULL THEN
    RETURN v_contact;
  END IF;

  -- A definer passes the read-only blocks and the twin fence, so each is said here before the first write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a party''s record.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a party''s record.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.contacts (kind, customer_contact_person_id, supply_house_id, supply_house_contact_id, gc_company_id, gc_company_person_id)
  VALUES (
    CASE p_record_table
      WHEN 'customer_contact_persons' THEN 'customer'
      WHEN 'supply_houses' THEN 'supply_house'
      WHEN 'supply_house_contacts' THEN 'supply_house'
      ELSE 'trade'
    END,
    CASE WHEN p_record_table = 'customer_contact_persons' THEN p_record_id END,
    CASE WHEN p_record_table = 'supply_houses' THEN p_record_id END,
    CASE WHEN p_record_table = 'supply_house_contacts' THEN p_record_id END,
    CASE WHEN p_record_table = 'gc_companies' THEN p_record_id END,
    CASE WHEN p_record_table = 'gc_company_people' THEN p_record_id END
  )
  RETURNING id INTO v_contact;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT v_contact, v.kind, btrim(v.value)
  FROM (
    SELECT 'phone' AS kind, r.phone AS value FROM public.customer_contact_persons r WHERE p_record_table = 'customer_contact_persons' AND r.id = p_record_id
    UNION ALL
    SELECT 'email', r.email FROM public.customer_contact_persons r WHERE p_record_table = 'customer_contact_persons' AND r.id = p_record_id
    UNION ALL
    SELECT 'phone', r.phone FROM public.supply_houses r WHERE p_record_table = 'supply_houses' AND r.id = p_record_id
    UNION ALL
    SELECT 'phone', r.phone FROM public.supply_house_contacts r WHERE p_record_table = 'supply_house_contacts' AND r.id = p_record_id
    UNION ALL
    SELECT 'email', r.email FROM public.supply_house_contacts r WHERE p_record_table = 'supply_house_contacts' AND r.id = p_record_id
    UNION ALL
    SELECT 'phone', r.phone FROM public.gc_companies r WHERE p_record_table = 'gc_companies' AND r.id = p_record_id
    UNION ALL
    SELECT 'email', r.email FROM public.gc_companies r WHERE p_record_table = 'gc_companies' AND r.id = p_record_id
    UNION ALL
    SELECT 'email', r.email FROM public.gc_company_people r WHERE p_record_table = 'gc_company_people' AND r.id = p_record_id
  ) v
  WHERE public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;
  RETURN v_contact;
END;
$$;

COMMENT ON FUNCTION public.paper_party_contact(text, uuid) IS
  'Punch list #403: the contact that is one record a paper can be with (customers, customer_contact_persons, supply_houses, supply_house_contacts, gc_companies or gc_company_people), made when there is none, with the record''s own number and address as its channels. A customer''s own goes through contact_find_or_make. SECURITY DEFINER: signed in, not archived, and one of the four roles that send a paper, said in words; a training account and a digital twin may find one and never make one.';

REVOKE ALL ON FUNCTION public.paper_party_contact(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paper_party_contact(text, uuid) TO authenticated, service_role;
