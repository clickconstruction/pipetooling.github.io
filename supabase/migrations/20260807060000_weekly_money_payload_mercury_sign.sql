SET lock_timeout = '3s';

-- Weekly Money payload: Mercury sign fix (v2.1443). Mercury card purchases
-- store NEGATIVE amounts (bank-ledger sign); the v2.1442 payload summed them
-- raw, so mercury_cost (and the office-charges overhead bucket) came back
-- negative. Money out is positive spend: negate the allocation sum — refunds
-- (positive Mercury amounts) correctly reduce the week's cost. Fidelity noted
-- against prod 2026-08-06 (labor parity with teamLabor.ts verified exactly:
-- 9.675 h / $120.94 on the same job-week both sides).
-- Also adds pct_end_source so the client can tell a seeded baseline from a
-- real in-week % change (a seed row is a standing value, not movement — the
-- bootstrap week must not count a job's whole % as this week's progress).
-- Full function replace; body otherwise identical to 20260807053000 (both
-- bodies are this train's own — no external drift possible).

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
        (SELECT jl.id FROM public.jobs_ledger jl
          WHERE jl.hcp_number IS NOT NULL AND btrim(jl.hcp_number) <> ''
            AND btrim(jl.hcp_number) = btrim(lj.job_number)
          ORDER BY jl.created_at LIMIT 1) AS job_id,
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
        AND lj.job_number IS NOT NULL AND btrim(lj.job_number) <> ''
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

COMMENT ON FUNCTION public.get_weekly_money_movement_payload(date) IS
  'Weekly Money Movement payload (v2.1442): per-job money out (crew labor via teamLabor.ts parity math, subs, mercury/supply/tally/other materials), money in (payments by paid_on), and pct_start/pct_end from job_pct_events for a Mon-Sun Central week. Office-job rows + crew bid labor fold into overhead. Dev/controller clients + service role. p_week_monday NULL = previous complete week.';

REVOKE EXECUTE ON FUNCTION public.get_weekly_money_movement_payload(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_weekly_money_movement_payload(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_money_movement_payload(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_money_movement_payload(date) TO service_role;
