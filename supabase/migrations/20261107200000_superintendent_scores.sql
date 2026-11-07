SET lock_timeout = '3s';

-- The scoreboard (punch list #234, PR 4), on the owner's three calls of 2026-11-07: certified is the office's own
-- sign-off on the percent; the bonus is paid on hours saved, as a share of the labor kept; a stage a sub performs
-- counts on the sub's sheet hours. One read computes every superintendent's score for a period, inside the
-- database, so no wage leaves it for a role that may not read wages:
--
--   superintendent_scores(p_from date, p_to date, p_job_ids uuid[] DEFAULT NULL) → jsonb
--     For every project with an award (job_budgets.awarded_at) whose superintendent is known
--     (project_superintendents through the job's project, or gc_projects.superintendent_user_id), one row per
--     superintendent per job:
--       the certified percent — the newest jobs_ledger.pct_complete change by an office role (dev, master
--         technician, assistant, controller) on or before p_to, with its day; the crew's own percent stays
--         provisional and is never scored;
--       the award's hours and labor dollars (awarded_labor_hours, awarded_labor_usd), the kind that scores
--         (bid and typed; a book award is a guess and is not scored, read as such);
--       the team's hours and dollars at the burden factor (people_crew_jobs × people_hours_recorded ×
--         people_pay_config, as list_project_board reads them, × app_settings.labor_burden_factor_v1), and the
--         subs' sheet hours and dollars (people_labor_job_items, hours × rate or the direct amount, the drive aside);
--       labor earned = awarded labor dollars × certified percent; labor kept = earned − team − subs; hours under
--         = awarded hours × certified percent − team hours − sub hours; the planned finish frozen at award.
--     The dollars (earned, actual, kept) come back only to a caller with payroll access; the caller's own rows carry
--     the bonus alone — labor kept × the share in app_settings.superintendent_bonus_v1 — when it is positive.
--   app_settings.superintendent_bonus_v1 — {"sharePct": 10, "period": "month", "paidAt": "office_signoff"}; the owner
--     writes it through a key-scoped UPDATE policy, as the line budget settings are.
--
-- SECURITY DEFINER: the superintendent's RLS shows him no job_budgets row and no crew row, and the office's shows no
-- wage without payroll access; the function reads them all and lets out only what the caller may see.
-- Additive, idempotent. docs/migrations/20261107200000_superintendent_scores.md.

INSERT INTO public.app_settings (key, value_text)
VALUES ('superintendent_bonus_v1', '{"sharePct":10,"period":"month","paidAt":"office_signoff"}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_superintendent_bonus" ON public.app_settings;
CREATE POLICY "master_or_dev_update_superintendent_bonus"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'superintendent_bonus_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'superintendent_bonus_v1' AND public.is_master_or_dev());

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

  WITH awarded AS MATERIALIZED (
    SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.status, j.project_id,
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
    SELECT s.user_id, a.id AS job_id, a.hcp_number, a.click_number, a.job_name, a.status,
      a.awarded_kind, a.awarded_at, a.planned_finish,
      COALESCE(a.awarded_labor_hours, 0) AS awarded_hours, COALESCE(a.awarded_labor_usd, 0) AS awarded_usd,
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
      r.awarded_usd * COALESCE(r.certified_pct, 0) / 100.0 AS earned_usd,
      r.team_usd + r.sub_usd AS actual_usd,
      r.awarded_usd * COALESCE(r.certified_pct, 0) / 100.0 - (r.team_usd + r.sub_usd) AS kept_usd,
      r.awarded_hours * COALESCE(r.certified_pct, 0) / 100.0 - (r.team_hours + r.sub_hours) AS hours_under
    FROM rows r
  )
  SELECT jsonb_build_object(
    'reads_wages', v_wages,
    'share_pct', v_share,
    'burden', v_burden,
    'from', p_from,
    'to', p_to,
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', s.user_id, 'user_name', u.name,
      'job_id', s.job_id, 'hcp_number', s.hcp_number, 'click_number', s.click_number, 'job_name', s.job_name, 'status', s.status,
      'awarded_kind', s.awarded_kind, 'awarded_at', s.awarded_at, 'planned_finish', s.planned_finish,
      'awarded_hours', round(s.awarded_hours, 1),
      'certified_pct', s.certified_pct, 'signed_on', s.signed_on, 'signed_by', s.signed_by,
      'team_hours', round(s.team_hours, 1), 'sub_hours', round(s.sub_hours, 1),
      'hours_under', CASE WHEN s.scored THEN round(s.hours_under, 1) END,
      'scored', s.scored, 'signed_in_period', s.signed_in_period,
      -- The dollars leave only for payroll access; the caller's own bonus leaves alone.
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
  'Punch list #234 PR 4: every superintendent''s score for a period — the office''s sign-off as the certified percent, the award''s hours and labor dollars, the team at the burden factor and the subs on their sheet hours, labor kept and hours under; the dollars only to payroll access, a caller''s own bonus alone. SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.superintendent_scores(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.superintendent_scores(date, date, uuid[]) TO authenticated;
