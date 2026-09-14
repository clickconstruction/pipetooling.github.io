SET lock_timeout = '3s';

-- Job accounts at the counter, PR 2 (v2.3424): the one read the job strip
-- makes. For every job the caller can read, one row per house that expects
-- a job account (status NULL = none yet) plus one row per account the job
-- has at any other house — with the house's job-accounts rep (name + phone)
-- so the field's Call button dials the right person.
--
-- SECURITY DEFINER because the crew (subcontractor, helpers) cannot read
-- supply_houses directly; the gate is the same one the table's RLS uses.

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
      AND public.can_read_job_activity(j.id, false)
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
  'Job accounts at the counter (v2.3424): per readable job, one row per house that expects a job account (status NULL = none yet) plus every account the job has elsewhere, with the house''s job-accounts rep. Gate: can_read_job_activity(job, false).';

REVOKE EXECUTE ON FUNCTION public.list_job_account_strip(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_account_strip(uuid[]) TO authenticated, service_role;
