SET lock_timeout = '3s';

-- Lien desk, affidavits (v2.3412): the § 53.052 filing window per job — the
-- 15th of the 4th month after the LAST month worked (3rd residential) — for
-- every unpaid job with approved sessions, with what the affidavit's gate
-- needs (owner of record, county + legal description, a recorded notice on
-- sub jobs, not a homestead) and the live desk item of kind 'affidavit'.

CREATE OR REPLACE FUNCTION public.lien_filing_deadline(p_month text, p_property_kind text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d date;
BEGIN
  IF p_month !~ '^\d{4}-\d{2}$' THEN RETURN NULL; END IF;
  d := (to_date(p_month || '-15', 'YYYY-MM-DD')
        + make_interval(months => CASE WHEN p_property_kind = 'residential' THEN 3 ELSE 4 END))::date;
  IF extract(dow FROM d) = 6 THEN d := d + 2;
  ELSIF extract(dow FROM d) = 0 THEN d := d + 1;
  END IF;
  RETURN d;
END;
$$;

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
  last_months AS (
    SELECT cs.job_ledger_id AS job_id, max(to_char(cs.work_date::date, 'YYYY-MM')) AS last_month
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    GROUP BY 1
  ),
  dated AS (
    SELECT jobs.*, lm.last_month,
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
         i.status AS desk_status
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

COMMENT ON FUNCTION public.list_lien_affidavit_windows(integer) IS
  'Lien desk affidavits (v2.3412): every unpaid billed job with approved sessions whose § 53.052 affidavit window (4th month after the last month worked; 3rd residential) is within p_within_days ahead or a week behind, with the gate facts (owner of record, county + legal description, a recorded notice, homestead), whether an affidavit is already filed, and the live desk item. Office roles only; empty otherwise.';

REVOKE EXECUTE ON FUNCTION public.list_lien_affidavit_windows(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_affidavit_windows(integer) TO authenticated;

-- ---------- the notice RPC, widened (v2.3412) ----------
-- The first live pass showed two gaps: a job still in Working status with an
-- unpaid billed invoice (J878) was left out, and only the months inside the
-- 30-day window came back, so a notice for June could not name July and
-- August. Now: a job counts when its status is billed OR it has a billed
-- invoice, and once any of its months is inside the window every unnoticed
-- month with an open window rides along (the earliest sets the deadline).
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
      AND (j.status = 'billed' OR EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = j.id AND i.status = 'billed'))
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
         i.months AS desk_months
  FROM dated d
  JOIN (
    SELECT DISTINCT x.job_id FROM dated x
    WHERE x.deadline IS NOT NULL
      AND x.deadline <= public.app_today() + GREATEST(0, p_within_days)
      AND x.deadline >= public.app_today() - 7
  ) w ON w.job_id = d.job_id
  LEFT JOIN LATERAL (
    SELECT x.id, x.status, x.months
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.job_id AND x.kind = 'notice_53_056' AND x.voided_at IS NULL
      AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE d.deadline IS NOT NULL
    AND d.deadline >= public.app_today() - 7
  ORDER BY d.deadline, d.job_id, d.work_month;
$$;

