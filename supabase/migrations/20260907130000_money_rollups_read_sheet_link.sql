SET lock_timeout = '3s';

-- v2.3059: the money rollups read the sheet → job link (people_labor_jobs.job_ledger_id,
-- v2.3055) instead of matching job_number to hcp_number as text. Five SECURITY DEFINER
-- readers and one writer; each body is the latest definition with only the join changed:
--   get_paid_job_email_payload   (20260803000000)  JOIN job ON plj.job_ledger_id = job.id
--   get_billed_aging_costs        (20260820120000)  JOIN targets t ON plj.job_ledger_id = t.id
--   get_paid_profit_stats         (20260820140000)  same
--   partner_job_cost_buckets      (20260820180000)  JOIN target t ON plj.job_ledger_id = t.id
--   get_weekly_money_movement_payload (20260807060000) subs CTE: lj.job_ledger_id (was a
--       case-sensitive btrim() correlated subquery, oldest job first — the one site that
--       disagreed with every other)
--   settle_step_commitment        (20260905050035)  step-anchored sheets on a one-job project
--       now carry job_ledger_id (and the effective number, so a click-only job links too)
-- Every sheet with a resolvable number was back-filled in v2.3055 (70/70 on 2026-09-07), so
-- no rollup loses a sheet here; sheets whose number never matched a job were never counted.
-- Idempotent (CREATE OR REPLACE only). No table changes.

-- 1) paid-job email cost breakdown -----------------------------------------
CREATE OR REPLACE FUNCTION public.get_paid_job_email_payload(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH job AS (
  SELECT
    j.id,
    j.hcp_number,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
    j.job_name,
    j.job_address,
    j.customer_name,
    j.status,
    st.name AS service_type_name,
    COALESCE(j.revenue, 0) AS revenue,
    j.last_work_date
  FROM public.jobs_ledger j
  LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = p_job_id
),
-- Team labor per person per Chicago work_date (approved, non-revoked, closed
-- sessions; hours × people_pay_config wage joined person-first with the exact
-- old name-join fallback — docs/PERSON_IDENTITY_PLAN.md Phase C-2).
team_labor_days AS (
  SELECT
    COALESCE(NULLIF(trim(u.name), ''), 'Unknown') AS person_name,
    cs.work_date,
    SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours,
    COALESCE(MAX(ppc.hourly_wage), 0) AS wage
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  LEFT JOIN public.people per
    ON per.account_user_id = u.id AND per.archived_at IS NULL
  LEFT JOIN public.people_pay_config ppc
    ON (per.id IS NOT NULL AND ppc.person_id = per.id)
    OR (per.id IS NULL AND lower(trim(ppc.person_name)) = lower(trim(u.name)))
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.revoked_at IS NULL
    AND cs.clocked_out_at IS NOT NULL
  GROUP BY u.id, u.name, cs.work_date
),
team_labor AS (
  SELECT person_name, SUM(hours) AS hours, MAX(wage) AS wage
  FROM team_labor_days
  GROUP BY person_name
),
team_labor_rows AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', person_name,
           'hours', round(hours::numeric, 2),
           'wage', wage,
           'cost', round((hours * COALESCE(wage, 0))::numeric, 2)
         ) ORDER BY hours DESC), '[]'::jsonb) AS people,
         COALESCE(SUM(round((hours * COALESCE(wage, 0))::numeric, 2)), 0) AS total
  FROM team_labor
),
drive_settings AS (
  SELECT
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_mileage_cost'), 0.7) AS mileage_cost,
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_time_per_mile'), 0.02) AS time_per_mile
),
-- Sub labor books matched to the job's HCP # (line items + drive cost —
-- mirrors src/lib/jobs/subLaborCost.ts). Per-book rows feed both the total
-- and the charge_events stream (date = job_date ?? created_at).
sub_labor_books AS (
  SELECT plj.id,
         COALESCE(plj.labor_rate, 0) AS job_rate,
         COALESCE(plj.distance_miles, 0) AS miles,
         COALESCE(NULLIF(trim(plj.assigned_to_name), ''), 'Sub') AS assigned_to_name,
         COALESCE(plj.job_date::text, to_char(plj.created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD')) AS date_key
  FROM public.people_labor_jobs plj
  JOIN job ON plj.job_ledger_id = job.id
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
sub_labor_costed AS (
  SELECT b.id, b.assigned_to_name, b.date_key,
         l.line_total
         + CASE
             WHEN b.miles > 0 AND b.job_rate > 0
               THEN b.miles * ds.mileage_cost + b.miles * ds.time_per_mile * b.job_rate
             WHEN b.miles > 0 THEN b.miles * ds.mileage_cost
             ELSE 0
           END AS book_cost
  FROM sub_labor_books b
  JOIN sub_labor_lines l ON l.book_id = b.id
  CROSS JOIN drive_settings ds
),
sub_labor_total AS (
  SELECT COALESCE(SUM(book_cost), 0) AS total FROM sub_labor_costed
),
-- Mercury card-charge allocations (parity with the Job Summary cardCharges
-- figure; costs.parts_total keeps this exact meaning).
mercury_alloc AS (
  SELECT ABS(a.amount) AS amount,
         CASE WHEN mt.posted_at IS NOT NULL
              THEN to_char(mt.posted_at::timestamptz AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD')
              ELSE NULL END AS date_key,
         COALESCE(NULLIF(trim(mt.counterparty_name), ''), 'Card charge') AS label
  FROM public.mercury_transaction_job_allocations a
  LEFT JOIN public.mercury_transactions mt ON mt.id = a.mercury_transaction_id
  WHERE a.job_id = p_job_id
),
parts AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM mercury_alloc
),
-- Supply-house invoice allocations (invoice amount × pct / 100 — parity with
-- fetchJobMaterialsCostSnapshot's supplyLines).
supply_alloc AS (
  SELECT (COALESCE(shi.amount, 0) * COALESCE(al.pct, 0) / 100.0) AS amount,
         CASE WHEN shi.invoice_date IS NOT NULL THEN shi.invoice_date::text ELSE NULL END AS date_key,
         (COALESCE(NULLIF(trim(sh.name), ''), 'Supply house') || ' — invoice ' || COALESCE(NULLIF(trim(shi.invoice_number), ''), '—')) AS label
  FROM public.supply_house_invoice_job_allocations al
  JOIN public.supply_house_invoices shi ON shi.id = al.invoice_id
  LEFT JOIN public.supply_houses sh ON sh.id = shi.supply_house_id
  WHERE al.job_id = p_job_id
),
supply_total AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM supply_alloc
),
-- Tally parts (price_at_time × qty for priced parts, fixture_cost × qty for
-- fixture-only rows — parity with list_tally_parts_with_po / tallyPartEventAmount).
tally_rows AS (
  SELECT
    CASE WHEN jtp.part_id IS NULL
         THEN COALESCE(jtp.fixture_cost, 0) * COALESCE(jtp.quantity, 0)
         ELSE COALESCE(poi.price_at_time, 0) * COALESCE(jtp.quantity, 0) END AS amount,
    CASE WHEN jtp.created_at IS NOT NULL
         THEN to_char(jtp.created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD')
         ELSE NULL END AS date_key,
    COALESCE(NULLIF(trim(mp.name), ''), NULLIF(trim(jtp.fixture_name), ''), 'Tally part') AS label
  FROM public.jobs_tally_parts jtp
  LEFT JOIN public.material_parts mp ON mp.id = jtp.part_id
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = jtp.purchase_order_id
    AND poi.part_id = jtp.part_id
  WHERE jtp.job_id = p_job_id
),
tally_total AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM tally_rows
),
-- Manual "Other job charges" (jobs_ledger_materials).
other_rows AS (
  SELECT COALESCE(m.amount, 0) AS amount,
         CASE WHEN m.created_at IS NOT NULL
              THEN to_char(m.created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD')
              ELSE NULL END AS date_key,
         COALESCE(NULLIF(trim(m.description), ''), 'Other job charge') AS label
  FROM public.jobs_ledger_materials m
  WHERE m.job_id = p_job_id
),
other_total AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM other_rows
),
-- The six streams flattened into dated charge events (labels without $ —
-- mirrors buildJobChargeEvents in lib/jobChargesTimeline.ts).
charge_events AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'source', e.source,
           'date_key', e.date_key,
           'amount', round(e.amount::numeric, 2),
           'label', e.label
         ) ORDER BY e.date_key ASC NULLS LAST, e.source), '[]'::jsonb) AS rows
  FROM (
    SELECT 'team_labor' AS source,
           d.work_date::text AS date_key,
           (d.hours * COALESCE(d.wage, 0)) AS amount,
           (d.person_name || ' — team labor (' || round(d.hours::numeric, 2)::text || 'h)') AS label
    FROM team_labor_days d
    UNION ALL
    SELECT 'sub_labor', s.date_key, s.book_cost, (s.assigned_to_name || ' — sub labor')
    FROM sub_labor_costed s
    UNION ALL
    SELECT 'mercury_card', m.date_key, m.amount, m.label FROM mercury_alloc m
    UNION ALL
    SELECT 'supply_house', sa.date_key, sa.amount, sa.label FROM supply_alloc sa
    UNION ALL
    SELECT 'tally_part', t.date_key, t.amount, t.label FROM tally_rows t
    UNION ALL
    SELECT 'billed_material', o.date_key, o.amount, o.label FROM other_rows o
  ) e
  WHERE e.amount <> 0
),
line_items AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', f.name,
           'count', GREATEST(COALESCE(f.count, 1), 1),
           'unit_price', COALESCE(f.line_unit_price, 0),
           'amount', round((GREATEST(COALESCE(f.count, 1), 1) * COALESCE(f.line_unit_price, 0))::numeric, 2),
           'description', NULLIF(trim(COALESCE(f.line_description, '')), ''),
           'invoice_status', inv.status
         ) ORDER BY f.sequence_order, f.created_at), '[]'::jsonb) AS rows
  FROM public.jobs_ledger_fixtures f
  LEFT JOIN public.jobs_ledger_invoices inv ON inv.id = f.invoice_id
  WHERE f.job_id = p_job_id
    AND trim(COALESCE(f.name, '')) <> ''
),
-- Payload v5 (v2.1310): the Edit Job "Invoices" table, mirrored — drafts
-- (ready_to_bill) first then billed/paid, per-invoice paid sums, sent date +
-- the "(+N)" created→sent calendar-day offset, channel, memo/note detail,
-- bill-to override label, hazmat-rider flag.
invoice_rows AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'status', inv.status,
           'amount', COALESCE(inv.amount, 0),
           'paid', COALESCE(pay.paid, 0),
           'sent_at', CASE WHEN inv.sent_to_customer_at IS NOT NULL
                           THEN to_char(inv.sent_to_customer_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD')
                           ELSE NULL END,
           'sent_day_offset', CASE WHEN inv.sent_to_customer_at IS NOT NULL AND inv.created_at IS NOT NULL
                                   THEN (
                                     (inv.sent_to_customer_at AT TIME ZONE 'America/Chicago')::date
                                     - (inv.created_at AT TIME ZONE 'America/Chicago')::date
                                   )
                                   ELSE NULL END,
           'channel', inv.external_send_channel,
           'detail', NULLIF(concat_ws(' · ',
             NULLIF(trim(COALESCE(inv.external_send_note, '')), ''),
             NULLIF(trim(COALESCE(inv.stripe_invoice_memo, '')), '')
           ), ''),
           'bill_to', CASE WHEN trim(COALESCE(inv.bill_to_email, '')) <> ''
                           THEN COALESCE(NULLIF(trim(inv.bill_to_name), ''), trim(inv.bill_to_email))
                           ELSE NULL END,
           'is_hazmat', EXISTS (
             SELECT 1 FROM public.job_hazmat_incidents hz WHERE hz.invoice_id = inv.id
           )
         ) ORDER BY (inv.status = 'ready_to_bill') DESC, inv.sequence_order, inv.created_at), '[]'::jsonb) AS rows
  FROM public.jobs_ledger_invoices inv
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(p.amount), 0) AS paid
    FROM public.jobs_ledger_payments p
    WHERE p.invoice_id = inv.id
  ) pay ON true
  WHERE inv.job_id = p_job_id
    AND inv.status IN ('ready_to_bill', 'billed', 'paid')
),
payments AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'amount', p.amount,
           'payment_date', p.paid_on,
           'method', p.payment_type
         ) ORDER BY p.paid_on NULLS LAST, p.sequence_order), '[]'::jsonb) AS rows,
         COALESCE(SUM(p.amount), 0) AS total
  FROM public.jobs_ledger_payments p
  WHERE p.job_id = p_job_id
),
last_payment AS (
  SELECT (
    SELECT jsonb_build_object('amount', p.amount, 'at', COALESCE(p.created_at, p.paid_on::timestamptz))
    FROM public.jobs_ledger_payments p
    WHERE p.job_id = p_job_id
    ORDER BY COALESCE(p.created_at, p.paid_on::timestamptz) DESC NULLS LAST
    LIMIT 1
  ) AS obj
),
labor_by_month AS (
  SELECT to_char(date_trunc('month', cs.clocked_in_at), 'YYYY-MM') AS month,
         SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0
             * COALESCE(ppc.hourly_wage, 0)) AS labor_cost
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  LEFT JOIN public.people per
    ON per.account_user_id = u.id AND per.archived_at IS NULL
  LEFT JOIN public.people_pay_config ppc
    ON (per.id IS NOT NULL AND ppc.person_id = per.id)
    OR (per.id IS NULL AND lower(trim(ppc.person_name)) = lower(trim(u.name)))
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.revoked_at IS NULL
    AND cs.clocked_out_at IS NOT NULL
  GROUP BY 1
),
parts_by_month AS (
  SELECT to_char(date_trunc('month', COALESCE(mt.posted_at::timestamptz, a.created_at)), 'YYYY-MM') AS month,
         SUM(ABS(a.amount)) AS parts_cost
  FROM public.mercury_transaction_job_allocations a
  LEFT JOIN public.mercury_transactions mt ON mt.id = a.mercury_transaction_id
  WHERE a.job_id = p_job_id
  GROUP BY 1
),
payments_by_month AS (
  SELECT to_char(date_trunc('month', COALESCE(p.paid_on::timestamptz, p.created_at)), 'YYYY-MM') AS month,
         SUM(p.amount) AS payments
  FROM public.jobs_ledger_payments p
  WHERE p.job_id = p_job_id
  GROUP BY 1
),
timeline AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'month', m.month,
           'labor_cost', round(COALESCE(l.labor_cost, 0)::numeric, 2),
           'parts_cost', round(COALESCE(pc.parts_cost, 0)::numeric, 2),
           'payments', round(COALESCE(pm.payments, 0)::numeric, 2)
         ) ORDER BY m.month), '[]'::jsonb) AS rows
  FROM (
    SELECT month FROM labor_by_month
    UNION SELECT month FROM parts_by_month
    UNION SELECT month FROM payments_by_month
  ) m
  LEFT JOIN labor_by_month l ON l.month = m.month
  LEFT JOIN parts_by_month pc ON pc.month = m.month
  LEFT JOIN payments_by_month pm ON pm.month = m.month
),
job_start AS (
  SELECT MIN(cs.clocked_in_at) AS started_at
  FROM public.clock_sessions cs
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.revoked_at IS NULL
)
SELECT jsonb_build_object(
  'job', jsonb_build_object(
    'id', job.id,
    'display_number', job.display_number,
    'job_name', job.job_name,
    'job_address', job.job_address,
    'customer_name', job.customer_name,
    'status', job.status,
    'service_type_name', job.service_type_name
  ),
  'money', jsonb_build_object(
    'revenue', job.revenue,
    'payments', payments.rows,
    'payments_total', payments.total,
    'last_payment', last_payment.obj
  ),
  'line_items', line_items.rows,
  'invoices', invoice_rows.rows,
  'charge_events', charge_events.rows,
  'costs', jsonb_build_object(
    'team_labor', jsonb_build_object(
      'total', team_labor_rows.total,
      'people', team_labor_rows.people
    ),
    'sub_labor_total', round(sub_labor_total.total::numeric, 2),
    'parts_total', round(parts.total::numeric, 2),
    'supply_house_total', round(supply_total.total::numeric, 2),
    'tally_total', round(tally_total.total::numeric, 2),
    'other_total', round(other_total.total::numeric, 2)
  ),
  'profit', round((job.revenue - (team_labor_rows.total + sub_labor_total.total + parts.total + supply_total.total + tally_total.total + other_total.total))::numeric, 2),
  'timeline', timeline.rows,
  'dates', jsonb_build_object(
    'job_start', job_start.started_at,
    'last_work', job.last_work_date,
    'paid_at', now()
  )
)
FROM job, team_labor_rows, sub_labor_total, parts, supply_total, tally_total, other_total,
     payments, last_payment, timeline, job_start, line_items, invoice_rows, charge_events;
$$;

-- 2) billed aging costs ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_billed_aging_costs()
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
  WHERE j.status = 'billed'
     OR EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = j.id AND i.status = 'billed')
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
  SELECT job_id, SUM(round((hours * COALESCE(wage, 0))::numeric, 2)) AS cost
  FROM team_labor_days
  GROUP BY job_id
),
sub_labor_books AS (
  SELECT plj.id,
         t.id AS job_id,
         COALESCE(plj.labor_rate, 0) AS job_rate,
         COALESCE(plj.distance_miles, 0) AS miles
  FROM public.people_labor_jobs plj
  JOIN targets t ON plj.job_ledger_id = t.id
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
         )::numeric, 2) AS cost
  FROM targets t
  LEFT JOIN team_labor tl ON tl.job_id = t.id
  LEFT JOIN sub_labor sl ON sl.job_id = t.id
  LEFT JOIN parts p ON p.job_id = t.id
  LEFT JOIN supply s ON s.job_id = t.id
  LEFT JOIN tally ty ON ty.job_id = t.id
  LEFT JOIN other o ON o.job_id = t.id
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE((SELECT jsonb_object_agg(job_id::text, cost) FROM combined), '{}'::jsonb)
END;
$$;

-- 3) paid profit stats -------------------------------------------------------
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
  JOIN targets t ON plj.job_ledger_id = t.id
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

-- 4) partner profit share cost buckets ---------------------------------------
CREATE OR REPLACE FUNCTION public.partner_job_cost_buckets(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH target AS (
  SELECT j.id, j.hcp_number FROM public.jobs_ledger j WHERE j.id = p_job_id
),
drive_settings AS (
  SELECT
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_mileage_cost'), 0.7) AS mileage_cost,
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_time_per_mile'), 0.02) AS time_per_mile
),
team_labor_days AS (
  SELECT cs.job_ledger_id AS job_id, u.id AS user_id, cs.work_date,
         SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours,
         COALESCE(MAX(ppc.hourly_wage), 0) AS wage
  FROM public.clock_sessions cs
  JOIN target t ON t.id = cs.job_ledger_id
  JOIN public.users u ON u.id = cs.user_id
  LEFT JOIN public.people per ON per.account_user_id = u.id AND per.archived_at IS NULL
  LEFT JOIN public.people_pay_config ppc
    ON (per.id IS NOT NULL AND ppc.person_id = per.id)
    OR (per.id IS NULL AND lower(trim(ppc.person_name)) = lower(trim(u.name)))
  WHERE cs.approved_at IS NOT NULL AND cs.revoked_at IS NULL AND cs.clocked_out_at IS NOT NULL
  GROUP BY cs.job_ledger_id, u.id, cs.work_date
),
team_labor AS (
  SELECT COALESCE(SUM(round((hours * COALESCE(wage, 0))::numeric, 2)), 0) AS cost FROM team_labor_days
),
sub_labor_books AS (
  SELECT plj.id, COALESCE(plj.labor_rate, 0) AS job_rate, COALESCE(plj.distance_miles, 0) AS miles
  FROM public.people_labor_jobs plj
  JOIN target t ON plj.job_ledger_id = t.id
),
sub_labor_lines AS (
  SELECT b.id AS book_id,
         COALESCE(SUM(COALESCE(i.direct_labor_amount,
           (CASE WHEN i.is_fixed THEN COALESCE(i.hrs_per_unit, 0)
                 ELSE COALESCE(i.count, 0) * COALESCE(i.hrs_per_unit, 0) END)
           * COALESCE(i.labor_rate, b.job_rate))), 0) AS line_total
  FROM sub_labor_books b
  LEFT JOIN public.people_labor_job_items i ON i.job_id = b.id
  GROUP BY b.id
),
sub_labor AS (
  SELECT COALESCE(SUM(l.line_total
           + CASE WHEN b.miles > 0 AND b.job_rate > 0
                    THEN b.miles * ds.mileage_cost + b.miles * ds.time_per_mile * b.job_rate
                  WHEN b.miles > 0 THEN b.miles * ds.mileage_cost
                  ELSE 0 END), 0) AS cost
  FROM sub_labor_books b
  JOIN sub_labor_lines l ON l.book_id = b.id
  CROSS JOIN drive_settings ds
),
parts AS (
  SELECT COALESCE(SUM(ABS(a.amount)), 0) AS cost
  FROM public.mercury_transaction_job_allocations a JOIN target t ON t.id = a.job_id
),
supply AS (
  SELECT COALESCE(SUM(COALESCE(shi.amount, 0) * COALESCE(al.pct, 0) / 100.0), 0) AS cost
  FROM public.supply_house_invoice_job_allocations al
  JOIN target t ON t.id = al.job_id
  JOIN public.supply_house_invoices shi ON shi.id = al.invoice_id
),
tally AS (
  SELECT COALESCE(SUM(CASE WHEN jtp.part_id IS NULL
                THEN COALESCE(jtp.fixture_cost, 0) * COALESCE(jtp.quantity, 0)
                ELSE COALESCE(poi.price_at_time, 0) * COALESCE(jtp.quantity, 0) END), 0) AS cost
  FROM public.jobs_tally_parts jtp
  JOIN target t ON t.id = jtp.job_id
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = jtp.purchase_order_id AND poi.part_id = jtp.part_id
),
other AS (
  SELECT COALESCE(SUM(COALESCE(m.amount, 0)), 0) AS cost
  FROM public.jobs_ledger_materials m JOIN target t ON t.id = m.job_id
)
SELECT jsonb_build_object(
  'labor', round(((SELECT cost FROM team_labor) + (SELECT cost FROM sub_labor))::numeric, 2),
  'materials', round(((SELECT cost FROM parts) + (SELECT cost FROM supply) + (SELECT cost FROM tally))::numeric, 2),
  'direct', round((SELECT cost FROM other)::numeric, 2)
);
$$;

-- 5) weekly money movement payload ------------------------------------------
CREATE OR REPLACE FUNCTION public.get_weekly_money_movement_payload(p_week_monday date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monday date;
  v_end date;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_office uuid;
  v_mileage numeric;
  v_time_per_mile numeric;
  v_jobs jsonb;
  v_overhead jsonb;
  v_bid_hours numeric := 0;
  v_bid_cost numeric := 0;
BEGIN
  -- Client callers must be dev or controller (wage-derived data). Service-role
  -- callers (the dispatcher) have no auth.uid() and pass through.
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_dev()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'controller')
    ) THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
  END IF;

  v_monday := COALESCE(
    p_week_monday,
    (date_trunc('week', (now() AT TIME ZONE 'America/Chicago')::date))::date - 7
  );
  v_end := v_monday + 7;
  v_start_ts := v_monday::timestamp AT TIME ZONE 'America/Chicago';
  v_end_ts := v_end::timestamp AT TIME ZONE 'America/Chicago';

  SELECT NULLIF(btrim(s.value_text), '')::uuid INTO v_office
  FROM public.app_settings s WHERE s.key = 'overhead_office_job_ledger_id_v1';

  SELECT COALESCE(s.value_num, NULLIF(btrim(COALESCE(s.value_text, '')), '')::numeric)
  INTO v_mileage FROM public.app_settings s WHERE s.key = 'drive_mileage_cost';
  v_mileage := COALESCE(v_mileage, 0.70);

  SELECT COALESCE(s.value_num, NULLIF(btrim(COALESCE(s.value_text, '')), '')::numeric)
  INTO v_time_per_mile FROM public.app_settings s WHERE s.key = 'drive_time_per_mile';
  v_time_per_mile := COALESCE(v_time_per_mile, 0.02);

  -- Crew BID labor (overhead bucket) — separate statement so the main WITH
  -- stays single-purpose.
  SELECT
    COALESCE(SUM(d.day_hours * COALESCE((a.value ->> 'pct')::numeric, 0) / 100.0), 0),
    COALESCE(SUM(d.day_hours * COALESCE((a.value ->> 'pct')::numeric, 0) / 100.0 * d.wage), 0)
  INTO v_bid_hours, v_bid_cost
  FROM (
    SELECT
      pb.bid_assignments,
      CASE
        WHEN COALESCE(cfg.is_salary, false)
          THEN CASE WHEN EXTRACT(ISODOW FROM pb.work_date) BETWEEN 1 AND 5 THEN 8 ELSE 0 END
        ELSE COALESCE(ph.hours, 0)
      END AS day_hours,
      COALESCE(cfg.hourly_wage, 0) AS wage
    FROM public.people_crew_bids pb
    LEFT JOIN LATERAL (
      SELECT p.hourly_wage, p.is_salary
      FROM public.people_pay_config p
      WHERE (pb.person_id IS NOT NULL AND p.person_id = pb.person_id)
         OR p.person_name = pb.person_name
      ORDER BY (p.person_id IS NOT DISTINCT FROM pb.person_id) DESC
      LIMIT 1
    ) cfg ON true
    LEFT JOIN public.people_hours ph
      ON ph.person_name = pb.person_name AND ph.work_date = pb.work_date
    WHERE pb.work_date >= v_monday AND pb.work_date < v_end
  ) d
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.bid_assignments, '[]'::jsonb)) a;

  WITH crew_days AS (
    SELECT
      pc.work_date,
      pc.person_name,
      pc.job_assignments,
      CASE
        WHEN COALESCE(cfg.is_salary, false)
          THEN CASE WHEN EXTRACT(ISODOW FROM pc.work_date) BETWEEN 1 AND 5 THEN 8 ELSE 0 END
        ELSE COALESCE(ph.hours, 0)
      END AS day_hours,
      COALESCE(cfg.hourly_wage, 0) AS wage
    FROM public.people_crew_jobs pc
    LEFT JOIN LATERAL (
      SELECT p.hourly_wage, p.is_salary
      FROM public.people_pay_config p
      WHERE (pc.person_id IS NOT NULL AND p.person_id = pc.person_id)
         OR p.person_name = pc.person_name
      ORDER BY (p.person_id IS NOT DISTINCT FROM pc.person_id) DESC
      LIMIT 1
    ) cfg ON true
    LEFT JOIN public.people_hours ph
      ON ph.person_name = pc.person_name AND ph.work_date = pc.work_date
    WHERE pc.work_date >= v_monday AND pc.work_date < v_end
  ),
  labor AS (
    SELECT
      (a.value ->> 'job_id')::uuid AS job_id,
      SUM(d.day_hours * COALESCE((a.value ->> 'pct')::numeric, 0) / 100.0) AS hours,
      SUM(d.day_hours * COALESCE((a.value ->> 'pct')::numeric, 0) / 100.0 * d.wage) AS cost
    FROM crew_days d
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.job_assignments, '[]'::jsonb)) a
    WHERE (a.value ->> 'job_id') IS NOT NULL
    GROUP BY 1
  ),
  subs AS (
    SELECT
      j.job_id,
      SUM(j.sheet_cost) AS cost
    FROM (
      SELECT
        lj.job_ledger_id AS job_id,
        COALESCE((
          SELECT SUM(
            CASE
              WHEN i.direct_labor_amount IS NOT NULL THEN i.direct_labor_amount
              ELSE (CASE WHEN i.is_fixed THEN i.hrs_per_unit ELSE i.count * i.hrs_per_unit END)
                   * COALESCE(i.labor_rate, lj.labor_rate, 20)
            END)
          FROM public.people_labor_job_items i WHERE i.job_id = lj.id
        ), 0)
        + COALESCE(lj.distance_miles, 0) * v_mileage
        + COALESCE(lj.distance_miles, 0) * v_time_per_mile * COALESCE(lj.labor_rate, 20)
        AS sheet_cost
      FROM public.people_labor_jobs lj
      WHERE lj.job_date >= v_monday AND lj.job_date < v_end
        AND lj.job_ledger_id IS NOT NULL
    ) j
    WHERE j.job_id IS NOT NULL
    GROUP BY j.job_id
  ),
  mercury AS (
    -- Mercury purchase amounts are negative; negate so cost reads as spend.
    SELECT a.job_id, SUM(-a.amount) AS cost
    FROM public.mercury_transaction_job_allocations a
    JOIN public.mercury_transactions t ON t.id = a.mercury_transaction_id
    WHERE (t.posted_at AT TIME ZONE 'America/Chicago')::date >= v_monday
      AND (t.posted_at AT TIME ZONE 'America/Chicago')::date < v_end
    GROUP BY a.job_id
  ),
  supply AS (
    SELECT a.job_id, SUM(i.amount * a.pct / 100.0) AS cost
    FROM public.supply_house_invoice_job_allocations a
    JOIN public.supply_house_invoices i ON i.id = a.invoice_id
    WHERE i.invoice_date >= v_monday AND i.invoice_date < v_end
    GROUP BY a.job_id
  ),
  tally AS (
    SELECT tp.job_id,
      SUM(
        CASE
          WHEN tp.part_id IS NULL THEN COALESCE(tp.fixture_cost, 0) * tp.quantity
          ELSE COALESCE(poi.price_at_time, 0) * tp.quantity
        END) AS cost
    FROM public.jobs_tally_parts tp
    LEFT JOIN public.purchase_order_items poi
      ON poi.purchase_order_id = tp.purchase_order_id AND poi.part_id = tp.part_id
    WHERE tp.created_at >= v_start_ts AND tp.created_at < v_end_ts
    GROUP BY tp.job_id
  ),
  other_charges AS (
    SELECT m.job_id, SUM(m.amount) AS cost
    FROM public.jobs_ledger_materials m
    WHERE m.created_at >= v_start_ts AND m.created_at < v_end_ts
    GROUP BY m.job_id
  ),
  pay AS (
    SELECT p.job_id, SUM(p.amount) AS amount
    FROM public.jobs_ledger_payments p
    WHERE p.paid_on >= v_monday AND p.paid_on < v_end AND p.amount > 0
    GROUP BY p.job_id
  ),
  all_jobs AS (
    SELECT job_id FROM labor
    UNION SELECT job_id FROM subs
    UNION SELECT job_id FROM mercury
    UNION SELECT job_id FROM supply
    UNION SELECT job_id FROM tally
    UNION SELECT job_id FROM other_charges
    UNION SELECT job_id FROM pay
  ),
  rows_out AS (
    SELECT
      aj.job_id,
      jl.hcp_number, jl.click_number, jl.job_name, jl.job_address,
      jl.status, jl.revenue,
      COALESCE(l.hours, 0) AS labor_hours,
      COALESCE(l.cost, 0) AS labor_cost,
      COALESCE(s.cost, 0) AS sub_cost,
      COALESCE(mc.cost, 0) AS mercury_cost,
      COALESCE(sp.cost, 0) AS supply_cost,
      COALESCE(t.cost, 0) AS tally_cost,
      COALESCE(oc.cost, 0) AS other_cost,
      COALESCE(p.amount, 0) AS payments_in,
      (SELECT e.pct FROM public.job_pct_events e
        WHERE e.job_id = aj.job_id AND e.changed_at < v_start_ts
        ORDER BY e.changed_at DESC LIMIT 1) AS pct_start,
      (SELECT e.pct FROM public.job_pct_events e
        WHERE e.job_id = aj.job_id AND e.changed_at < v_end_ts
        ORDER BY e.changed_at DESC LIMIT 1) AS pct_end,
      (SELECT e.source FROM public.job_pct_events e
        WHERE e.job_id = aj.job_id AND e.changed_at < v_end_ts
        ORDER BY e.changed_at DESC LIMIT 1) AS pct_end_source
    FROM all_jobs aj
    JOIN public.jobs_ledger jl ON jl.id = aj.job_id
    LEFT JOIN labor l ON l.job_id = aj.job_id
    LEFT JOIN subs s ON s.job_id = aj.job_id
    LEFT JOIN mercury mc ON mc.job_id = aj.job_id
    LEFT JOIN supply sp ON sp.job_id = aj.job_id
    LEFT JOIN tally t ON t.job_id = aj.job_id
    LEFT JOIN other_charges oc ON oc.job_id = aj.job_id
    LEFT JOIN pay p ON p.job_id = aj.job_id
  )
  SELECT
    COALESCE(
      jsonb_agg(to_jsonb(r) ORDER BY r.job_name)
        FILTER (WHERE v_office IS NULL OR r.job_id <> v_office),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'office_labor_hours', COALESCE(SUM(r.labor_hours) FILTER (WHERE v_office IS NOT NULL AND r.job_id = v_office), 0),
      'office_labor_cost', COALESCE(SUM(r.labor_cost) FILTER (WHERE v_office IS NOT NULL AND r.job_id = v_office), 0),
      'office_job_charges', COALESCE(SUM(r.mercury_cost + r.supply_cost + r.tally_cost + r.other_cost)
        FILTER (WHERE v_office IS NOT NULL AND r.job_id = v_office), 0)
    )
  INTO v_jobs, v_overhead
  FROM rows_out r;

  v_overhead := COALESCE(v_overhead, '{}'::jsonb)
    || jsonb_build_object('bid_labor_hours', v_bid_hours, 'bid_labor_cost', v_bid_cost);

  RETURN jsonb_build_object(
    'week_monday', to_char(v_monday, 'YYYY-MM-DD'),
    'week_end', to_char(v_monday + 6, 'YYYY-MM-DD'),
    'office_job_id', v_office,
    'jobs', COALESCE(v_jobs, '[]'::jsonb),
    'overhead', v_overhead
  );
END;
$$;

-- 6) settle_step_commitment: step-anchored sheets carry the link -------------
CREATE OR REPLACE FUNCTION public.settle_step_commitment("p_commitment_id" uuid, "p_dry_run" boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_c public.step_commitments%ROWTYPE;
  v_step public.project_workflow_steps%ROWTYPE;
  v_workflow public.project_workflows%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_sheet public.people_labor_jobs%ROWTYPE;
  v_labor_job_id uuid;
  v_created_new boolean := false;
  v_release numeric(12,2);
  v_job_number character varying(10);
  v_job_ledger_id uuid;
  v_job_count integer;
  v_report jsonb;
  v_detail text;
  v_created jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_c FROM public.step_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;
  IF v_c.step_id IS NOT NULL AND NOT public.can_access_project_via_step(v_c.step_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF v_c.status IN ('settled','cancelled') THEN
    RAISE EXCEPTION 'Work order is already %', v_c.status;
  END IF;
  IF v_c.amount IS NULL THEN
    RAISE EXCEPTION 'The work order has no amount';
  END IF;

  v_release := round(v_c.amount * (1 - v_c.retainage_pct / 100.0), 2);

  IF v_c.step_id IS NULL THEN
    BEGIN
      IF v_c.labor_job_id IS NULL AND v_c.job_id IS NOT NULL THEN
        -- Approve first so the sheet creator accepts the status, then create.
        UPDATE public.step_commitments SET status = 'approved', approved_at = COALESCE(approved_at, now()) WHERE id = p_commitment_id;
        v_created := public.create_sheet_for_work_order(p_commitment_id);
        IF v_created ? 'error' THEN
          RAISE EXCEPTION '%', v_created ->> 'error';
        END IF;
        v_labor_job_id := (v_created ->> 'labor_job_id')::uuid;
        v_created_new := (v_created ->> 'created')::boolean;
      ELSE
        v_labor_job_id := v_c.labor_job_id;
      END IF;
      SELECT * INTO v_sheet FROM public.people_labor_jobs WHERE id = v_labor_job_id;
      v_job_number := NULLIF(btrim(COALESCE(v_sheet.job_number, '')), '');

      UPDATE public.step_commitments
      SET status = 'settled',
          settled_at = now(),
          approved_at = COALESCE(approved_at, now()),
          labor_job_id = v_labor_job_id
      WHERE id = p_commitment_id;

      v_report := jsonb_build_object(
        'commitment_id', v_c.id,
        'labor_job_id', v_labor_job_id,
        'display_name', v_c.display_name,
        'agreed_amount', v_c.amount,
        'retainage_pct', v_c.retainage_pct,
        'released_amount', v_release,
        'job_number', v_job_number,
        'created_new_sheet', v_created_new
      );
      IF p_dry_run THEN
        RAISE EXCEPTION USING message = '__settle_dry_run__', detail = v_report::text;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM = '__settle_dry_run__' THEN
        GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
        RETURN v_detail::jsonb;
      END IF;
      RAISE;
    END;
    RETURN v_report;
  END IF;

  SELECT * INTO v_step FROM public.project_workflow_steps WHERE id = v_c.step_id;
  SELECT * INTO v_workflow FROM public.project_workflows WHERE id = v_step.workflow_id;
  SELECT * INTO v_project FROM public.projects WHERE id = v_workflow.project_id;

  SELECT count(*) INTO v_job_count FROM public.jobs_ledger jl WHERE jl.project_id = v_project.id;
  IF v_job_count = 1 THEN
    SELECT jl.id, left(COALESCE(NULLIF(btrim(jl.hcp_number), ''), NULLIF(btrim(jl.click_number), '')), 10)
      INTO v_job_ledger_id, v_job_number
    FROM public.jobs_ledger jl WHERE jl.project_id = v_project.id;
  END IF;

  BEGIN
    IF v_c.labor_job_id IS NOT NULL THEN
      v_labor_job_id := v_c.labor_job_id;
    ELSE
      v_created_new := true;
      INSERT INTO public.people_labor_jobs
        (master_user_id, assigned_to_name, address, job_number, job_ledger_id, labor_rate, job_date, distance_miles, project_id, step_id)
      VALUES (
        COALESCE(v_project.master_user_id, auth.uid()),
        v_c.display_name,
        COALESCE(v_project.address, ''),
        v_job_number,
        v_job_ledger_id,
        0,
        public.app_today(),
        0,
        v_project.id,
        v_c.step_id
      )
      RETURNING id INTO v_labor_job_id;

      INSERT INTO public.people_labor_job_items
        (job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order)
      VALUES (
        v_labor_job_id,
        left(v_step.name || ' — ' || v_project.name, 200),
        1, 0, true, NULL, v_release, 1
      );
    END IF;

    UPDATE public.step_commitments
    SET status = 'settled',
        settled_at = now(),
        approved_at = COALESCE(approved_at, now()),
        labor_job_id = v_labor_job_id
    WHERE id = p_commitment_id;

    v_report := jsonb_build_object(
      'commitment_id', v_c.id,
      'labor_job_id', v_labor_job_id,
      'display_name', v_c.display_name,
      'agreed_amount', v_c.amount,
      'retainage_pct', v_c.retainage_pct,
      'released_amount', v_release,
      'job_number', v_job_number,
      'created_new_sheet', v_created_new
    );

    IF p_dry_run THEN
      RAISE EXCEPTION USING message = '__settle_dry_run__', detail = v_report::text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = '__settle_dry_run__' THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      RETURN v_detail::jsonb;
    END IF;
    RAISE;
  END;

  RETURN v_report;
END;
$$;
