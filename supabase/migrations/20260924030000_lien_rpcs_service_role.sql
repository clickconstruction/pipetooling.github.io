-- v2.3789 (punch list #41, PR 2): the two Lien desk RPCs the Timeline book reads —
-- list_lien_notice_months and list_lien_affidavit_windows — let the SERVICE ROLE
-- through their office-role gate, so the legal-portal edge function can read the
-- book and hand the collections law firm counsel's grid live on their portal.
-- Bodies are v2.3747's (20260923170000) verbatim; only the `me` CTE and the GRANT
-- change. CREATE OR REPLACE — same signature, same return table, no drop window.
SET lock_timeout = '3s';

-- ---------- 1 · the Lien desk queue: list_lien_notice_months ----------

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
  desk_months text[],
  month_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.is_dev()
        OR public.is_assistant()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
        OR auth.role() = 'service_role' AS ok
  ),
  jobs AS (
    SELECT j.id,
           j.customer_id,
           j.gc_customer_id,
           j.created_at,
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
      AND (j.status = 'billed' OR EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = j.id AND i.status = 'billed'))
      AND j.gc_customer_id IS NOT NULL
      AND COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0) > 0
  ),
  -- Every approved work month (as before), then one creation month for each job that has none (v2.3747).
  months AS (
    SELECT cs.job_ledger_id AS job_id,
           to_char(cs.work_date::date, 'YYYY-MM') AS work_month,
           SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS approved_hours,
           'hours'::text AS month_source
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
    GROUP BY 1, 2
    UNION ALL
    SELECT jobs.id,
           public.lien_fallback_month(jobs.created_at),
           0::numeric,
           'job_created'::text
    FROM jobs
    WHERE public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = jobs.id
          AND cs.approved_at IS NOT NULL
          AND cs.rejected_at IS NULL
          AND cs.revoked_at IS NULL
          AND cs.clocked_out_at IS NOT NULL
          AND cs.clocked_out_at > cs.clocked_in_at
      )
  ),
  dated AS (
    SELECT m.job_id, m.work_month, m.approved_hours, m.month_source,
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
  ),
  -- A closed month nobody wrote down, since the desk went live (v2.3680).
  silent AS (
    SELECT f.job_id, f.work_month FROM flagged f
    WHERE f.deadline IS NOT NULL AND f.deadline < public.app_today() - 7
      AND NOT f.noticed AND NOT f.recorded AND f.deadline >= DATE '2026-09-14'
  ),
  -- The jobs in the window (v2.3412): any month inside the look-ahead, or a silent closed month.
  w AS (
    SELECT DISTINCT x.job_id FROM flagged x
    WHERE x.deadline IS NOT NULL
      AND x.deadline <= public.app_today() + GREATEST(0, p_within_days)
      AND x.deadline >= public.app_today() - 7
    UNION
    SELECT DISTINCT s.job_id FROM silent s
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
         i.months AS desk_months,
         d.month_source
  FROM flagged d
  JOIN w ON w.job_id = d.job_id
  LEFT JOIN LATERAL (
    SELECT x.id, x.status, x.months
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.job_id AND x.kind = 'notice_53_056' AND x.voided_at IS NULL
      AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE d.deadline IS NOT NULL
    AND (
      d.deadline >= public.app_today() - 7
      OR EXISTS (SELECT 1 FROM silent s WHERE s.job_id = d.job_id AND s.work_month = d.work_month)
    )
  ORDER BY d.deadline, d.job_id, d.work_month;
$$;

REVOKE EXECUTE ON FUNCTION public.list_lien_notice_months(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_notice_months(integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_lien_notice_months(integer) IS
  'Lien desk (v2.3405, v2.3412, v2.3680, v2.3683, v2.3747): every (sub job, work month) with money open — approved work months, or the creation month of a job with no approved hours (month_source = job_created, approved_hours 0); a job counts when billed or with a billed invoice; once any month is inside p_within_days ahead (or a week behind), or a closed month is unnoticed and unrecorded since 2026-09-14, every month with an open window rides along, plus those silent closed months — with whether a live notice names the month, whether an owner of record with a mailing address is on file, and the live desk item. Office roles, or the service role (the legal-portal function reads the book for counsel''s grid, v2.3789); empty otherwise.';

-- ---------- 2 · the affidavit windows: list_lien_affidavit_windows ----------

CREATE OR REPLACE FUNCTION public.list_lien_affidavit_windows(p_within_days integer DEFAULT 30)
RETURNS TABLE (
  job_id uuid,
  last_month text,
  deadline date,
  is_sub boolean,
  noticed boolean,
  filed boolean,
  open_balance numeric,
  customer_id uuid,
  gc_customer_id uuid,
  property_kind text,
  has_owner boolean,
  has_legal boolean,
  homestead boolean,
  desk_item_id uuid,
  desk_status text,
  month_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.is_dev()
        OR public.is_assistant()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
        OR auth.role() = 'service_role' AS ok
  ),
  jobs AS (
    SELECT j.id,
           j.customer_id,
           j.gc_customer_id,
           j.created_at,
           GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0))::numeric AS open_balance,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner,
           (COALESCE(btrim(ca.county), '') <> '' AND COALESCE(btrim(ca.legal_description), '') <> '') AS has_legal,
           COALESCE(ca.homestead, false) AS homestead
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND (j.status = 'billed' OR EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = j.id AND i.status = 'billed'))
      AND COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0) > 0
  ),
  -- The last approved work month (as before), or the creation month of a job with none (v2.3747).
  last_months AS (
    SELECT cs.job_ledger_id AS job_id,
           max(to_char(cs.work_date::date, 'YYYY-MM')) AS last_month,
           'hours'::text AS month_source
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    GROUP BY 1
    UNION ALL
    SELECT jobs.id,
           public.lien_fallback_month(jobs.created_at),
           'job_created'::text
    FROM jobs
    WHERE public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = jobs.id
          AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
      )
  ),
  dated AS (
    SELECT jobs.*, lm.last_month, lm.month_source,
           public.lien_filing_deadline(lm.last_month, jobs.property_kind) AS deadline
    FROM jobs
    JOIN last_months lm ON lm.job_id = jobs.id
  )
  SELECT d.id AS job_id,
         d.last_month,
         d.deadline,
         d.gc_customer_id IS NOT NULL AS is_sub,
         EXISTS (SELECT 1 FROM public.job_lien_filings f WHERE f.job_id = d.id AND f.kind = 'notice_53_056' AND f.voided_at IS NULL) AS noticed,
         EXISTS (SELECT 1 FROM public.job_lien_filings f WHERE f.job_id = d.id AND f.kind = 'affidavit' AND f.voided_at IS NULL AND f.filed_at IS NOT NULL) AS filed,
         d.open_balance,
         d.customer_id,
         d.gc_customer_id,
         d.property_kind,
         d.has_owner,
         d.has_legal,
         d.homestead,
         i.id AS desk_item_id,
         i.status AS desk_status,
         d.month_source
  FROM dated d
  LEFT JOIN LATERAL (
    SELECT x.id, x.status
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.id AND x.kind = 'affidavit' AND x.voided_at IS NULL AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE d.deadline IS NOT NULL
    AND d.deadline <= public.app_today() + GREATEST(0, p_within_days)
    AND d.deadline >= public.app_today() - 7
  ORDER BY d.deadline, d.id;
$$;

REVOKE EXECUTE ON FUNCTION public.list_lien_affidavit_windows(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_affidavit_windows(integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_lien_affidavit_windows(integer) IS
  'Lien desk affidavits (v2.3412; v2.3747): every unpaid billed job whose § 53.052 affidavit window (4th month after the last month worked, 3rd residential — or after the creation month of a job with no approved hours, month_source = job_created) is within p_within_days ahead or a week behind, with the gate facts (owner of record, county + legal description, a recorded notice, homestead), whether an affidavit is already filed, and the live desk item. Office roles, or the service role (the legal-portal function reads the book for counsel''s grid, v2.3789); empty otherwise.';
