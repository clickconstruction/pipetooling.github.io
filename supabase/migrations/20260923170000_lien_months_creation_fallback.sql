-- v2.3747 — Lien months: a job with no approved clock hours falls back to the
-- month it was created (punch list #32).
--
-- Every lien reader built a job's months from approved clock sessions and
-- dropped the job when there were none — on RMC- Dudley Mason fourteen billed
-- jobs (about $45k, the largest $17,600) fell out of the "Put a GC on notice"
-- run for that reason while the Pipeline showed them open. The owner's ruling
-- (2026-09-22): a bug; those jobs stay in the list, dated from the day the job
-- was created.
--
-- The rule: a job with approved sessions keeps its months from the sessions,
-- exactly as before. A job with none gets ONE month — the month of
-- jobs_ledger.created_at in the company calendar (America/Chicago, the same
-- zone as app_today()) — with approved_hours 0 and month_source = 'job_created'
-- (session months carry 'hours'). The fallback month goes through the same
-- deadline as any other, so an old job's creation month comes back with its
-- window closed and is named as such — nothing is hidden. Never both: a job
-- with sessions has no fallback row.
--
-- month_source is a new result column on all four readers, and CREATE OR
-- REPLACE cannot change a function's result columns, so each is DROP + CREATE
-- inside this one transaction. The client already tolerates the column's
-- absence (an absent month_source reads as 'hours'). No new table, so the
-- read-only sweep calls are not re-run.
SET lock_timeout = '3s';

-- ---------- 0 · the rule, one home ----------

CREATE OR REPLACE FUNCTION public.lien_fallback_month(p_created_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
           WHEN p_created_at IS NULL THEN NULL
           ELSE to_char((p_created_at AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM')
         END
$$;

COMMENT ON FUNCTION public.lien_fallback_month(timestamptz) IS
  'Lien months (v2.3747): the month a job with no approved clock hours is dated from — its creation day in the company calendar (America/Chicago), as YYYY-MM. NULL when the job has no created_at.';

GRANT EXECUTE ON FUNCTION public.lien_fallback_month(timestamptz) TO authenticated, service_role;

-- ---------- 1 · Put a GC on notice: list_gc_unpaid_months ----------

DROP FUNCTION IF EXISTS public.list_gc_unpaid_months(uuid);

CREATE FUNCTION public.list_gc_unpaid_months(p_gc_customer_id uuid)
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
  is_billed boolean,
  job_status text,
  last_work_month text,
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
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician') AS ok
  ),
  jobs AS (
    SELECT j.id,
           j.customer_id,
           j.gc_customer_id,
           j.created_at,
           j.status AS job_status,
           GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0))::numeric AS open_balance,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner,
           (j.status = 'billed' OR EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = j.id AND i.status = 'billed')) AS is_billed
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND p_gc_customer_id IS NOT NULL
      AND j.gc_customer_id = p_gc_customer_id
      AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
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
  last_month AS (
    SELECT m.job_id, max(m.work_month) AS last_work_month FROM months m GROUP BY 1
  ),
  dated AS (
    SELECT m.job_id, m.work_month, m.approved_hours, m.month_source,
           public.lien_notice_deadline(m.work_month, jobs.property_kind) AS deadline,
           jobs.open_balance, jobs.customer_id, jobs.gc_customer_id, jobs.property_kind, jobs.has_owner,
           jobs.is_billed, jobs.job_status
    FROM months m
    JOIN jobs ON jobs.id = m.job_id
  )
  SELECT d.job_id,
         d.work_month,
         round(d.approved_hours, 1) AS approved_hours,
         d.deadline,
         EXISTS (
           SELECT 1 FROM public.job_lien_filings f
           WHERE f.job_id = d.job_id AND f.kind = 'notice_53_056' AND f.voided_at IS NULL
             AND d.work_month = ANY (f.months_covered)
         ) AS noticed,
         d.open_balance,
         d.customer_id,
         d.gc_customer_id,
         d.property_kind,
         d.has_owner,
         i.id AS desk_item_id,
         i.status AS desk_status,
         i.months AS desk_months,
         d.is_billed,
         d.job_status,
         lm.last_work_month,
         d.month_source
  FROM dated d
  JOIN last_month lm ON lm.job_id = d.job_id
  LEFT JOIN LATERAL (
    SELECT x.id, x.status, x.months
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.job_id AND x.kind = 'notice_53_056' AND x.voided_at IS NULL
      AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  ORDER BY d.job_id, d.work_month
$$;

REVOKE EXECUTE ON FUNCTION public.list_gc_unpaid_months(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_gc_unpaid_months(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_gc_unpaid_months(uuid) IS
  'Put a GC on notice (v2.3470; v2.3747): every job with unpaid work under the GC (billed or not), every month with approved hours and its § 53.056 date — or, for a job with no approved hours, its creation month (month_source = job_created, approved_hours 0) — noticed or not, no lead window. Office-gated like list_lien_notice_months.';

-- ---------- 2 · the Lien desk queue: list_lien_notice_months ----------

DROP FUNCTION IF EXISTS public.list_lien_notice_months(integer);

CREATE FUNCTION public.list_lien_notice_months(p_within_days integer DEFAULT 30)
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
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician') AS ok
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
GRANT EXECUTE ON FUNCTION public.list_lien_notice_months(integer) TO authenticated;

COMMENT ON FUNCTION public.list_lien_notice_months(integer) IS
  'Lien desk (v2.3405, v2.3412, v2.3680, v2.3683, v2.3747): every (sub job, work month) with money open — approved work months, or the creation month of a job with no approved hours (month_source = job_created, approved_hours 0); a job counts when billed or with a billed invoice; once any month is inside p_within_days ahead (or a week behind), or a closed month is unnoticed and unrecorded since 2026-09-14, every month with an open window rides along, plus those silent closed months — with whether a live notice names the month, whether an owner of record with a mailing address is on file, and the live desk item. Office roles only; empty otherwise.';

-- ---------- 3 · the affidavit windows: list_lien_affidavit_windows ----------

DROP FUNCTION IF EXISTS public.list_lien_affidavit_windows(integer);

CREATE FUNCTION public.list_lien_affidavit_windows(p_within_days integer DEFAULT 30)
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
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician') AS ok
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
GRANT EXECUTE ON FUNCTION public.list_lien_affidavit_windows(integer) TO authenticated;

COMMENT ON FUNCTION public.list_lien_affidavit_windows(integer) IS
  'Lien desk affidavits (v2.3412; v2.3747): every unpaid billed job whose § 53.052 affidavit window (4th month after the last month worked, 3rd residential — or after the creation month of a job with no approved hours, month_source = job_created) is within p_within_days ahead or a week behind, with the gate facts (owner of record, county + legal description, a recorded notice, homestead), whether an affidavit is already filed, and the live desk item. Office roles only; empty otherwise.';

-- ---------- 4 · the owner-of-record sitting and the nightly run: list_jobs_owner_to_confirm ----------

DROP FUNCTION IF EXISTS public.list_jobs_owner_to_confirm();

CREATE FUNCTION public.list_jobs_owner_to_confirm()
RETURNS TABLE (
  job_id uuid,
  hcp_number text,
  click_number text,
  job_address text,
  status text,
  customer_id uuid,
  customer_name text,
  gc_customer_id uuid,
  gc_name text,
  customer_address_id uuid,
  has_owner boolean,
  owner_confirmed boolean,
  property_kind text,
  first_work_month text,
  first_deadline date,
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
        OR (SELECT auth.role()) = 'service_role' AS ok
  ),
  builders AS (
    SELECT DISTINCT b.gc_customer_id AS customer_id
    FROM public.jobs_ledger b
    WHERE b.gc_customer_id IS NOT NULL
  ),
  jobs AS (
    SELECT j.id,
           j.hcp_number,
           j.click_number,
           j.job_address,
           j.status,
           j.customer_id,
           j.gc_customer_id,
           j.customer_address_id,
           j.created_at,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner,
           (ca.owner_confirmed_at IS NOT NULL) AS owner_confirmed
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
      AND (
        j.gc_customer_id IS NOT NULL
        OR (j.customer_id IS NOT NULL AND j.customer_id IN (SELECT customer_id FROM builders))
      )
  ),
  -- The earliest approved work month (as before), or the creation month of a job with none (v2.3747).
  months AS (
    SELECT cs.job_ledger_id AS job_id,
           MIN(to_char(cs.work_date::date, 'YYYY-MM')) AS first_work_month,
           'hours'::text AS month_source
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
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
          AND cs.approved_at IS NOT NULL
          AND cs.rejected_at IS NULL
          AND cs.revoked_at IS NULL
          AND cs.clocked_out_at IS NOT NULL
          AND cs.clocked_out_at > cs.clocked_in_at
      )
  )
  SELECT jobs.id AS job_id,
         COALESCE(jobs.hcp_number, '') AS hcp_number,
         COALESCE(jobs.click_number, '') AS click_number,
         COALESCE(jobs.job_address, '') AS job_address,
         jobs.status,
         jobs.customer_id,
         c.name AS customer_name,
         jobs.gc_customer_id,
         g.name AS gc_name,
         jobs.customer_address_id,
         jobs.has_owner,
         jobs.owner_confirmed,
         jobs.property_kind,
         m.first_work_month,
         public.lien_notice_deadline(m.first_work_month, jobs.property_kind) AS first_deadline,
         m.month_source
  FROM jobs
  JOIN months m ON m.job_id = jobs.id
  LEFT JOIN public.customers c ON c.id = jobs.customer_id
  LEFT JOIN public.customers g ON g.id = jobs.gc_customer_id
  WHERE NOT (jobs.has_owner AND jobs.owner_confirmed)
  ORDER BY public.lien_notice_deadline(m.first_work_month, jobs.property_kind) NULLS LAST, jobs.id;
$$;

REVOKE EXECUTE ON FUNCTION public.list_jobs_owner_to_confirm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_jobs_owner_to_confirm() TO authenticated, service_role;

COMMENT ON FUNCTION public.list_jobs_owner_to_confirm() IS
  'Owner of record (v2.3447; service role since v2.3450 for owner-confirm-nightly; v2.3747): every GC job (GC set, or a builder in the customer row with no GC) in waiting/working/ready_to_bill/billed whose property record has no confirmed owner of record — has_owner is the Lien desk''s expression; first_deadline the § 53.056 date for the earliest approved work month, or for the creation month of a job with no approved hours (month_source = job_created). Office roles and the service role; empty otherwise.';
