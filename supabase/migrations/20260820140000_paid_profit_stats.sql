SET lock_timeout = '3s';

-- get_paid_profit_stats (v2.1879) — the Paid in Full profit chart's data:
-- per PAID job, the six-stream lifetime cost (identical stream definitions to
-- get_billed_aging_costs / the paid-email scoreboard) PLUS total approved
-- clock-session hours. Returns { "<jobs_ledger.id>": { "cost": n, "hours": n } }.
-- Wage-derived ⇒ dev/controller only (the Weekly Money Movement gate).

CREATE OR REPLACE FUNCTION public.get_paid_profit_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH gate AS (
  SELECT public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'controller')
      AS ok
),
targets AS (
  SELECT j.id, j.hcp_number
  FROM public.jobs_ledger j
  WHERE j.status = 'paid'
),
drive_settings AS (
  SELECT
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_mileage_cost'), 0.7) AS mileage_cost,
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_time_per_mile'), 0.02) AS time_per_mile
),
team_labor_days AS (
  SELECT
    cs.job_ledger_id AS job_id,
    u.id AS user_id,
    cs.work_date,
    SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours,
    COALESCE(MAX(ppc.hourly_wage), 0) AS wage
  FROM public.clock_sessions cs
  JOIN targets t ON t.id = cs.job_ledger_id
  JOIN public.users u ON u.id = cs.user_id
  LEFT JOIN public.people per
    ON per.account_user_id = u.id AND per.archived_at IS NULL
  LEFT JOIN public.people_pay_config ppc
    ON (per.id IS NOT NULL AND ppc.person_id = per.id)
    OR (per.id IS NULL AND lower(trim(ppc.person_name)) = lower(trim(u.name)))
  WHERE cs.approved_at IS NOT NULL
    AND cs.revoked_at IS NULL
    AND cs.clocked_out_at IS NOT NULL
  GROUP BY cs.job_ledger_id, u.id, cs.work_date
),
team_labor AS (
  SELECT job_id,
         SUM(round((hours * COALESCE(wage, 0))::numeric, 2)) AS cost,
         SUM(hours) AS hours
  FROM team_labor_days
  GROUP BY job_id
),
sub_labor_books AS (
  SELECT plj.id,
         t.id AS job_id,
         COALESCE(plj.labor_rate, 0) AS job_rate,
         COALESCE(plj.distance_miles, 0) AS miles
  FROM public.people_labor_jobs plj
  JOIN targets t ON trim(COALESCE(t.hcp_number, '')) <> ''
    AND lower(trim(COALESCE(plj.job_number, ''))) = lower(trim(t.hcp_number))
),
sub_labor_lines AS (
  SELECT b.id AS book_id,
         COALESCE(SUM(
           COALESCE(
             i.direct_labor_amount,
             (CASE WHEN i.is_fixed THEN COALESCE(i.hrs_per_unit, 0)
                   ELSE COALESCE(i.count, 0) * COALESCE(i.hrs_per_unit, 0) END)
             * COALESCE(i.labor_rate, b.job_rate)
           )
         ), 0) AS line_total
  FROM sub_labor_books b
  LEFT JOIN public.people_labor_job_items i ON i.job_id = b.id
  GROUP BY b.id
),
sub_labor AS (
  SELECT b.job_id,
         SUM(
           l.line_total
           + CASE
               WHEN b.miles > 0 AND b.job_rate > 0
                 THEN b.miles * ds.mileage_cost + b.miles * ds.time_per_mile * b.job_rate
               WHEN b.miles > 0 THEN b.miles * ds.mileage_cost
               ELSE 0
             END
         ) AS cost
  FROM sub_labor_books b
  JOIN sub_labor_lines l ON l.book_id = b.id
  CROSS JOIN drive_settings ds
  GROUP BY b.job_id
),
parts AS (
  SELECT a.job_id, SUM(ABS(a.amount)) AS cost
  FROM public.mercury_transaction_job_allocations a
  JOIN targets t ON t.id = a.job_id
  GROUP BY a.job_id
),
supply AS (
  SELECT al.job_id, SUM(COALESCE(shi.amount, 0) * COALESCE(al.pct, 0) / 100.0) AS cost
  FROM public.supply_house_invoice_job_allocations al
  JOIN targets t ON t.id = al.job_id
  JOIN public.supply_house_invoices shi ON shi.id = al.invoice_id
  GROUP BY al.job_id
),
tally AS (
  SELECT jtp.job_id,
         SUM(
           CASE WHEN jtp.part_id IS NULL
                THEN COALESCE(jtp.fixture_cost, 0) * COALESCE(jtp.quantity, 0)
                ELSE COALESCE(poi.price_at_time, 0) * COALESCE(jtp.quantity, 0) END
         ) AS cost
  FROM public.jobs_tally_parts jtp
  JOIN targets t ON t.id = jtp.job_id
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = jtp.purchase_order_id
    AND poi.part_id = jtp.part_id
  GROUP BY jtp.job_id
),
other AS (
  SELECT m.job_id, SUM(COALESCE(m.amount, 0)) AS cost
  FROM public.jobs_ledger_materials m
  JOIN targets t ON t.id = m.job_id
  GROUP BY m.job_id
),
combined AS (
  SELECT t.id AS job_id,
         round((
           COALESCE(tl.cost, 0) + COALESCE(sl.cost, 0) + COALESCE(p.cost, 0)
           + COALESCE(s.cost, 0) + COALESCE(ty.cost, 0) + COALESCE(o.cost, 0)
         )::numeric, 2) AS cost,
         round(COALESCE(tl.hours, 0)::numeric, 2) AS hours
  FROM targets t
  LEFT JOIN team_labor tl ON tl.job_id = t.id
  LEFT JOIN sub_labor sl ON sl.job_id = t.id
  LEFT JOIN parts p ON p.job_id = t.id
  LEFT JOIN supply s ON s.job_id = t.id
  LEFT JOIN tally ty ON ty.job_id = t.id
  LEFT JOIN other o ON o.job_id = t.id
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_object_agg(job_id::text, jsonb_build_object('cost', cost, 'hours', hours)) FROM combined),
    '{}'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.get_paid_profit_stats() IS
  'Per-paid-job lifetime cost (the paid-email scoreboard''s six streams) + approved clock-session hours — the Paid in Full profit chart (v2.1879). Wage-derived ⇒ returns NULL for callers who are not dev/controller.';

REVOKE EXECUTE ON FUNCTION public.get_paid_profit_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_paid_profit_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_paid_profit_stats() TO authenticated;
