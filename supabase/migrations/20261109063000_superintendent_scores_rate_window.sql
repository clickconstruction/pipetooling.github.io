SET lock_timeout = '3s';

-- Punch list #234, after 20261109040000 (v2.6779): the roster's loaded rate read its 90 days up to the period's end,
-- so for the current month the window ran from the 1st of the month before to a day not yet come, while Bids → Labor
-- and Settings → Line budgets read today's last 90 days, and the two cards showed two figures on the same day. The
-- window now ends at LEAST(p_to, public.app_today()): the current month prices at the number those cards show, a past month
-- at its own end. Nothing else moves; CREATE OR REPLACE from the newest definition, same signature.
-- docs/migrations/20261109063000_superintendent_scores_rate_window.md.

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
  pay_by_id AS (SELECT DISTINCT ON (person_id) person_id, is_salary, hourly_wage FROM public.people_pay_config WHERE person_id IS NOT NULL ORDER BY person_id, person_name),
  pay_by_name AS (SELECT DISTINCT ON (person_name) person_name, is_salary, hourly_wage FROM public.people_pay_config ORDER BY person_name),
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
          THEN CASE WHEN EXTRACT(ISODOW FROM a.work_date) BETWEEN 1 AND 5 THEN 8 ELSE 0 END
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

COMMENT ON FUNCTION public.superintendent_scores(date, date, uuid[]) IS
  'Punch list #234 PR 4 + the owner''s calls of 2026-11-09: every superintendent''s score for a period — the office''s sign-off as the certified percent, the award''s hours priced at the roster''s loaded rate (90 days of field wages × burden; the award''s own rate when the roster has none), the team at the burden factor and the subs on their sheet hours, labor kept and hours under, the job''s price for the client''s $2,500 floor; the dollars only to payroll access, a caller''s own bonus alone. SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.superintendent_scores(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.superintendent_scores(date, date, uuid[]) TO authenticated;
