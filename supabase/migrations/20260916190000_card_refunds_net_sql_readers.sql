SET lock_timeout = '3s';

-- Card refunds net against job cost — the SQL readers (v2.3525, PR 2 of the
-- v2.3519 train). mercury_transaction_job_allocations.amount carries the bank's
-- sign: a purchase is negative, a refund positive (the rows sum to the signed
-- transaction). Every reader below took ABS(amount), so a refund from Lowe's,
-- Home Depot or O'Reilly ADDED to the job's parts cost. The client went to
-- cost = -amount in v2.3519 (src/lib/jobs/cardChargeAllocationFilter.ts,
-- cardChargeCostUsd); these six functions now read the same way, so the
-- billed-aging and paid-profit rollups, the partner ledgers, job baselines and
-- the paid-job email agree with Job Summary. The weekly-money payload
-- (20260807060000) already negated and is untouched.
--
-- Each body is the newest definition of that function with ONLY the sign
-- expression changed: SUM(ABS(a.amount)) → SUM(-a.amount), ABS(a.amount) AS
-- amount → -a.amount AS amount, ROUND(ABS(a.amount)…) → ROUND((-a.amount)…),
-- sum(abs(coalesce(m.amount, 0))) → sum(-coalesce(m.amount, 0)). No table, no
-- grant, no signature change — CREATE OR REPLACE keeps the existing grants.

-- ── get_paid_job_email_payload — body from 20260907130000_money_rollups_read_sheet_link.sql, sign rule only ──
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
  SELECT -a.amount AS amount,
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
         SUM(-a.amount) AS parts_cost
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


-- ── get_billed_aging_costs — body from 20260907130000_money_rollups_read_sheet_link.sql, sign rule only ──
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
  SELECT a.job_id, SUM(-a.amount) AS cost
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


-- ── get_paid_profit_stats — body from 20260907130000_money_rollups_read_sheet_link.sql, sign rule only ──
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
  SELECT a.job_id, SUM(-a.amount) AS cost
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


-- ── partner_job_cost_buckets — body from 20260907130000_money_rollups_read_sheet_link.sql, sign rule only ──
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
  SELECT COALESCE(SUM(-a.amount), 0) AS cost
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


-- ── partner_job_costing_payload — body from 20260821150000_partner_view_as_rpcs.sql, sign rule only ──
CREATE OR REPLACE FUNCTION public.partner_job_costing_payload(p_partnership_id uuid, p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.partnerships%ROWTYPE;
  v_j public.jobs_ledger%ROWTYPE;
BEGIN
  IF p_partnership_id IS NULL THEN
    RAISE EXCEPTION 'not a partner';
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a partner';
  END IF;
  IF (v_p.modules ->> 'costing') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'job costing is not enabled for this partnership';
  END IF;
  SELECT * INTO v_j FROM public.jobs_ledger WHERE id = p_job_id;
  IF NOT FOUND OR v_j.partner_person_id IS DISTINCT FROM v_p.person_id THEN
    RAISE EXCEPTION 'job not available';
  END IF;

  RETURN jsonb_build_object(
    'job_id', v_j.id,
    'label', COALESCE(NULLIF(btrim(COALESCE(v_j.hcp_number, '')), ''), NULLIF(btrim(COALESCE(v_j.click_number, '')), ''), NULLIF(btrim(COALESCE(v_j.job_name, '')), ''), v_j.id::text),
    'job_name', v_j.job_name,
    'status', v_j.status,
    'revenue', v_j.revenue,
    'as_of', now(),
    'hours', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', h.name, 'hours', ROUND(h.hrs::numeric, 1)) ORDER BY h.hrs DESC)
      FROM (
        SELECT u.name, SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hrs
        FROM public.clock_sessions cs
        JOIN public.users u ON u.id = cs.user_id
        WHERE cs.job_ledger_id = p_job_id
          AND cs.clocked_out_at IS NOT NULL
          AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
        GROUP BY u.name
      ) h
    ), '[]'::jsonb),
    'supply_invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vendor', sh.name, 'invoice_number', shi.invoice_number, 'invoice_date', shi.invoice_date,
        'invoice_amount', shi.amount, 'pct', al.pct,
        'allocated', ROUND((COALESCE(shi.amount, 0) * COALESCE(al.pct, 0) / 100.0)::numeric, 2)
      ) ORDER BY shi.invoice_date DESC NULLS LAST)
      FROM public.supply_house_invoice_job_allocations al
      JOIN public.supply_house_invoices shi ON shi.id = al.invoice_id
      LEFT JOIN public.supply_houses sh ON sh.id = shi.supply_house_id
      WHERE al.job_id = p_job_id
    ), '[]'::jsonb),
    'card_charges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'counterparty', mt.counterparty_name, 'posted_at', mt.posted_at, 'allocated', ROUND((-a.amount)::numeric, 2)
      ) ORDER BY mt.posted_at DESC NULLS LAST)
      FROM public.mercury_transaction_job_allocations a
      JOIN public.mercury_transactions mt ON mt.id = a.mercury_transaction_id
      WHERE a.job_id = p_job_id
    ), '[]'::jsonb),
    'direct', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('description', m.description, 'amount', m.amount) ORDER BY m.sequence_order)
      FROM public.jobs_ledger_materials m
      WHERE m.job_id = p_job_id
    ), '[]'::jsonb)
  );
END;
$$;

-- ── keep_job_baseline — body from 20260912052042_job_baselines.sql, sign rule only ──
CREATE OR REPLACE FUNCTION public.keep_job_baseline(p_job_id uuid, p_kept_by uuid, p_kept_on text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs_ledger%ROWTYPE;
  v_hours numeric := 0;
  v_usd numeric := 0;
  v_people integer := 0;
  v_materials numeric := 0;
  v_version uuid;
  v_has_counts boolean := false;
  v_pred_total numeric := 0;
  v_count_total numeric := 0;
BEGIN
  SELECT * INTO v_job FROM public.jobs_ledger WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Recorded team hours and wages on the job (the same fold as get_man_hours_by_job, one job, with the wage).
  WITH crew AS (
    SELECT cj.work_date, cj.person_name,
           jsonb_array_elements(CASE WHEN jsonb_typeof(cj.job_assignments) = 'array' THEN cj.job_assignments ELSE '[]'::jsonb END) AS assignment
      FROM public.people_crew_jobs cj
  ),
  alloc AS (
    SELECT c.person_name,
           (CASE WHEN coalesce(pc.is_salary, false)
                 THEN CASE WHEN extract(dow FROM c.work_date) BETWEEN 1 AND 5 THEN 8 ELSE 0 END
                 ELSE coalesce(ph.hours, 0) END)
           * (coalesce(nullif(c.assignment->>'pct', '')::numeric, 0) / 100.0) AS hrs,
           coalesce(pc.hourly_wage, 0) AS wage
      FROM crew c
      LEFT JOIN public.people_pay_config pc ON pc.person_name = c.person_name
      LEFT JOIN public.people_hours_recorded ph ON ph.person_name = c.person_name AND ph.work_date = c.work_date
     WHERE c.assignment->>'job_id' = p_job_id::text
  )
  SELECT coalesce(sum(hrs), 0), coalesce(sum(hrs * wage), 0), count(DISTINCT person_name) FILTER (WHERE hrs > 0)
    INTO v_hours, v_usd, v_people
    FROM alloc;

  IF v_hours <= 0 THEN
    RETURN false; -- nothing to keep
  END IF;

  -- Materials the job side counts: supply-house splits and card charges (absolute; the bank signs debits negative).
  SELECT coalesce((SELECT sum(coalesce(i.amount, 0) * coalesce(a.pct, 0) / 100.0)
                     FROM public.supply_house_invoice_job_allocations a
                     JOIN public.supply_house_invoices i ON i.id = a.invoice_id
                    WHERE a.job_id = p_job_id), 0)
       + coalesce((SELECT sum(-coalesce(m.amount, 0)) FROM public.mercury_transaction_job_allocations m WHERE m.job_id = p_job_id), 0)
    INTO v_materials;

  -- The bid's count sheet, if any (the active version's rows, else the unversioned ones).
  IF v_job.bid_id IS NOT NULL THEN
    SELECT selected_bid_version_id INTO v_version FROM public.bids WHERE id = v_job.bid_id;
    SELECT EXISTS (SELECT 1 FROM public.bids_count_rows r WHERE r.bid_id = v_job.bid_id AND (r.bid_version_id IS NOT DISTINCT FROM v_version OR r.bid_version_id IS NULL) AND coalesce(r.count, 0) > 0)
      INTO v_has_counts;
  END IF;

  INSERT INTO public.job_baselines (job_id, bid_id, kept_at, kept_by, kept_on, job_status, price_usd, team_hours, team_usd, people_count, materials_usd, grade, updated_at)
  VALUES (p_job_id, v_job.bid_id, now(), p_kept_by, p_kept_on, v_job.status, v_job.revenue, v_hours, v_usd, v_people, v_materials, CASE WHEN v_has_counts THEN 'fixture' ELSE 'per_thousand' END, now())
  ON CONFLICT (job_id) DO UPDATE
    SET bid_id = EXCLUDED.bid_id, kept_at = EXCLUDED.kept_at, kept_by = EXCLUDED.kept_by, kept_on = EXCLUDED.kept_on, job_status = EXCLUDED.job_status,
        price_usd = EXCLUDED.price_usd, team_hours = EXCLUDED.team_hours, team_usd = EXCLUDED.team_usd, people_count = EXCLUDED.people_count,
        materials_usd = EXCLUDED.materials_usd, grade = EXCLUDED.grade, updated_at = now();

  DELETE FROM public.job_baseline_rows WHERE job_id = p_job_id;

  IF v_has_counts THEN
    -- Weights: the bid's predicted hours per count row where the estimate has any, else the counts themselves.
    WITH counts AS (
      SELECT lower(trim(r.fixture)) AS key, max(r.fixture) AS fixture, max(r.unit) AS unit, sum(coalesce(r.count, 0)) AS cnt
        FROM public.bids_count_rows r
       WHERE r.bid_id = v_job.bid_id AND (r.bid_version_id IS NOT DISTINCT FROM v_version OR r.bid_version_id IS NULL) AND coalesce(r.count, 0) > 0
       GROUP BY lower(trim(r.fixture))
    ),
    predicted AS (
      SELECT lower(trim(l.fixture)) AS key,
             sum((coalesce(l.rough_in_hrs_per_unit, 0) + coalesce(l.top_out_hrs_per_unit, 0) + coalesce(l.trim_set_hrs_per_unit, 0))
                 * CASE WHEN l.kind = 'sub' THEN 0
                        WHEN coalesce(l.is_fixed, false) OR l.kind = 'task' THEN 1
                        WHEN coalesce(l.unit, '') ILIKE '%100%' THEN coalesce(l.count, 0) / 100.0
                        ELSE coalesce(l.count, 0) END) AS hrs
        FROM public.cost_estimate_labor_rows l
        JOIN public.cost_estimates e ON e.id = l.cost_estimate_id
       WHERE e.bid_id = v_job.bid_id
       GROUP BY lower(trim(l.fixture))
    ),
    joined AS (
      SELECT c.key, c.fixture, c.unit, c.cnt, coalesce(p.hrs, 0) AS pred
        FROM counts c LEFT JOIN predicted p ON p.key = c.key
    )
    SELECT coalesce(sum(pred), 0), coalesce(sum(cnt), 0) INTO v_pred_total, v_count_total FROM joined;

    INSERT INTO public.job_baseline_rows (job_id, fixture, unit, count, hours, weight_source, predicted_hours)
    SELECT p_job_id, j.fixture, j.unit, j.cnt,
           CASE WHEN v_pred_total > 0 THEN v_hours * j.pred / v_pred_total
                WHEN v_count_total > 0 THEN v_hours * j.cnt / v_count_total
                ELSE 0 END,
           CASE WHEN v_pred_total > 0 THEN 'predicted' ELSE 'count' END,
           CASE WHEN j.pred > 0 THEN j.pred END
      FROM (
        WITH counts AS (
          SELECT lower(trim(r.fixture)) AS key, max(r.fixture) AS fixture, max(r.unit) AS unit, sum(coalesce(r.count, 0)) AS cnt
            FROM public.bids_count_rows r
           WHERE r.bid_id = v_job.bid_id AND (r.bid_version_id IS NOT DISTINCT FROM v_version OR r.bid_version_id IS NULL) AND coalesce(r.count, 0) > 0
           GROUP BY lower(trim(r.fixture))
        ),
        predicted AS (
          SELECT lower(trim(l.fixture)) AS key,
                 sum((coalesce(l.rough_in_hrs_per_unit, 0) + coalesce(l.top_out_hrs_per_unit, 0) + coalesce(l.trim_set_hrs_per_unit, 0))
                     * CASE WHEN l.kind = 'sub' THEN 0
                            WHEN coalesce(l.is_fixed, false) OR l.kind = 'task' THEN 1
                            WHEN coalesce(l.unit, '') ILIKE '%100%' THEN coalesce(l.count, 0) / 100.0
                            ELSE coalesce(l.count, 0) END) AS hrs
            FROM public.cost_estimate_labor_rows l
            JOIN public.cost_estimates e ON e.id = l.cost_estimate_id
           WHERE e.bid_id = v_job.bid_id
           GROUP BY lower(trim(l.fixture))
        )
        SELECT c.key, c.fixture, c.unit, c.cnt, coalesce(p.hrs, 0) AS pred FROM counts c LEFT JOIN predicted p ON p.key = c.key
      ) j;
  END IF;

  RETURN true;
END;
$$;
