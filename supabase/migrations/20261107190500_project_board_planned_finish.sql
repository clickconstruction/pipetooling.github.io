SET lock_timeout = '3s';

-- The Projects board reads the planned finish (punch list #234, PR 2). `superintendentLine` has taken a planned finish
-- since v2.6320 and the board handed it null; 20261107190000_job_planned_finish.sql froze one on job_budgets at award.
-- This adds `planned_finish` to what `list_project_board` returns for every role on the board. Nothing else moves: the
-- body is 20261103012944_project_board_kind_facts.sql's, with the one column in the budgets read and the returned
-- object, and no dollar joins it (a date). See docs/migrations/20261107190500_project_board_planned_finish.md.

-- With no ids: every Working job, which the client's gate narrows to the projects. With ids: those jobs, the phone's one.
CREATE OR REPLACE FUNCTION public.list_project_board(p_job_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF NOT public.can_read_project_board() THEN
    RAISE EXCEPTION 'The Projects board is for the leader, the office and the superintendents' USING ERRCODE = '42501';
  END IF;

  WITH jobs AS MATERIALIZED (
    SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.status, j.pct_complete, j.revenue,
      j.kind, j.bid_id, j.project_id, j.first_work_date, j.billing_only
    FROM public.jobs_ledger j
    WHERE CASE WHEN p_job_ids IS NULL THEN j.status = 'working' ELSE j.id = ANY (p_job_ids) END
  ),
  -- Team labor, as `fetchTeamLaborBreakdownForJob`: each crew row's share of the job, of the day's recorded hours by
  -- person id then by name, or eight hours on a weekday for a salaried person.
  assignments AS (
    SELECT c.person_name, c.person_id, c.work_date, (a->>'job_id')::uuid AS job_id, COALESCE((a->>'pct')::numeric, 0) AS pct
    FROM public.people_crew_jobs c
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.job_assignments) = 'array' THEN c.job_assignments ELSE '[]'::jsonb END) a
    WHERE (a->>'job_id')::uuid IN (SELECT id FROM jobs)
  ),
  recorded AS MATERIALIZED (
    SELECT r.person_name, r.person_id, r.work_date, r.hours
    FROM public.people_hours_recorded r
    WHERE r.work_date IN (SELECT DISTINCT work_date FROM assignments)
  ),
  recorded_by_id AS (SELECT person_id, work_date, MAX(hours) AS hours FROM recorded WHERE person_id IS NOT NULL GROUP BY 1, 2),
  recorded_by_name AS (SELECT person_name, work_date, MAX(hours) AS hours FROM recorded GROUP BY 1, 2),
  pay_by_id AS (SELECT DISTINCT ON (person_id) person_id, is_salary, hourly_wage FROM public.people_pay_config WHERE person_id IS NOT NULL ORDER BY person_id, person_name),
  pay_by_name AS (SELECT DISTINCT ON (person_name) person_name, is_salary, hourly_wage FROM public.people_pay_config ORDER BY person_name),
  person_days AS (
    SELECT a.job_id, a.work_date, a.person_name,
      SUM(d.day_hours * a.pct / 100) AS hours,
      SUM(d.day_hours * a.pct / 100 * d.rate) AS usd
    FROM assignments a
    LEFT JOIN pay_by_id pi ON pi.person_id = a.person_id
    LEFT JOIN pay_by_name pn ON pn.person_name = a.person_name
    LEFT JOIN recorded_by_id ri ON ri.person_id = a.person_id AND ri.work_date = a.work_date
    LEFT JOIN recorded_by_name rn ON rn.person_name = a.person_name AND rn.work_date = a.work_date
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN COALESCE(pi.is_salary, pn.is_salary, false)
          THEN CASE WHEN EXTRACT(ISODOW FROM a.work_date) BETWEEN 1 AND 5 THEN 8 ELSE 0 END
          ELSE COALESCE(ri.hours, rn.hours, 0)
        END AS day_hours,
        COALESCE(pi.hourly_wage, pn.hourly_wage, 0) AS rate
    ) d
    GROUP BY 1, 2, 3
  ),
  team AS (SELECT job_id, SUM(usd) AS usd FROM person_days GROUP BY 1),
  -- Sub labor, as `laborJobSubCost`: the lines, plus the drive at the company's mileage settings.
  drive AS (
    SELECT COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_mileage_cost'), 0.7) AS mileage_cost,
           COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_time_per_mile'), 0.02) AS time_per_mile
  ),
  sub_books AS (
    SELECT plj.id, plj.job_ledger_id AS job_id, COALESCE(plj.labor_rate, 0) AS job_rate, COALESCE(plj.distance_miles, 0) AS miles
    FROM public.people_labor_jobs plj WHERE plj.job_ledger_id IN (SELECT id FROM jobs)
  ),
  sub_lines AS (
    SELECT b.id AS book_id,
      COALESCE(SUM(COALESCE(i.direct_labor_amount,
        (CASE WHEN COALESCE(i.is_fixed, false) THEN COALESCE(i.hrs_per_unit, 0) ELSE COALESCE(i.count, 0) * COALESCE(i.hrs_per_unit, 0) END)
        * COALESCE(i.labor_rate, b.job_rate))), 0) AS line_total
    FROM sub_books b LEFT JOIN public.people_labor_job_items i ON i.job_id = b.id
    GROUP BY b.id
  ),
  subs AS (
    SELECT b.job_id, SUM(l.line_total
      + CASE WHEN b.miles > 0 AND b.job_rate > 0 THEN b.miles * dr.mileage_cost + b.miles * dr.time_per_mile * b.job_rate
             WHEN b.miles > 0 THEN b.miles * dr.mileage_cost ELSE 0 END) AS usd
    FROM sub_books b JOIN sub_lines l ON l.book_id = b.id CROSS JOIN drive dr
    GROUP BY b.job_id
  ),
  -- Card charges, the one card rule: no Internal Transfers, and a charge on a supply-house invoice counts under the invoice.
  cards AS (
    SELECT a.job_id, SUM(0 - a.amount) AS usd
    FROM public.mercury_transaction_job_allocations a
    WHERE a.job_id IN (SELECT id FROM jobs)
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_drag_sort_assignments da JOIN public.mercury_drag_sort_labels dl ON dl.id = da.label_id
                      WHERE da.mercury_transaction_id = a.mercury_transaction_id AND dl.default_key = 'internal_transfers')
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links k WHERE k.mercury_transaction_id = a.mercury_transaction_id)
    GROUP BY a.job_id
  ),
  supply AS (
    SELECT al.job_id, SUM(COALESCE(shi.amount, 0) * COALESCE(al.pct, 0) / 100.0) AS usd
    FROM public.supply_house_invoice_job_allocations al JOIN public.supply_house_invoices shi ON shi.id = al.invoice_id
    WHERE al.job_id IN (SELECT id FROM jobs) GROUP BY al.job_id
  ),
  tally AS (
    SELECT jtp.job_id, SUM(COALESCE(jtp.quantity, 0) * CASE WHEN jtp.part_id IS NULL THEN COALESCE(jtp.fixture_cost, 0) ELSE COALESCE(poi.price_at_time, 0) END) AS usd
    FROM public.jobs_tally_parts jtp
    LEFT JOIN public.purchase_order_items poi ON poi.purchase_order_id = jtp.purchase_order_id AND poi.part_id = jtp.part_id
    WHERE jtp.job_id IN (SELECT id FROM jobs) GROUP BY jtp.job_id
  ),
  billed AS (
    SELECT m.job_id, SUM(COALESCE(m.amount, 0)) AS usd FROM public.jobs_ledger_materials m WHERE m.job_id IN (SELECT id FROM jobs) GROUP BY m.job_id
  ),
  -- The money budget, as the Costs tab's Burn reads it (`budgetForBurn`): the baseline's direct cost only when it stands for
  -- the whole job, with a labor figure and a materials figure, since a driving-only snapshot is a component and not a budget
  -- (v2.3847); else the price at the Burn default of 35% margin (`JOB_BURN_DEFAULT_TARGET_MARGIN_PCT`). One company figure,
  -- so no device's own target moves the number.
  budgets AS (
    SELECT b.job_id, b.kind, b.labor_hours, b.planned_finish,
      CASE WHEN b.kind IN ('bid', 'typed') AND COALESCE(b.labor_usd, 0) > 0 AND COALESCE(b.materials_usd, 0) > 0 THEN
        COALESCE(NULLIF(b.total_direct_usd, 0), COALESCE(b.labor_usd, 0) + COALESCE(b.materials_usd, 0) + COALESCE(b.subs_usd, 0) + COALESCE(b.other_usd, 0))
      END AS direct_usd
    FROM public.job_budgets b WHERE b.job_id IN (SELECT id FROM jobs)
  ),
  line_prices AS (
    SELECT f.job_id, SUM(GREATEST(0, COALESCE(f.line_unit_price, 0) * CASE WHEN COALESCE(f.count, 0) = 0 THEN 1 ELSE f.count END)) AS usd
    FROM public.jobs_ledger_fixtures f
    WHERE f.job_id IN (SELECT id FROM jobs) AND f.line_kind IS DISTINCT FROM 'discount'
    GROUP BY f.job_id
  ),
  fixture_rows AS (
    SELECT f.job_id, jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'stage_kind', f.stage_kind, 'line_kind', f.line_kind, 'line_unit_price', f.line_unit_price,
      'count', f.count, 'progress_pct', f.progress_pct, 'sequence_order', f.sequence_order,
      'budget_labor_pct', f.budget_labor_pct, 'budget_materials_pct', f.budget_materials_pct, 'budget_source', f.budget_source,
      'budget_tuned_at', f.budget_tuned_at, 'budget_rate_usd', f.budget_rate_usd
    ) ORDER BY f.sequence_order, f.id) AS rows
    FROM public.jobs_ledger_fixtures f WHERE f.job_id IN (SELECT id FROM jobs) GROUP BY f.job_id
  ),
  labor_rows AS (
    SELECT job_id, jsonb_agg(jsonb_build_object('ymd', work_date, 'who', person_name, 'hours', round(hours, 2)) ORDER BY work_date, person_name) AS rows
    FROM person_days WHERE hours > 0 GROUP BY job_id
  ),
  -- The percents a day's card names: a report's own, parsed as `tryParsePercent0to100`, and the office's hand-set ones.
  value_rows AS (
    SELECT v.job_id, jsonb_agg(jsonb_build_object('ymd', v.ymd, 'pct', v.pct, 'kind', v.kind) ORDER BY v.ymd) AS rows
    FROM (
      SELECT r.job_ledger_id AS job_id, (r.created_at AT TIME ZONE 'America/Chicago')::date AS ymd,
        substring(btrim(COALESCE(r.field_values->>'How complete is the job?', r.field_values->>'Who was on the job?')) FROM '^[0-9]{1,3}(?![0-9])')::int AS pct,
        'report' AS kind
      FROM public.reports r WHERE r.job_ledger_id IN (SELECT id FROM jobs)
      UNION ALL
      SELECT e.job_id, (e.changed_at AT TIME ZONE 'America/Chicago')::date, e.pct, 'manual'
      FROM public.job_pct_events e WHERE e.job_id IN (SELECT id FROM jobs) AND e.source = 'manual'
    ) v
    WHERE v.pct BETWEEN 0 AND 100
    GROUP BY v.job_id
  ),
  spent AS (
    SELECT j.id AS job_id,
      COALESCE(t.usd, 0) + COALESCE(s.usd, 0) + COALESCE(c.usd, 0) + COALESCE(sh.usd, 0) + COALESCE(ta.usd, 0) + COALESCE(bi.usd, 0) AS usd,
      COALESCE(bu.direct_usd, (CASE WHEN j.revenue > 0 THEN j.revenue WHEN lp.usd > 0 THEN lp.usd END) * (1 - 35 / 100.0)) AS budget_usd
    FROM jobs j
    LEFT JOIN team t ON t.job_id = j.id
    LEFT JOIN subs s ON s.job_id = j.id
    LEFT JOIN cards c ON c.job_id = j.id
    LEFT JOIN supply sh ON sh.job_id = j.id
    LEFT JOIN tally ta ON ta.job_id = j.id
    LEFT JOIN billed bi ON bi.job_id = j.id
    LEFT JOIN budgets bu ON bu.job_id = j.id
    LEFT JOIN line_prices lp ON lp.job_id = j.id
  )
  SELECT jsonb_build_object(
    -- Whether this viewer's own read of a day carries wages: the client asks for the day's dollars only then.
    'reads_wages', public.has_payroll_access(),
    'jobs', COALESCE(jsonb_agg(jsonb_build_object(
      'id', j.id, 'hcp_number', j.hcp_number, 'click_number', j.click_number, 'job_name', j.job_name, 'job_address', j.job_address,
      'status', j.status, 'pct_complete', j.pct_complete, 'revenue', j.revenue,
      -- The facts the job's kind reads beside its number, its price and its lines, for the board's gate (`jobKindOfRow`).
      'kind', j.kind, 'bid_id', j.bid_id, 'project_id', j.project_id, 'first_work_date', j.first_work_date, 'billing_only', j.billing_only,
      'budget_kind', bu.kind, 'budget_hours', bu.labor_hours,
      -- The planned finish frozen at award (punch list #234 PR 2): the line reads days against it.
      'planned_finish', bu.planned_finish,
      'fixtures', COALESCE(fr.rows, '[]'::jsonb),
      'labor', COALESCE(lr.rows, '[]'::jsonb),
      'values', COALESCE(vr.rows, '[]'::jsonb),
      -- The blended spend as a whole percent of the money budget, the only money that leaves this function.
      'spent_pct', CASE WHEN sp.budget_usd > 0 THEN round(100 * sp.usd / sp.budget_usd)::int END
    )), '[]'::jsonb)
  )
  INTO v_out
  FROM jobs j
  LEFT JOIN budgets bu ON bu.job_id = j.id
  LEFT JOIN fixture_rows fr ON fr.job_id = j.id
  LEFT JOIN labor_rows lr ON lr.job_id = j.id
  LEFT JOIN value_rows vr ON vr.job_id = j.id
  LEFT JOIN spent sp ON sp.job_id = j.id;

  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.list_project_board(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_project_board(uuid[]) TO authenticated;
