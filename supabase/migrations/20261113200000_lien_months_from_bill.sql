SET lock_timeout = '3s';

-- The month comes from the bill (v2.7224). The owner, 2026-11-13: "if a clock session has no hours it should not be
-- from the job creation date but from the bill date".
--
-- A job with no approved clock hours and no last day of work set by hand was dated from the day it was made
-- (v2.3747, lien_fallback_month). Jobs brought in from the earlier system were made weeks after their work, so
-- every lien date and every paper on them counted from the month they were typed in.
--
-- One rule now, the client's lienStandInMonth (src/lib/jobs/lienBillMonths.ts): such a job takes its months from
-- its sent, unpaid bills (jobs_ledger_invoices.status = 'billed'). A bill's day is the earlier of the day it was
-- marked billed and the day it went to the customer, in the company calendar. Each bill gives a month; the latest
-- is the last month. A job with no dated unpaid bill keeps its creation month, so no job falls out of a reader.
-- A row whose month came from a bill carries month_source = 'bill'; the client words it as a stand-in, since a bill
-- is not a record of work, and holds no paper for it.
--
-- The order is unchanged above it: a day set by hand, then approved hours, exactly as
-- 20261113190000_lien_hand_day_counts.sql left them. The four readers below are that file's definitions with only
-- the creation branch split in two. Same arguments, same columns, so CREATE OR REPLACE keeps every grant.
-- No table changes. Clock sessions and bills are not touched.

-- ---------- The rule, one home ----------

CREATE OR REPLACE FUNCTION public.lien_bill_months(p_job_id uuid)
RETURNS TABLE (work_month text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT to_char((LEAST(i.billed_at, i.sent_to_customer_at) AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM')
  FROM public.jobs_ledger_invoices i
  WHERE i.job_id = p_job_id
    AND i.status = 'billed'
    AND LEAST(i.billed_at, i.sent_to_customer_at) IS NOT NULL
$$;

COMMENT ON FUNCTION public.lien_bill_months(uuid) IS
  'Lien months (v2.7224): the months a job''s sent, unpaid bills are dated in, as YYYY-MM in the company calendar (America/Chicago). A bill''s day is the earlier of billed_at and sent_to_customer_at. The four lien readers take these for a job with no approved clock hours and no last day of work set by hand (month_source = ''bill''); with none, the creation month stands (lien_fallback_month). Runs as the caller, so the bills'' own row rules apply to a direct call.';

GRANT EXECUTE ON FUNCTION public.lien_bill_months(uuid) TO authenticated, service_role;

-- ---------- § 53.056 notice months ----------

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
           public.lien_billed_open(j.id, j.status, j.revenue, j.payments_made) AS open_balance,
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
           -- The hand day's own month reads 'hand' also when it has approved hours: the day in it is the one set by hand.
           CASE WHEN to_char(cs.work_date::date, 'YYYY-MM') = to_char(max(jobs.lien_last_work_on), 'YYYY-MM') THEN 'hand' ELSE 'hours' END AS month_source
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
      -- The day set by hand counts (v2.7193): a month of approved hours after its month is off the clock.
      AND (jobs.lien_last_work_on IS NULL OR to_char(cs.work_date::date, 'YYYY-MM') <= to_char(jobs.lien_last_work_on, 'YYYY-MM'))
    GROUP BY 1, 2
    UNION ALL
    -- A job nobody clocked on (v2.7224): one month per sent, unpaid bill, from the bill's day.
    SELECT jobs.id,
           bm.work_month,
           0::numeric,
           'bill'::text
    FROM jobs
    CROSS JOIN LATERAL public.lien_bill_months(jobs.id) bm
    WHERE jobs.lien_last_work_on IS NULL
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
    -- No dated unpaid bill either: the creation month (v2.3747), so the job still lists.
    SELECT jobs.id,
           public.lien_fallback_month(jobs.created_at),
           0::numeric,
           'job_created'::text
    FROM jobs
    WHERE jobs.lien_last_work_on IS NULL
      AND public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.lien_bill_months(jobs.id))
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
    -- The last day of work set by hand (v2.4676): its month, when no approved session is in that month.
    -- Until v2.7193 a session in a later month kept this row out, and that later month ended the job's clock.
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
          AND to_char(cs.work_date::date, 'YYYY-MM') = to_char(jobs.lien_last_work_on, 'YYYY-MM')
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

-- ---------- § 53.052 affidavit windows ----------

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
           public.lien_billed_open(j.id, j.status, j.revenue, j.payments_made) AS open_balance,
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
      -- The day set by hand counts (v2.7193): a job that has one takes its month below, whatever hours come after it.
      AND jobs.lien_last_work_on IS NULL
    GROUP BY 1
    UNION ALL
    -- A job nobody clocked on (v2.7224): its last month is its latest sent, unpaid bill's.
    SELECT jobs.id,
           bm.last_month,
           'bill'::text
    FROM jobs
    CROSS JOIN LATERAL (SELECT max(x.work_month) AS last_month FROM public.lien_bill_months(jobs.id) x) bm
    WHERE jobs.lien_last_work_on IS NULL
      AND bm.last_month IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = jobs.id
          AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
      )
    UNION ALL
    -- No dated unpaid bill either: the creation month (v2.3747), so the job still lists.
    SELECT jobs.id,
           public.lien_fallback_month(jobs.created_at),
           'job_created'::text
    FROM jobs
    WHERE jobs.lien_last_work_on IS NULL
      AND public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.lien_bill_months(jobs.id))
      AND NOT EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = jobs.id
          AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
      )
    UNION ALL
    -- The last day of work set by hand (v2.4676): its month is the job's last month. Until v2.7193 the later of it and the sessions' last month won.
    SELECT jobs.id,
           to_char(jobs.lien_last_work_on, 'YYYY-MM'),
           'hand'::text
    FROM jobs
    WHERE jobs.lien_last_work_on IS NOT NULL
  ),
  -- One row per job: a job has one row above (its sessions' last month, its creation month, or its hand day's month).
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

-- ---------- Put a GC on notice ----------

CREATE OR REPLACE FUNCTION public.list_gc_unpaid_months(p_gc_customer_id uuid)
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
           j.lien_last_work_on,
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
           -- The hand day's own month reads 'hand' also when it has approved hours: the day in it is the one set by hand.
           CASE WHEN to_char(cs.work_date::date, 'YYYY-MM') = to_char(max(jobs.lien_last_work_on), 'YYYY-MM') THEN 'hand' ELSE 'hours' END AS month_source
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
      -- The day set by hand counts (v2.7193): a month of approved hours after its month is off the clock.
      AND (jobs.lien_last_work_on IS NULL OR to_char(cs.work_date::date, 'YYYY-MM') <= to_char(jobs.lien_last_work_on, 'YYYY-MM'))
    GROUP BY 1, 2
    UNION ALL
    -- A job nobody clocked on (v2.7224): one month per sent, unpaid bill, from the bill's day.
    SELECT jobs.id,
           bm.work_month,
           0::numeric,
           'bill'::text
    FROM jobs
    CROSS JOIN LATERAL public.lien_bill_months(jobs.id) bm
    WHERE jobs.lien_last_work_on IS NULL
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
    -- No dated unpaid bill either: the creation month (v2.3747), so the job still lists.
    SELECT jobs.id,
           public.lien_fallback_month(jobs.created_at),
           0::numeric,
           'job_created'::text
    FROM jobs
    WHERE jobs.lien_last_work_on IS NULL
      AND public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.lien_bill_months(jobs.id))
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
    -- The last day of work set by hand (v2.4676): its month, when no approved session is in that month.
    -- Until v2.7193 a session in a later month kept this row out, and that later month ended the job's clock.
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
          AND to_char(cs.work_date::date, 'YYYY-MM') = to_char(jobs.lien_last_work_on, 'YYYY-MM')
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

-- ---------- Owner of record to confirm ----------

CREATE OR REPLACE FUNCTION public.list_jobs_owner_to_confirm()
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
           j.lien_last_work_on,
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
      -- The day set by hand counts (v2.7193): a month of approved hours after its month is off the clock.
      AND (jobs.lien_last_work_on IS NULL OR to_char(cs.work_date::date, 'YYYY-MM') <= to_char(jobs.lien_last_work_on, 'YYYY-MM'))
    GROUP BY 1
    UNION ALL
    -- A job nobody clocked on (v2.7224): its first month is its earliest sent, unpaid bill's.
    SELECT jobs.id,
           bm.first_month,
           'bill'::text
    FROM jobs
    CROSS JOIN LATERAL (SELECT min(x.work_month) AS first_month FROM public.lien_bill_months(jobs.id) x) bm
    WHERE jobs.lien_last_work_on IS NULL
      AND bm.first_month IS NOT NULL
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
    -- No dated unpaid bill either: the creation month (v2.3747), so the job still lists.
    SELECT jobs.id,
           public.lien_fallback_month(jobs.created_at),
           'job_created'::text
    FROM jobs
    WHERE jobs.lien_last_work_on IS NULL
      AND public.lien_fallback_month(jobs.created_at) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.lien_bill_months(jobs.id))
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
    -- The last day of work set by hand (v2.4676): the first month of a job with no approved session on its clock
    -- (none at all, or since v2.7193 none up to the hand day's month) is that day's month.
    SELECT jobs.id,
           to_char(jobs.lien_last_work_on, 'YYYY-MM'),
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
          AND to_char(cs.work_date::date, 'YYYY-MM') <= to_char(jobs.lien_last_work_on, 'YYYY-MM')
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
