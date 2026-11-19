SET lock_timeout = '3s';

-- A lien day that passed with nothing filed stays listed until someone answers it.
--
-- list_lien_affidavit_windows stops listing a job seven days after its last day to file. So a lien day nobody
-- answered left the Lien desk by itself a week later, and the Board's closed bin, *Lien day passed · not filed*, emptied
-- with no one having said what became of the money. The notices' reader has kept an unrecorded closed month since
-- v2.3680; the affidavits' reader had no such rule.
--
-- Three functions, no table changes:
--
-- 1 · lien_affidavit_days(): the body of list_lien_affidavit_windows as 20261113200000_lien_months_from_bill.sql left
--     it, with its two date filters and its ORDER BY taken off and nothing else changed. One row per billed, unpaid,
--     collectible job that has a last day to file, whatever that day. The month rules and the role gate live here
--     once. Nobody calls it directly: EXECUTE is the owner's alone, and the two readers below run as the owner.
-- 2 · list_lien_affidavit_windows(p_within_days): the same arguments, the same sixteen columns and the same rows in
--     the same order as before, now as those two date filters over (1). Every reader of it keeps its seven days.
-- 3 · list_lien_closed_days(): the rows of (1) whose day is more than seven days past, with no filed affidavit, on a
--     job still on the lien path (jobs_ledger.lien_path_answer IS NULL). The same sixteen columns and the same gate.
--     (2) and (3) never list the same job: (2) keeps a day down to seven days past, (3) starts on the eighth.
--
-- A job leaves (3) the way it leaves the desk: a filing recorded, the last day of work corrected so its day moves,
-- taken off the lien path, marked Uncollectible, or paid.
--
-- Additive and idempotent. No CREATE TABLE, so no fence calls. Nothing reads (3) until the client that ships with it.

-- ---------- 1 · every job's last day to file, one home ----------

CREATE OR REPLACE FUNCTION public.lien_affidavit_days()
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
  WHERE d.deadline IS NOT NULL;
$$;

COMMENT ON FUNCTION public.lien_affidavit_days() IS
  'Lien desk (v2.7817): one row per billed, unpaid, collectible job that has a last day to file a lien affidavit, whatever that day, with the month rules of list_lien_affidavit_windows as 20261113200000 left them (a day set by hand, then approved hours, then the latest sent unpaid bill, then the creation month). The one home of those rules and of the role gate (dev, assistant, master_technician, service_role). Not for direct calls: EXECUTE is the owner''s alone. list_lien_affidavit_windows and list_lien_closed_days read it as the owner and filter by day.';

-- Supabase's default privileges hand a new function to anon, authenticated and service_role; this one is the readers' alone.
REVOKE ALL ON FUNCTION public.lien_affidavit_days() FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2 · the windows, as before ----------

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
  SELECT d.job_id, d.last_month, d.deadline, d.is_sub, d.noticed, d.filed, d.open_balance, d.customer_id, d.gc_customer_id,
         d.property_kind, d.has_owner, d.has_legal, d.homestead, d.desk_item_id, d.desk_status, d.month_source
  FROM public.lien_affidavit_days() d
  WHERE d.deadline <= public.app_today() + GREATEST(0, p_within_days)
    AND d.deadline >= public.app_today() - 7
  ORDER BY d.deadline, d.job_id;
$$;

-- CREATE OR REPLACE keeps the grants prod has; restated so the file stands alone.
REVOKE EXECUTE ON FUNCTION public.list_lien_affidavit_windows(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_affidavit_windows(integer) TO authenticated, service_role;

-- ---------- 3 · the lien days that passed with nothing filed and no answer ----------

CREATE OR REPLACE FUNCTION public.list_lien_closed_days()
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
  SELECT d.job_id, d.last_month, d.deadline, d.is_sub, d.noticed, d.filed, d.open_balance, d.customer_id, d.gc_customer_id,
         d.property_kind, d.has_owner, d.has_legal, d.homestead, d.desk_item_id, d.desk_status, d.month_source
  FROM public.lien_affidavit_days() d
  JOIN public.jobs_ledger j ON j.id = d.job_id
  WHERE d.deadline < public.app_today() - 7
    AND NOT d.filed
    AND j.lien_path_answer IS NULL
  ORDER BY d.deadline, d.job_id;
$$;

COMMENT ON FUNCTION public.list_lien_closed_days() IS
  'Lien desk (v2.7817): the jobs whose last day to file a lien affidavit is more than seven days past, with no filed affidavit, still on the lien path (jobs_ledger.lien_path_answer IS NULL). The columns and the role gate of list_lien_affidavit_windows, which stops listing a job seven days after its day; the two never list the same job. A job leaves when a filing is recorded, its last day of work is corrected, it is taken off the lien path, it is marked Uncollectible or it is paid. For dev, assistant, master_technician and service_role; anyone else gets no rows.';

REVOKE ALL ON FUNCTION public.list_lien_closed_days() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_closed_days() TO authenticated, service_role;
