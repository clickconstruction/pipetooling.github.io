SET lock_timeout = '3s';

-- Punch list #94, PR 4 (v2.4788): a Collections job the office marked Uncollectible (20261007170000)
-- leaves the Lien desk. The three list_* RPCs behind its queues re-created with one clause each —
-- `AND j.uncollectible_at IS NULL` beside the status / retainage predicate — bodies otherwise verbatim
-- from their last definitions (named below). The client calendar, GC on notice and the owner-records
-- picker skip the mark on their side in the same PR.

-- list_lien_notice_months: last defined in 20261006120000_lien_last_work_day.sql; + the Uncollectible clause.
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
           j.lien_last_work_on,
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
      AND j.uncollectible_at IS NULL
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
    WHERE jobs.lien_last_work_on IS NULL
      AND public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = jobs.id
          AND cs.approved_at IS NOT NULL
          AND cs.rejected_at IS NULL
          AND cs.revoked_at IS NULL
          AND cs.clocked_out_at IS NOT NULL
          AND cs.clocked_out_at > cs.clocked_in_at
      )
    UNION ALL
    -- The last day of work set by hand (v2.4676): its month, when no approved session reaches that month.
    SELECT jobs.id,
           to_char(jobs.lien_last_work_on, 'YYYY-MM'),
           0::numeric,
           'hand'::text
    FROM jobs
    WHERE jobs.lien_last_work_on IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = jobs.id
          AND cs.approved_at IS NOT NULL
          AND cs.rejected_at IS NULL
          AND cs.revoked_at IS NULL
          AND cs.clocked_out_at IS NOT NULL
          AND cs.clocked_out_at > cs.clocked_in_at
          AND to_char(cs.work_date::date, 'YYYY-MM') >= to_char(jobs.lien_last_work_on, 'YYYY-MM')
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

-- list_lien_affidavit_windows: last defined in 20261006120000_lien_last_work_day.sql; + the Uncollectible clause.
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
           j.lien_last_work_on,
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
      AND j.uncollectible_at IS NULL
      AND COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0) > 0
  ),
  -- The last approved work month (as before), or the creation month of a job with none (v2.3747).
  last_months_raw AS (
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
    WHERE jobs.lien_last_work_on IS NULL
      AND public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = jobs.id
          AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
      )
    UNION ALL
    -- The last day of work set by hand (v2.4676): its month; the later of it and the sessions' last month wins below.
    SELECT jobs.id,
           to_char(jobs.lien_last_work_on, 'YYYY-MM'),
           'hand'::text
    FROM jobs
    WHERE jobs.lien_last_work_on IS NOT NULL
  ),
  -- One row per job (v2.4676): the latest month wins, and its source with it.
  last_months AS (
    SELECT r.job_id,
           max(r.last_month) AS last_month,
           (array_agg(r.month_source ORDER BY r.last_month DESC))[1] AS month_source
    FROM last_months_raw r
    GROUP BY r.job_id
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

-- list_lien_retainage_windows: last defined in 20260923200000_lien_retainage_notice.sql; + the Uncollectible clause.
CREATE OR REPLACE FUNCTION public.list_lien_retainage_windows(p_within_days integer DEFAULT 30)
RETURNS TABLE (
  job_id uuid,
  retainage_held numeric,
  contract_ended_on date,
  contract_ended_how text,
  deadline date,
  noticed boolean,
  in_claim boolean,
  open_balance numeric,
  customer_id uuid,
  gc_customer_id uuid,
  property_kind text,
  has_owner boolean,
  payment_bond text,
  desk_item_id uuid,
  desk_status text
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
           j.lien_retainage_held,
           j.lien_contract_ended_on,
           j.lien_contract_ended_how,
           j.lien_payment_bond,
           public.lien_retainage_deadline(j.lien_contract_ended_on) AS deadline,
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
      AND j.gc_customer_id IS NOT NULL
      AND COALESCE(j.lien_retainage_held, 0) > 0
      AND j.uncollectible_at IS NULL
  )
  SELECT d.id AS job_id,
         d.lien_retainage_held AS retainage_held,
         d.lien_contract_ended_on AS contract_ended_on,
         d.lien_contract_ended_how AS contract_ended_how,
         d.deadline,
         EXISTS (SELECT 1 FROM public.job_lien_filings f WHERE f.job_id = d.id AND f.kind = 'retainage_53_057' AND f.voided_at IS NULL) AS noticed,
         EXISTS (
           SELECT 1 FROM public.job_lien_filings f
           WHERE f.job_id = d.id AND f.kind = 'notice_53_056' AND f.voided_at IS NULL
             AND COALESCE(f.fields->>'retainageIncluded', '') <> ''
         ) AS in_claim,
         d.open_balance,
         d.customer_id,
         d.gc_customer_id,
         d.property_kind,
         d.has_owner,
         d.lien_payment_bond AS payment_bond,
         i.id AS desk_item_id,
         i.status AS desk_status
  FROM jobs d
  LEFT JOIN LATERAL (
    SELECT x.id, x.status
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.id AND x.kind = 'retainage_53_057' AND x.voided_at IS NULL AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE d.deadline IS NULL
     OR (d.deadline <= public.app_today() + GREATEST(0, p_within_days) AND d.deadline >= public.app_today() - 7)
     OR i.id IS NOT NULL
  ORDER BY d.deadline NULLS LAST, d.id;
$$;
