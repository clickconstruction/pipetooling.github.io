SET lock_timeout = '3s';

-- Job accounts at the counter, PR 4 (v2.3430): the evidence rule. A job
-- "bought parts at a house with no job account" when an invoice is allocated
-- to it at a house that expects one (or a PO code was minted for the pair)
-- in the last 180 days, and no open / not-needed row exists for (job, house).
-- Two readers: the count for the Needs You card and the Pipeline Fix-ups
-- chip, the list for the Job Accounts tab filter and the fix-it list.
-- Office roles only (is_office_staff); everyone else the empty answer.

CREATE OR REPLACE FUNCTION public.list_job_account_evidence_gaps()
RETURNS TABLE (
  job_id uuid,
  supply_house_id uuid,
  house_name text,
  invoice_count integer,
  allocated_total numeric,
  unpaid_total numeric,
  po_count integer,
  last_at timestamptz,
  rep_name text,
  rep_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gate AS (
    SELECT public.is_office_staff() AS ok
  ),
  expecting AS (
    SELECT h.id, h.name
    FROM public.supply_houses h
    WHERE h.job_accounts = 'expects'
  ),
  inv AS (
    SELECT a.job_id,
           i.supply_house_id,
           i.id AS invoice_id,
           (COALESCE(i.amount, 0) * COALESCE(a.pct, 0) / 100)::numeric AS allocated,
           i.is_paid,
           COALESCE(i.invoice_date::timestamptz, i.created_at) AS at
    FROM public.supply_house_invoice_job_allocations a
    JOIN public.supply_house_invoices i ON i.id = a.invoice_id
    WHERE COALESCE(i.invoice_date::timestamptz, i.created_at) >= now() - interval '180 days'
  ),
  po AS (
    SELECT e.job_ledger_id AS job_id, e.supply_house_id, e.created_at AS at
    FROM public.material_po_generator_entries e
    WHERE e.supply_house_id IS NOT NULL
      AND e.created_at >= now() - interval '180 days'
  ),
  pairs AS (
    SELECT job_id, supply_house_id FROM inv
    UNION
    SELECT job_id, supply_house_id FROM po
  ),
  rep AS (
    SELECT DISTINCT ON (c.supply_house_id)
      c.supply_house_id,
      COALESCE(NULLIF(btrim(c.name), ''), NULLIF(btrim(c.label), ''), c.email) AS name,
      c.phone
    FROM public.supply_house_contacts c
    WHERE c.role = 'job_accounts' AND c.archived_at IS NULL AND c.supply_house_id IS NOT NULL
    ORDER BY c.supply_house_id, c.is_default DESC, c.name
  )
  SELECT
    p.job_id,
    p.supply_house_id,
    e.name,
    (SELECT count(*) FROM inv x WHERE x.job_id = p.job_id AND x.supply_house_id = p.supply_house_id)::int,
    COALESCE((SELECT sum(x.allocated) FROM inv x WHERE x.job_id = p.job_id AND x.supply_house_id = p.supply_house_id), 0)::numeric,
    COALESCE((SELECT sum(x.allocated) FROM inv x WHERE x.job_id = p.job_id AND x.supply_house_id = p.supply_house_id AND NOT x.is_paid), 0)::numeric,
    (SELECT count(*) FROM po x WHERE x.job_id = p.job_id AND x.supply_house_id = p.supply_house_id)::int,
    GREATEST(
      (SELECT max(x.at) FROM inv x WHERE x.job_id = p.job_id AND x.supply_house_id = p.supply_house_id),
      (SELECT max(x.at) FROM po x WHERE x.job_id = p.job_id AND x.supply_house_id = p.supply_house_id)
    ),
    rep.name,
    rep.phone
  FROM pairs p
  JOIN expecting e ON e.id = p.supply_house_id
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN rep ON rep.supply_house_id = p.supply_house_id
  WHERE (SELECT ok FROM gate)
    AND NOT EXISTS (
      SELECT 1 FROM public.job_supply_house_accounts s
      WHERE s.job_id = p.job_id
        AND s.supply_house_id = p.supply_house_id
        AND s.status IN ('open', 'not_needed')
    )
  ORDER BY 5 DESC, 8 DESC;
$$;

COMMENT ON FUNCTION public.list_job_account_evidence_gaps() IS
  'Job accounts at the counter (v2.3430): every (job, expecting house) pair with an invoice allocated or a PO code minted in the last 180 days and no open / not-needed account row — with allocated and unpaid dollars, counts, the latest evidence, and the house''s job-accounts rep. Office roles only; empty otherwise.';

REVOKE EXECUTE ON FUNCTION public.list_job_account_evidence_gaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_account_evidence_gaps() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.count_job_account_evidence_gaps()
RETURNS TABLE (jobs integer, pairs integer, allocated_total numeric, house_names text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(DISTINCT g.job_id)::int,
    count(*)::int,
    COALESCE(sum(g.allocated_total), 0)::numeric,
    COALESCE(string_agg(DISTINCT g.house_name, ', ' ORDER BY g.house_name), '')
  FROM public.list_job_account_evidence_gaps() g;
$$;

COMMENT ON FUNCTION public.count_job_account_evidence_gaps() IS
  'Job accounts at the counter (v2.3430): the Needs You / Pipeline Fix-ups count over list_job_account_evidence_gaps() — jobs, (job, house) pairs, allocated dollars, the houses named. Office roles only; zero otherwise.';

REVOKE EXECUTE ON FUNCTION public.count_job_account_evidence_gaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_job_account_evidence_gaps() TO authenticated, service_role;
