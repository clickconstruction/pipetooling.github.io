SET lock_timeout = '3s';

-- Lien desk (v2.3680): a § 53.056 window that closed with nothing recorded stays on
-- the desk until someone writes it down. The RPC kept a closed month for seven days
-- ("a week behind so a missed month is seen"), after which it aged out of every
-- client-side computation and the loss went silent. Now an unnoticed closed month
-- with no `missed` desk row naming it (no skip, no noted miss — v2.3679) is returned
-- as long as its deadline is on or after the day the desk went live (2026-09-14);
-- months whose window closed before the desk existed were never its to catch. A
-- recorded closed month keeps the old seven days, then drops — its record lives on
-- the desk item. Same signature and return shape: CREATE OR REPLACE, no client change.
CREATE OR REPLACE FUNCTION public.list_lien_notice_months(p_within_days integer DEFAULT 30)
RETURNS TABLE (
  job_id uuid,
  work_month text,
  approved_hours numeric,
  deadline date,
  noticed boolean,
  open_balance numeric,
  customer_id uuid,
  gc_customer_id uuid,
  property_kind text,
  has_owner boolean,
  desk_item_id uuid,
  desk_status text,
  desk_months text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.is_dev()
        OR public.is_assistant()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician') AS ok
  ),
  jobs AS (
    SELECT j.id,
           j.customer_id,
           j.gc_customer_id,
           GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0))::numeric AS open_balance,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND j.status = 'billed'
      AND j.gc_customer_id IS NOT NULL
      AND COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0) > 0
  ),
  months AS (
    SELECT cs.job_ledger_id AS job_id,
           to_char(cs.work_date::date, 'YYYY-MM') AS work_month,
           SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS approved_hours
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
    GROUP BY 1, 2
  ),
  dated AS (
    SELECT m.job_id, m.work_month, m.approved_hours,
           public.lien_notice_deadline(m.work_month, jobs.property_kind) AS deadline,
           jobs.open_balance, jobs.customer_id, jobs.gc_customer_id, jobs.property_kind, jobs.has_owner
    FROM months m
    JOIN jobs ON jobs.id = m.job_id
  ),
  flagged AS (
    SELECT d.*,
           EXISTS (
             SELECT 1 FROM public.job_lien_filings f
             WHERE f.job_id = d.job_id AND f.kind = 'notice_53_056' AND f.voided_at IS NULL
               AND d.work_month = ANY (f.months_covered)
           ) AS noticed,
           -- A skip or a noted miss (v2.3679) naming the month: the closed window is written down.
           EXISTS (
             SELECT 1 FROM public.job_lien_desk_items x
             WHERE x.job_id = d.job_id AND x.kind = 'notice_53_056' AND x.voided_at IS NULL
               AND x.status = 'missed' AND d.work_month = ANY (x.months)
           ) AS recorded
    FROM dated d
  )
  SELECT d.job_id,
         d.work_month,
         round(d.approved_hours, 1) AS approved_hours,
         d.deadline,
         d.noticed,
         d.open_balance,
         d.customer_id,
         d.gc_customer_id,
         d.property_kind,
         d.has_owner,
         i.id AS desk_item_id,
         i.status AS desk_status,
         i.months AS desk_months
  FROM flagged d
  LEFT JOIN LATERAL (
    SELECT x.id, x.status, x.months
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.job_id AND x.kind = 'notice_53_056' AND x.voided_at IS NULL
      AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE d.deadline IS NOT NULL
    AND d.deadline <= public.app_today() + GREATEST(0, p_within_days)
    AND (
      d.deadline >= public.app_today() - 7
      OR (NOT d.noticed AND NOT d.recorded AND d.deadline >= DATE '2026-09-14')
    )
  ORDER BY d.deadline, d.job_id, d.work_month;
$$;

COMMENT ON FUNCTION public.list_lien_notice_months(integer) IS
  'Lien desk (v2.3405, v2.3680): every (sub job, approved work month) with money open whose § 53.056 notice deadline is within p_within_days ahead, or a week behind, or — closed with no notice and no missed/skip desk row naming it — any time since the desk went live (2026-09-14); with whether a live notice names the month, whether an owner of record with a mailing address is on file, and the live desk item. Office roles only; empty otherwise.';

REVOKE EXECUTE ON FUNCTION public.list_lien_notice_months(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_notice_months(integer) TO authenticated;
