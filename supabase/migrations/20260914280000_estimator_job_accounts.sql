SET lock_timeout = '3s';

-- Job accounts from the bid (v2.3451): the estimator who won a bid gets the
-- job-account tools on the job the win moment creates. Estimators read no
-- jobs_ledger rows by design; every door here is gated on "the job carries
-- a bid" instead — the bid is theirs to read.

-- ---------- 1 · the gate ----------

CREATE OR REPLACE FUNCTION public.estimator_can_reach_job_account(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_estimator()
    AND EXISTS (
      SELECT 1
      FROM public.jobs_ledger j
      JOIN public.bids b ON b.id = j.bid_id
      WHERE j.id = p_job_id
    );
$$;

COMMENT ON FUNCTION public.estimator_can_reach_job_account(uuid) IS
  'Job accounts from the bid (v2.3451): an estimator may read and write a job''s supply-house accounts when the job was opened from a bid (jobs_ledger.bid_id). Estimators read every bid; they read no job rows, so this is their only door to the record.';

REVOKE EXECUTE ON FUNCTION public.estimator_can_reach_job_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estimator_can_reach_job_account(uuid) TO authenticated;

-- ---------- 2 · the record: a fourth branch on each policy ----------

DROP POLICY IF EXISTS job_supply_house_accounts_select_job_readers ON public.job_supply_house_accounts;
CREATE POLICY job_supply_house_accounts_select_job_readers
  ON public.job_supply_house_accounts FOR SELECT TO authenticated
  USING (
    public.can_read_job_activity(job_id, false)
    OR public.estimator_can_reach_job_account(job_id)
  );

DROP POLICY IF EXISTS job_supply_house_accounts_insert ON public.job_supply_house_accounts;
CREATE POLICY job_supply_house_accounts_insert
  ON public.job_supply_house_accounts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_office_staff()
    OR public.estimator_can_reach_job_account(job_id)
    OR (
      status = 'requested'
      AND requested_by = (SELECT auth.uid())
      AND public.can_read_job_activity(job_id, false)
    )
  );

DROP POLICY IF EXISTS job_supply_house_accounts_update_office ON public.job_supply_house_accounts;
CREATE POLICY job_supply_house_accounts_update_office
  ON public.job_supply_house_accounts FOR UPDATE TO authenticated
  USING (public.is_office_staff() OR public.estimator_can_reach_job_account(job_id))
  WITH CHECK (public.is_office_staff() OR public.estimator_can_reach_job_account(job_id));

-- ---------- 3 · the send log: the estimator's emails, with the bid ----------

ALTER TABLE public.supply_house_job_accounts
  ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supply_house_job_accounts.bid_id IS
  'v2.3451: the bid the estimator was working from when they emailed the house''s job-accounts rep (Ask {rep} by email). Null for the office''s packet sends.';

DROP POLICY IF EXISTS supply_house_job_accounts_select_estimator ON public.supply_house_job_accounts;
CREATE POLICY supply_house_job_accounts_select_estimator
  ON public.supply_house_job_accounts FOR SELECT TO authenticated
  USING (public.estimator_can_reach_job_account(job_id));

DROP POLICY IF EXISTS supply_house_job_accounts_insert_estimator_self ON public.supply_house_job_accounts;
CREATE POLICY supply_house_job_accounts_insert_estimator_self
  ON public.supply_house_job_accounts FOR INSERT TO authenticated
  WITH CHECK (
    public.estimator_can_reach_job_account(job_id)
    AND sent_by = (SELECT auth.uid())
  );

-- ---------- 4 · the reads ----------

-- The strip's RPC learns the estimator branch (same rows, same shape).
CREATE OR REPLACE FUNCTION public.list_job_account_strip(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid,
  supply_house_id uuid,
  house_name text,
  policy text,
  account_id uuid,
  status text,
  account_ref text,
  opened_via text,
  opened_at timestamptz,
  requested_at timestamptz,
  requested_from_counter boolean,
  account_note text,
  rep_contact_id uuid,
  rep_name text,
  rep_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jobs AS (
    SELECT j.id
    FROM public.jobs_ledger j
    WHERE j.id = ANY (COALESCE(p_job_ids, '{}'::uuid[]))
      AND (public.can_read_job_activity(j.id, false) OR public.estimator_can_reach_job_account(j.id))
  ),
  expecting AS (
    SELECT h.id
    FROM public.supply_houses h
    WHERE h.job_accounts = 'expects'
  ),
  pairs AS (
    SELECT jobs.id AS job_id, e.id AS house_id
    FROM jobs CROSS JOIN expecting e
    UNION
    SELECT a.job_id, a.supply_house_id
    FROM public.job_supply_house_accounts a
    JOIN jobs ON jobs.id = a.job_id
  ),
  rep AS (
    SELECT DISTINCT ON (c.supply_house_id)
      c.supply_house_id,
      c.id,
      COALESCE(NULLIF(btrim(c.name), ''), NULLIF(btrim(c.label), ''), c.email) AS name,
      c.phone
    FROM public.supply_house_contacts c
    WHERE c.role = 'job_accounts'
      AND c.archived_at IS NULL
      AND c.supply_house_id IS NOT NULL
    ORDER BY c.supply_house_id, c.is_default DESC, c.name
  )
  SELECT
    p.job_id,
    p.house_id,
    h.name,
    h.job_accounts,
    a.id,
    a.status,
    a.account_ref,
    a.opened_via,
    a.opened_at,
    a.requested_at,
    a.requested_from_counter,
    a.note,
    rep.id,
    rep.name,
    rep.phone
  FROM pairs p
  JOIN public.supply_houses h ON h.id = p.house_id
  LEFT JOIN public.job_supply_house_accounts a
    ON a.job_id = p.job_id AND a.supply_house_id = p.house_id
  LEFT JOIN rep ON rep.supply_house_id = p.house_id
  ORDER BY p.job_id, h.name;
$$;

COMMENT ON FUNCTION public.list_job_account_strip(uuid[]) IS
  'Job accounts at the counter (v2.3424, v2.3451): per readable job, one row per house that expects a job account (status NULL = none yet) plus every account the job has elsewhere, with the house''s job-accounts rep. Gate: can_read_job_activity(job, false) or, for estimators, the job carries a bid.';

-- The job's identity for the after-create question — the prompt needs the
-- number, name and address, and an estimator cannot select them.
CREATE OR REPLACE FUNCTION public.job_account_job_identity(p_job_id uuid)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  click_number text,
  job_name text,
  job_address text,
  bid_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.bid_id
  FROM public.jobs_ledger j
  WHERE j.id = p_job_id
    AND (public.can_read_job_activity(j.id, false) OR public.estimator_can_reach_job_account(j.id));
$$;

COMMENT ON FUNCTION public.job_account_job_identity(uuid) IS
  'Job accounts from the bid (v2.3451): the job''s number, name, address and bid for the Job accounts question — readable by job readers and by estimators when the job carries a bid.';

REVOKE EXECUTE ON FUNCTION public.job_account_job_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_account_job_identity(uuid) TO authenticated;

-- The bid side: the linked job's strip per bid, plus which houses quoted the
-- bid (bid_rfqs) and the job-accounts rep's email for Ask {rep} by email.
CREATE OR REPLACE FUNCTION public.list_bid_job_account_strip(p_bid_ids uuid[])
RETURNS TABLE (
  bid_id uuid,
  job_id uuid,
  job_hcp_number text,
  job_click_number text,
  job_name text,
  job_address text,
  supply_house_id uuid,
  house_name text,
  policy text,
  quoted boolean,
  status text,
  account_ref text,
  opened_via text,
  opened_at timestamptz,
  requested_at timestamptz,
  rep_contact_id uuid,
  rep_name text,
  rep_phone text,
  rep_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT u.role FROM public.users u WHERE u.id = (SELECT auth.uid())
  ),
  bids_in AS (
    SELECT b.id
    FROM public.bids b
    WHERE b.id = ANY (COALESCE(p_bid_ids, '{}'::uuid[]))
      AND (SELECT role FROM me) IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
  ),
  job_for_bid AS (
    SELECT DISTINCT ON (j.bid_id) j.bid_id, j.id, j.hcp_number, j.click_number, j.job_name, j.job_address
    FROM public.jobs_ledger j
    JOIN bids_in ON bids_in.id = j.bid_id
    ORDER BY j.bid_id, j.created_at DESC
  ),
  quoted AS (
    SELECT DISTINCT r.bid_id, r.supply_house_id
    FROM public.bid_rfqs r
    JOIN bids_in ON bids_in.id = r.bid_id
    WHERE r.supply_house_id IS NOT NULL
  ),
  expecting AS (
    SELECT h.id FROM public.supply_houses h WHERE h.job_accounts = 'expects'
  ),
  pairs AS (
    SELECT bids_in.id AS bid_id, e.id AS house_id FROM bids_in CROSS JOIN expecting e
    UNION
    SELECT q.bid_id, q.supply_house_id FROM quoted q
    UNION
    SELECT jb.bid_id, a.supply_house_id
    FROM public.job_supply_house_accounts a
    JOIN job_for_bid jb ON jb.id = a.job_id
  ),
  rep AS (
    SELECT DISTINCT ON (c.supply_house_id)
      c.supply_house_id,
      c.id,
      COALESCE(NULLIF(btrim(c.name), ''), NULLIF(btrim(c.label), ''), c.email) AS name,
      c.phone,
      c.email
    FROM public.supply_house_contacts c
    WHERE c.role = 'job_accounts'
      AND c.archived_at IS NULL
      AND c.supply_house_id IS NOT NULL
    ORDER BY c.supply_house_id, c.is_default DESC, c.name
  )
  SELECT
    p.bid_id,
    jb.id,
    jb.hcp_number,
    jb.click_number,
    jb.job_name,
    jb.job_address,
    p.house_id,
    h.name,
    h.job_accounts,
    EXISTS (SELECT 1 FROM quoted q WHERE q.bid_id = p.bid_id AND q.supply_house_id = p.house_id),
    a.status,
    a.account_ref,
    a.opened_via,
    a.opened_at,
    a.requested_at,
    rep.id,
    rep.name,
    rep.phone,
    rep.email
  FROM pairs p
  JOIN public.supply_houses h ON h.id = p.house_id
  LEFT JOIN job_for_bid jb ON jb.bid_id = p.bid_id
  LEFT JOIN public.job_supply_house_accounts a
    ON jb.id IS NOT NULL AND a.job_id = jb.id AND a.supply_house_id = p.house_id
  LEFT JOIN rep ON rep.supply_house_id = p.house_id
  WHERE h.vendor_kind = 'supply_house'
  ORDER BY p.bid_id, h.name;
$$;

COMMENT ON FUNCTION public.list_bid_job_account_strip(uuid[]) IS
  'Job accounts from the bid (v2.3451): per bid the office or an estimator can read — the linked job (newest by created_at) and one row per house that expects a job account, quoted the bid (bid_rfqs), or holds an account on the job; each with the account status and the house''s job-accounts rep (id, name, phone, email). Gate: role in the office set or estimator.';

REVOKE EXECUTE ON FUNCTION public.list_bid_job_account_strip(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_bid_job_account_strip(uuid[]) TO authenticated;
