SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 6, v2.6759: the Pipeline's money doors, rows 38 to 40, 44 and 45 of the audit
-- table, every recommendation taken as written by the owner on 2026-11-08. The owner reads Team labor and profit on
-- every job already; these doors open the same figures where a dev and the controller alone read them:
--   row 38  Job Summary → the overhead dials and Use for everyone — app_settings.overhead_allocation_v1, the owner too.
--   row 39  Pipeline → Weekly money movement — get_weekly_money_movement_payload admits the owner.
--   row 40  The Billed aging and Paid profit charts and the overview's Collected door — get_billed_aging_costs and
--           get_paid_profit_stats admit the owner.
--   row 44  Pay speeds → Data health's No Count Date (the controller too) and Exclude from pay-speed math (the
--           controller beside the owner and the dev).
--   row 45  The contract coverage floor — app_settings.job_contract_floor_cents_v1, the owner too.
-- The three functions are restated word for word from their last definitions (20260916190000 for the two charts,
-- 20260907130000 for the week) with one change each: the gate's is_dev() reads is_master_or_dev(). Additive and
-- idempotent: no table is created, so no fence call is owed.

-- 1) The owner's two keys (rows 38 and 45): both blocks upsert.
DROP POLICY IF EXISTS master_or_dev_insert_pipeline_money_keys ON public.app_settings;
CREATE POLICY master_or_dev_insert_pipeline_money_keys ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key IN ('overhead_allocation_v1', 'job_contract_floor_cents_v1') AND public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_pipeline_money_keys ON public.app_settings;
CREATE POLICY master_or_dev_update_pipeline_money_keys ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('overhead_allocation_v1', 'job_contract_floor_cents_v1') AND public.is_master_or_dev())
  WITH CHECK (key IN ('overhead_allocation_v1', 'job_contract_floor_cents_v1') AND public.is_master_or_dev());

-- 2) Pay speeds (row 44): the No Count Date row is written and cleared by the controller too; the exclusions' two
-- policies restated from 20260825170000 with the controller beside the dev and the master.
DROP POLICY IF EXISTS controller_or_dev_insert_pay_speed_no_count ON public.app_settings;
CREATE POLICY controller_or_dev_insert_pay_speed_no_count ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key = 'pay_speed_no_count_date_v1' AND (public.is_dev() OR public.is_controller()));
DROP POLICY IF EXISTS controller_or_dev_update_pay_speed_no_count ON public.app_settings;
CREATE POLICY controller_or_dev_update_pay_speed_no_count ON public.app_settings FOR UPDATE TO authenticated
  USING (key = 'pay_speed_no_count_date_v1' AND (public.is_dev() OR public.is_controller()))
  WITH CHECK (key = 'pay_speed_no_count_date_v1' AND (public.is_dev() OR public.is_controller()));
DROP POLICY IF EXISTS controller_or_dev_delete_pay_speed_no_count ON public.app_settings;
CREATE POLICY controller_or_dev_delete_pay_speed_no_count ON public.app_settings FOR DELETE TO authenticated
  USING (key = 'pay_speed_no_count_date_v1' AND (public.is_dev() OR public.is_controller()));

DROP POLICY IF EXISTS "Devs and masters exclude payments" ON public.pay_speed_exclusions;
CREATE POLICY "Devs and masters exclude payments" ON public.pay_speed_exclusions
  FOR INSERT WITH CHECK (
    public.is_dev() OR public.is_controller() OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
    )
  );

DROP POLICY IF EXISTS "Devs and masters include payments back" ON public.pay_speed_exclusions;
CREATE POLICY "Devs and masters include payments back" ON public.pay_speed_exclusions
  FOR DELETE USING (
    public.is_dev() OR public.is_controller() OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
    )
  );

-- 3) The Billed aging chart (row 40).
CREATE OR REPLACE FUNCTION public.get_billed_aging_costs()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH gate AS (
  SELECT public.is_master_or_dev()
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

-- 4) The Paid profit chart (row 40).
CREATE OR REPLACE FUNCTION public.get_paid_profit_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH gate AS (
  SELECT public.is_master_or_dev()
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

-- 5) Weekly money movement (row 39).
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
  -- Client callers must be the owner, a dev or the controller (v2.6759, punch list #188 row 39; dev or controller before) (wage-derived data). Service-role
  -- callers (the dispatcher) have no auth.uid() and pass through.
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_master_or_dev()
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
