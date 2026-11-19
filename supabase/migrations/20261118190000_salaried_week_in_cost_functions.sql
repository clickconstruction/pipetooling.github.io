SET lock_timeout = '3s';

-- The salaried week in the cost functions (v2.7840): the five functions that carried the flat 8 read the person's week.
--
-- A salaried person was costed as 8 hours on a weekday and nothing on a weekend, and each of these functions wrote
-- that rule out for itself. They now ask salaried_hours_on for the day's hours in the person's own week
-- (people_pay_config.salaried_week_hours, the migration before this one), so the rule lives once:
--
--   get_man_hours_by_job                the man-hours on each job
--   keep_job_baseline                   the labor a job's baseline keeps
--   list_project_board                  the labor on the project board
--   superintendent_scores               the labor behind the superintendent scores
--   get_weekly_money_movement_payload   crew labor on bids and on jobs, two places
--
-- Each body is the newest one on file, copied by a script, with the salaried rule alone changed and, where a
-- function reads the pay row through a named list of columns, the week added to that list. Nothing else moves.
--
-- list_people_pay_flags, which hands the office the pay flags without the wages, returns the week as a last column,
-- so the app's own cost readers can see it.
--
-- Every pay row reads 8 hours on the five weekdays, so every function answers exactly what it answered before until
-- a week is set. No screen sets one yet.

-- get_man_hours_by_job: the body of 20260927233000_controller_functions_the_rest.sql, the salaried rule alone changed.
CREATE OR REPLACE FUNCTION public.get_man_hours_by_job()
 RETURNS TABLE(job_id text, person_name text, man_hours numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'get_man_hours_by_job: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'get_man_hours_by_job: not allowed';
  END IF;
  RETURN QUERY
  with crew as (
    select
      cj.work_date,
      cj.person_name,
      jsonb_array_elements(
        case when jsonb_typeof(cj.job_assignments) = 'array'
             then cj.job_assignments
             else '[]'::jsonb end
      ) as assignment
    from people_crew_jobs cj
  ),
  alloc as (
    select
      (c.assignment->>'job_id') as jid,
      c.person_name as pname,
      (case
         when coalesce(pc.is_salary, false)
           then public.salaried_hours_on(pc.salaried_week_hours, c.work_date::date)
         else coalesce(ph.hours, 0)
       end) * (coalesce(nullif(c.assignment->>'pct', '')::numeric, 0) / 100.0) as alloc_hours
    from crew c
    left join people_pay_config pc on pc.person_name = c.person_name
    -- v2.3179: recorded time (approved + awaiting approval), was people_hours.
    left join people_hours_recorded ph
      on ph.person_name = c.person_name
     and ph.work_date = c.work_date
     and ph.work_date >= (current_date - interval '2 years')
    where coalesce(c.assignment->>'job_id', '') <> ''
  )
  select a.jid, a.pname, sum(a.alloc_hours) as man_hours
  from alloc a
  group by a.jid, a.pname
  having sum(a.alloc_hours) > 0;
END $function$;

-- keep_job_baseline: the body of 20260916190000_card_refunds_net_sql_readers.sql, the salaried rule alone changed.
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
                 THEN public.salaried_hours_on(pc.salaried_week_hours, c.work_date::date)
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

-- list_project_board: the body of 20261107190500_project_board_planned_finish.sql, the salaried rule alone changed.
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
  pay_by_id AS (SELECT DISTINCT ON (person_id) person_id, is_salary, hourly_wage, salaried_week_hours FROM public.people_pay_config WHERE person_id IS NOT NULL ORDER BY person_id, person_name),
  pay_by_name AS (SELECT DISTINCT ON (person_name) person_name, is_salary, hourly_wage, salaried_week_hours FROM public.people_pay_config ORDER BY person_name),
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
          THEN public.salaried_hours_on(COALESCE(pi.salaried_week_hours, pn.salaried_week_hours), a.work_date::date)
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

-- superintendent_scores: the body of 20261109063000_superintendent_scores_rate_window.sql, the salaried rule alone changed.
CREATE OR REPLACE FUNCTION public.superintendent_scores(p_from date, p_to date, p_job_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := (SELECT auth.uid());
  v_role text;
  v_wages boolean;
  v_share numeric;
  v_burden numeric;
  v_office uuid;
  v_roster_hours numeric;
  v_roster_usd numeric;
  v_rate numeric;
  v_out jsonb;
BEGIN
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_me;
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent') THEN
    RAISE EXCEPTION 'The scoreboard is for the office and the superintendents' USING ERRCODE = '42501';
  END IF;
  v_wages := public.has_payroll_access();
  SELECT COALESCE(NULLIF((value_text::jsonb->>'sharePct'), '')::numeric, 10) INTO v_share FROM public.app_settings WHERE key = 'superintendent_bonus_v1';
  v_share := COALESCE(v_share, 10);
  SELECT COALESCE(value_num, 1.2) INTO v_burden FROM public.app_settings WHERE key = 'labor_burden_factor_v1';
  v_burden := LEAST(3, GREATEST(1, COALESCE(v_burden, 1.2)));

  -- The roster's loaded rate (the owner's fourth call): recorded field sessions — clocked out, not rejected or revoked,
  -- on a job other than the office job — over the 90 days ending p_to or today, whichever is first, each priced at the person's field wage
  -- (people_pay_config.hourly_wage by the person's id through people.account_user_id, else by name), the hours counted
  -- whether or not a wage was found, as the day ledger counts them; Σ$ ÷ Σh × the burden factor.
  SELECT value_text::uuid INTO v_office FROM public.app_settings
   WHERE key = 'overhead_office_job_ledger_id_v1' AND value_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  WITH pay_by_id AS (SELECT DISTINCT ON (person_id) person_id, hourly_wage FROM public.people_pay_config WHERE person_id IS NOT NULL ORDER BY person_id, person_name),
  pay_by_name AS (SELECT DISTINCT ON (lower(trim(person_name))) lower(trim(person_name)) AS key, hourly_wage FROM public.people_pay_config ORDER BY lower(trim(person_name)), person_name),
  person_of_user AS (SELECT DISTINCT ON (account_user_id) account_user_id, id AS person_id FROM public.people WHERE account_user_id IS NOT NULL ORDER BY account_user_id, id),
  field AS (
    SELECT EXTRACT(EPOCH FROM (s.clocked_out_at - s.clocked_in_at)) / 3600.0 AS hours,
      COALESCE(pi.hourly_wage, pn.hourly_wage, 0) AS wage
    FROM public.clock_sessions s
    JOIN public.users u ON u.id = s.user_id
    LEFT JOIN person_of_user pu ON pu.account_user_id = s.user_id
    LEFT JOIN pay_by_id pi ON pi.person_id = pu.person_id
    LEFT JOIN pay_by_name pn ON pn.key = lower(trim(u.name))
    WHERE s.job_ledger_id IS NOT NULL AND (v_office IS NULL OR s.job_ledger_id <> v_office)
      AND s.clocked_out_at IS NOT NULL AND s.rejected_at IS NULL AND s.revoked_at IS NULL
      AND s.clocked_out_at > s.clocked_in_at
      -- The window ends today for the current month (the Labor tab's own 90 days) and at a past period's own end.
      AND s.work_date BETWEEN LEAST(p_to, public.app_today()) - 90 AND LEAST(p_to, public.app_today())
  )
  SELECT COALESCE(SUM(hours), 0), COALESCE(SUM(hours * wage), 0) INTO v_roster_hours, v_roster_usd FROM field;
  v_rate := CASE WHEN v_roster_hours > 0 AND v_roster_usd > 0 THEN round(v_roster_usd / v_roster_hours * v_burden, 4) END;

  WITH awarded AS MATERIALIZED (
    SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.status, j.project_id, NULLIF(j.revenue, 0) AS price_usd,
      b.awarded_kind, b.awarded_labor_hours, b.awarded_labor_usd, b.awarded_at, b.planned_finish
    FROM public.jobs_ledger j
    JOIN public.job_budgets b ON b.job_id = j.id AND b.awarded_at IS NOT NULL
    WHERE CASE WHEN p_job_ids IS NULL THEN j.status IN ('working', 'ready_to_bill', 'billed', 'paid') ELSE j.id = ANY (p_job_ids) END
  ),
  -- Who runs each job: the project's superintendents, else the GC project's one.
  supers AS (
    SELECT a.id AS job_id, ps.superintendent_id AS user_id
    FROM awarded a JOIN public.project_superintendents ps ON ps.project_id = a.project_id
    UNION
    SELECT a.id, gp.superintendent_user_id
    FROM awarded a JOIN public.gc_projects gp ON gp.project_id = a.project_id AND gp.superintendent_user_id IS NOT NULL
  ),
  -- The office's sign-off: the newest percent set by an office role on or before the period's end.
  signoff AS (
    SELECT DISTINCT ON (e.job_id) e.job_id, e.pct, (e.changed_at AT TIME ZONE 'America/Chicago')::date AS signed_on, u.name AS signed_by
    FROM public.job_pct_events e
    JOIN public.users u ON u.id = e.changed_by_user_id AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    WHERE e.job_id IN (SELECT id FROM awarded) AND e.source = 'manual' AND (e.changed_at AT TIME ZONE 'America/Chicago')::date <= p_to
    ORDER BY e.job_id, e.changed_at DESC
  ),
  -- Team labor to the period's end, as list_project_board reads it, at the burden factor.
  assignments AS (
    SELECT c.person_name, c.person_id, c.work_date, (a->>'job_id')::uuid AS job_id, COALESCE((a->>'pct')::numeric, 0) AS pct
    FROM public.people_crew_jobs c
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.job_assignments) = 'array' THEN c.job_assignments ELSE '[]'::jsonb END) a
    WHERE (a->>'job_id')::uuid IN (SELECT id FROM awarded) AND c.work_date <= p_to
  ),
  recorded AS MATERIALIZED (
    SELECT r.person_name, r.person_id, r.work_date, r.hours
    FROM public.people_hours_recorded r
    WHERE r.work_date IN (SELECT DISTINCT work_date FROM assignments)
  ),
  recorded_by_id AS (SELECT person_id, work_date, MAX(hours) AS hours FROM recorded WHERE person_id IS NOT NULL GROUP BY 1, 2),
  recorded_by_name AS (SELECT person_name, work_date, MAX(hours) AS hours FROM recorded GROUP BY 1, 2),
  pay_by_id AS (SELECT DISTINCT ON (person_id) person_id, is_salary, hourly_wage, salaried_week_hours FROM public.people_pay_config WHERE person_id IS NOT NULL ORDER BY person_id, person_name),
  pay_by_name AS (SELECT DISTINCT ON (person_name) person_name, is_salary, hourly_wage, salaried_week_hours FROM public.people_pay_config ORDER BY person_name),
  team AS (
    SELECT a.job_id,
      SUM(d.day_hours * a.pct / 100) AS hours,
      SUM(d.day_hours * a.pct / 100 * d.rate) * v_burden AS usd
    FROM assignments a
    LEFT JOIN pay_by_id pi ON pi.person_id = a.person_id
    LEFT JOIN pay_by_name pn ON pn.person_name = a.person_name
    LEFT JOIN recorded_by_id ri ON ri.person_id = a.person_id AND ri.work_date = a.work_date
    LEFT JOIN recorded_by_name rn ON rn.person_name = a.person_name AND rn.work_date = a.work_date
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN COALESCE(pi.is_salary, pn.is_salary, false)
          THEN public.salaried_hours_on(COALESCE(pi.salaried_week_hours, pn.salaried_week_hours), a.work_date::date)
          ELSE COALESCE(ri.hours, rn.hours, 0)
        END AS day_hours,
        COALESCE(pi.hourly_wage, pn.hourly_wage, 0) AS rate
    ) d
    GROUP BY a.job_id
  ),
  -- The subs' sheets: hours and dollars from the items (the owner's call: a sub-performed stage counts on the sheet hours).
  sub_books AS (
    SELECT plj.id, plj.job_ledger_id AS job_id, COALESCE(plj.labor_rate, 0) AS job_rate
    FROM public.people_labor_jobs plj WHERE plj.job_ledger_id IN (SELECT id FROM awarded) AND (plj.job_date IS NULL OR plj.job_date <= p_to)
  ),
  subs AS (
    SELECT b.job_id,
      COALESCE(SUM(CASE WHEN i.direct_labor_amount IS NULL THEN (CASE WHEN COALESCE(i.is_fixed, false) THEN COALESCE(i.hrs_per_unit, 0) ELSE COALESCE(i.count, 0) * COALESCE(i.hrs_per_unit, 0) END) ELSE 0 END), 0) AS hours,
      COALESCE(SUM(COALESCE(i.direct_labor_amount,
        (CASE WHEN COALESCE(i.is_fixed, false) THEN COALESCE(i.hrs_per_unit, 0) ELSE COALESCE(i.count, 0) * COALESCE(i.hrs_per_unit, 0) END) * COALESCE(i.labor_rate, b.job_rate))), 0) AS usd
    FROM sub_books b LEFT JOIN public.people_labor_job_items i ON i.job_id = b.id
    GROUP BY b.job_id
  ),
  rows AS (
    SELECT s.user_id, a.id AS job_id, a.hcp_number, a.click_number, a.job_name, a.status, a.price_usd,
      a.awarded_kind, a.awarded_at, a.planned_finish,
      COALESCE(a.awarded_labor_hours, 0) AS awarded_hours, COALESCE(a.awarded_labor_usd, 0) AS awarded_usd,
      -- The rate that prices this row's labor kept: the roster's, else the award's own (the bid's price of the labor).
      COALESCE(v_rate, CASE WHEN COALESCE(a.awarded_labor_hours, 0) > 0 THEN COALESCE(a.awarded_labor_usd, 0) / a.awarded_labor_hours END, 0) AS rate_usd,
      so.pct AS certified_pct, so.signed_on, so.signed_by,
      COALESCE(t.hours, 0) AS team_hours, COALESCE(t.usd, 0) AS team_usd,
      COALESCE(su.hours, 0) AS sub_hours, COALESCE(su.usd, 0) AS sub_usd,
      (a.awarded_kind IN ('bid', 'typed') AND COALESCE(a.awarded_labor_hours, 0) > 0 AND so.pct IS NOT NULL) AS scored,
      (so.signed_on IS NOT NULL AND so.signed_on BETWEEN p_from AND p_to) AS signed_in_period
    FROM supers s
    JOIN awarded a ON a.id = s.job_id
    LEFT JOIN signoff so ON so.job_id = a.id
    LEFT JOIN team t ON t.job_id = a.id
    LEFT JOIN subs su ON su.job_id = a.id
  ),
  scored AS (
    SELECT r.*,
      r.awarded_hours * COALESCE(r.certified_pct, 0) / 100.0 * r.rate_usd AS earned_usd,
      r.team_usd + r.sub_usd AS actual_usd,
      r.awarded_hours * COALESCE(r.certified_pct, 0) / 100.0 * r.rate_usd - (r.team_usd + r.sub_usd) AS kept_usd,
      r.awarded_hours * COALESCE(r.certified_pct, 0) / 100.0 - (r.team_hours + r.sub_hours) AS hours_under
    FROM rows r
  )
  SELECT jsonb_build_object(
    'reads_wages', v_wages,
    'share_pct', v_share,
    'burden', v_burden,
    'from', p_from,
    'to', p_to,
    -- The roster's loaded rate the labor kept is priced at; to payroll access alone, as a wage. Null = none in the window.
    'rate_usd', CASE WHEN v_wages THEN v_rate END,
    'rate_source', CASE WHEN v_rate IS NOT NULL THEN 'roster' ELSE 'award' END,
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', s.user_id, 'user_name', u.name,
      'job_id', s.job_id, 'hcp_number', s.hcp_number, 'click_number', s.click_number, 'job_name', s.job_name, 'status', s.status,
      'price_usd', s.price_usd,
      'awarded_kind', s.awarded_kind, 'awarded_at', s.awarded_at, 'planned_finish', s.planned_finish,
      'awarded_hours', round(s.awarded_hours, 1),
      'certified_pct', s.certified_pct, 'signed_on', s.signed_on, 'signed_by', s.signed_by,
      'team_hours', round(s.team_hours, 1), 'sub_hours', round(s.sub_hours, 1),
      'hours_under', CASE WHEN s.scored THEN round(s.hours_under, 1) END,
      'scored', s.scored, 'signed_in_period', s.signed_in_period,
      -- The dollars leave only for payroll access; the caller's own bonus leaves alone.
      'awarded_usd', CASE WHEN v_wages THEN round(s.awarded_usd, 2) END,
      'rate_usd', CASE WHEN v_wages THEN round(s.rate_usd, 2) END,
      'earned_usd', CASE WHEN v_wages THEN round(s.earned_usd, 2) END,
      'actual_usd', CASE WHEN v_wages THEN round(s.actual_usd, 2) END,
      'kept_usd', CASE WHEN v_wages THEN round(s.kept_usd, 2) END,
      'bonus_usd', CASE WHEN s.scored AND (v_wages OR s.user_id = v_me) THEN round(GREATEST(0, s.kept_usd) * v_share / 100.0, 2) END
    ) ORDER BY u.name, s.awarded_at), '[]'::jsonb)
  )
  INTO v_out
  FROM scored s
  JOIN public.users u ON u.id = s.user_id
  WHERE v_wages OR v_role IN ('dev', 'master_technician', 'assistant', 'controller') OR s.user_id = v_me;

  RETURN v_out;
END;
$$;

-- get_weekly_money_movement_payload: the body of 20261109003500_dev_gates_pipeline_money.sql, the salaried rule alone changed.
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
          THEN public.salaried_hours_on(cfg.salaried_week_hours, pb.work_date::date)
        ELSE COALESCE(ph.hours, 0)
      END AS day_hours,
      COALESCE(cfg.hourly_wage, 0) AS wage
    FROM public.people_crew_bids pb
    LEFT JOIN LATERAL (
      SELECT p.hourly_wage, p.is_salary, p.salaried_week_hours
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
          THEN public.salaried_hours_on(cfg.salaried_week_hours, pc.work_date::date)
        ELSE COALESCE(ph.hours, 0)
      END AS day_hours,
      COALESCE(cfg.hourly_wage, 0) AS wage
    FROM public.people_crew_jobs pc
    LEFT JOIN LATERAL (
      SELECT p.hourly_wage, p.is_salary, p.salaried_week_hours
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

-- list_people_pay_flags: the body of 20261116070000_scores_reads_as_service_role.sql with the week as a last column. A function's returned columns cannot be
-- changed in place, so it is dropped and made again inside this migration's one transaction, as 20260715120000 did.
-- It carried no grants of its own then or since, so it takes the schema's defaults again.
DROP FUNCTION IF EXISTS public.list_people_pay_flags();
CREATE FUNCTION public.list_people_pay_flags()
 RETURNS TABLE(person_name text, person_id uuid, is_salary boolean, record_hours_but_salary boolean, show_in_hours boolean, salaried_week_hours numeric[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- The service role (the team scores' edge function): every flag, as it reads the table itself.
  IF auth.role() = 'service_role' AND auth.uid() IS NULL THEN
    RETURN QUERY
      SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
             pc.show_in_hours, pc.salaried_week_hours::numeric[]
      FROM public.people_pay_config pc;
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN; -- was RAISE: unauthenticated boot races get empty rows, not log spam
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant','controller')
  ) THEN
    RETURN; -- was RAISE: field roles get empty rows (flags stay office-only)
  END IF;
  RETURN QUERY
    SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
           pc.show_in_hours, pc.salaried_week_hours::numeric[]
    FROM public.people_pay_config pc;
END $function$;
