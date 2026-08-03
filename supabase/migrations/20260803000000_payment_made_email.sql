SET lock_timeout = '3s';

-- Payment-made email notifications (v2.1310): a second notification stream on
-- the paid-job-email rail. The existing stream fires when a job REACHES Paid
-- in Full (status trigger, v2.965); this one fires when ANY payment lands —
-- mark_invoice_paid / mark_job_paid, a Mercury AR allocation, the Stripe
-- webhook's mark_invoice_paid_from_stripe, or a manual Edit Job payment row.
-- Recipients are a SEPARATE app_settings list ('payment_made_email_recipients_v1',
-- same JSON-array-of-user-ids shape as 'paid_job_email_recipients_v1'); the
-- paid-job-email edge function fans out both kinds on its existing cron and
-- suppresses 'payment' rows that are superseded by a pending 'paid_in_full'
-- row for the same job (the final payment fires both triggers in one tx).
--
-- Also: paid-email payload v5 — the job's INVOICES table (the Edit Job modal's
-- Status / Date / Amount view: drafts first, sent date with the "(+N)" created→
-- sent offset, channel, memo/note detail, bill-to override, hazmat flag, and
-- per-invoice paid sums) so the payment email shows exactly what the office
-- sees in the modal. Additive JSON — deploy order vs the edge redeploy is safe.

-- ── Queue: add the kind discriminator (additive, backfills as paid_in_full) ──

ALTER TABLE public.paid_job_email_queue
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'paid_in_full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paid_job_email_queue_kind_check'
      AND conrelid = 'public.paid_job_email_queue'::regclass
  ) THEN
    ALTER TABLE public.paid_job_email_queue
      ADD CONSTRAINT paid_job_email_queue_kind_check
      CHECK (kind IN ('paid_in_full', 'payment'));
  END IF;
END $$;

COMMENT ON COLUMN public.paid_job_email_queue.kind IS
  'paid_in_full = job hit status=paid (v2.965 stream); payment = a jobs_ledger_payments row landed (v2.1310 stream, separate recipient list).';

-- ── Enqueue trigger: any positive payment row → one queue row ────────────────

CREATE OR REPLACE FUNCTION public.enqueue_payment_made_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.paid_job_email_queue (job_ledger_id, kind)
  VALUES (NEW.job_id, 'payment');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_payment_made_email_ai ON public.jobs_ledger_payments;

CREATE TRIGGER enqueue_payment_made_email_ai
AFTER INSERT ON public.jobs_ledger_payments
FOR EACH ROW
WHEN (NEW.amount > 0)
EXECUTE FUNCTION public.enqueue_payment_made_email();

COMMENT ON FUNCTION public.enqueue_payment_made_email() IS
  'Payment-made email stream (v2.1310): every positive jobs_ledger_payments INSERT enqueues kind=payment. The edge function coalesces same-job rows and defers to a pending paid_in_full row.';

-- ── Recipients setting seed (empty; the Stages gear manages it, dev-write) ───

INSERT INTO public.app_settings (key, value_text)
VALUES ('payment_made_email_recipients_v1', '[]')
ON CONFLICT (key) DO NOTHING;

-- ── Payload v5: + invoices (the Edit Job Invoices table, mirrored) ───────────
-- Body = 20260730050329 (v4) verbatim plus the invoices CTE + output key.

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
  JOIN job ON trim(COALESCE(job.hcp_number, '')) <> ''
    AND lower(trim(COALESCE(plj.job_number, ''))) = lower(trim(job.hcp_number))
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
