-- v2.3470 — Put a GC on notice, PR 1: every job with unpaid work under one GC,
-- every month with approved hours, no 30-day window.
--
-- `list_lien_notice_months()` (the Lien desk's queue) keeps a job only when it
-- is billed and only while a month sits inside the lead window. A GC in
-- trouble needs the whole picture: billed or still Working, every unnoticed
-- month (a closed window is returned too — the modal names it as information),
-- plus whether the job is billed at all (an unbilled job claims its contract
-- balance and says so). Same columns as the desk's RPC so the client folds
-- both with one kernel, plus is_billed · job_status · last_work_month.
SET lock_timeout = '3s';

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
  last_work_month text
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
  last_month AS (
    SELECT m.job_id, max(m.work_month) AS last_work_month FROM months m GROUP BY 1
  ),
  dated AS (
    SELECT m.job_id, m.work_month, m.approved_hours,
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
         lm.last_work_month
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
  'Put a GC on notice (v2.3470): every job with unpaid work under the GC (billed or not), every month with approved hours and its § 53.056 date, noticed or not, no lead window. Office-gated like list_lien_notice_months.';
