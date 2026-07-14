-- Assistant pay lockdown (Phase 1 of the pay-visibility overhaul; RECENT_FEATURES v2.660).
--
-- Principle: assistants manage clock cards and hours, but must never be able to read how much
-- an individual makes — regardless of whether they assist a pay-approved master. This migration
-- closes the DB-level paths (the UI already hid most of them):
--   1. has_payroll_access() capability function (dev + pay-approved masters today; the planned
--      'controller' role joins here later, so policies below never need touching again).
--   2. people_pay_config: drop the blanket assistant SELECT policy (own-row / cost-matrix-share /
--      pay-master policies remain).
--   3. Pay-stub family + person_offsets: has_payroll_access() only (previously
--      is_assistant_of_pay_approved_master() let Taunya read AND write pay stubs via the API,
--      and person_offsets was readable by ALL assistants).
--   4. hours_reviewed / hours_days_correct: clock-management markers, not pay — pay masters +
--      all assistants (decision 2026-07-14).
--   5. list_people_pay_flags(): SECURITY DEFINER, non-wage columns only — keeps the Hours /
--      Quickfill / Crew rosters and salaried-hours logic working for assistants.
--   6. get_dashboard_payroll_totals(): SECURITY DEFINER aggregate totals for the Dashboard AP
--      card — assistants keep org-level totals, never per-person rows. Mirrors the client
--      kernels (stubNetPay / buildApBucket / buildUpcomingPayrollSummary) exactly.
--   7. get_man_hours_by_job(): now SECURITY DEFINER so salaried is_salary credit survives the
--      pay-config lockdown (returns hours only — no dollars).
--   8. cost_matrix_teams_shares: trigger restricting grantees to dev/master (decision 2026-07-14;
--      the matrix exposes wage-derived numbers, so assistants can never be granted it).

-- 1) Capability function ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_payroll_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_pay_approved_master();  -- is_dev() is included by is_pay_approved_master()
$$;

COMMENT ON FUNCTION public.has_payroll_access() IS
  'Who may read/write individual pay data (wages, pay stubs, offsets). Dev + pay-approved masters; the controller role joins here in Phase 3. Assistants are deliberately excluded — see 20260714120000.';

-- 2) people_pay_config: assistants lose bulk SELECT -------------------------------------------

DROP POLICY IF EXISTS "Assistants can read people pay config for Hours tab" ON public.people_pay_config;

-- 3) Pay-stub family + person_offsets → has_payroll_access() ----------------------------------

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pay_stubs','pay_stub_days','pay_stub_payments','pay_stub_deductions','pay_stub_additional_lines']) LOOP
    FOR p IN
      SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND (qual ILIKE '%is_assistant_of_pay_approved_master%' OR with_check ILIKE '%is_assistant_of_pay_approved_master%')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      IF p.cmd = 'SELECT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.has_payroll_access())', p.policyname, t);
      ELSIF p.cmd = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.has_payroll_access())', p.policyname, t);
      ELSIF p.cmd = 'UPDATE' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (public.has_payroll_access()) WITH CHECK (public.has_payroll_access())', p.policyname, t);
      ELSIF p.cmd = 'DELETE' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (public.has_payroll_access())', p.policyname, t);
      END IF;
    END LOOP;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Pay access users can manage person offsets" ON public.person_offsets;
CREATE POLICY "Pay access users can manage person offsets" ON public.person_offsets
  FOR ALL USING (public.has_payroll_access()) WITH CHECK (public.has_payroll_access());

-- 4) Hours-review markers: pay masters + all assistants ---------------------------------------

DROP POLICY IF EXISTS "Pay access users can manage hours_reviewed" ON public.hours_reviewed;
CREATE POLICY "Pay access users can manage hours_reviewed" ON public.hours_reviewed
  FOR ALL USING (public.has_payroll_access() OR public.is_assistant())
  WITH CHECK (public.has_payroll_access() OR public.is_assistant());

DROP POLICY IF EXISTS "Pay access users can read hours days correct" ON public.hours_days_correct;
CREATE POLICY "Pay access users can read hours days correct" ON public.hours_days_correct
  FOR SELECT USING (public.has_payroll_access() OR public.is_assistant());
DROP POLICY IF EXISTS "Pay access users can insert hours days correct" ON public.hours_days_correct;
CREATE POLICY "Pay access users can insert hours days correct" ON public.hours_days_correct
  FOR INSERT WITH CHECK (public.has_payroll_access() OR public.is_assistant());
DROP POLICY IF EXISTS "Pay access users can delete hours days correct" ON public.hours_days_correct;
CREATE POLICY "Pay access users can delete hours days correct" ON public.hours_days_correct
  FOR DELETE USING (public.has_payroll_access() OR public.is_assistant());

-- 5) Non-wage pay-config flags for staff surfaces ----------------------------------------------

CREATE OR REPLACE FUNCTION public.list_people_pay_flags()
RETURNS TABLE(
  person_name text,
  person_id uuid,
  is_salary boolean,
  record_hours_but_salary boolean,
  show_in_hours boolean,
  show_in_cost_matrix boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_people_pay_flags: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant')
  ) THEN
    RAISE EXCEPTION 'list_people_pay_flags: not allowed';
  END IF;
  RETURN QUERY
    SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
           pc.show_in_hours, pc.show_in_cost_matrix
    FROM public.people_pay_config pc;
END $$;

COMMENT ON FUNCTION public.list_people_pay_flags() IS
  'Non-wage pay-config flags for Hours/Quickfill/Crew rosters and salaried-hours logic. Deliberately excludes hourly_wage/office_hourly_wage — assistants must not read wages (20260714120000).';

-- 6) Dashboard AP payroll totals (org-level aggregates; no per-person rows) --------------------

CREATE OR REPLACE FUNCTION public.get_dashboard_payroll_totals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  due_total numeric := 0;
  due_count int := 0;
  upcoming_total numeric := 0;
  upcoming_count int := 0;
  today date := (now() AT TIME ZONE 'America/Chicago')::date;
  current_week date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'get_dashboard_payroll_totals: not authenticated';
  END IF;
  IF NOT (public.has_payroll_access() OR public.is_assistant()) THEN
    RAISE EXCEPTION 'get_dashboard_payroll_totals: not allowed';
  END IF;

  -- Due: mirrors stubNetPay + buildApBucket — per stub, round2(max(gross - deductions + additional, 0)) - paid, > 0.005.
  SELECT COALESCE(sum(remaining), 0), count(*)
    INTO due_total, due_count
  FROM (
    SELECT GREATEST(
             ROUND(GREATEST(COALESCE(s.gross_pay, 0)
               - COALESCE((SELECT sum(d.amount) FROM public.pay_stub_deductions d WHERE d.pay_stub_id = s.id), 0)
               + COALESCE((SELECT sum(a.line_total) FROM public.pay_stub_additional_lines a WHERE a.pay_stub_id = s.id), 0), 0)::numeric, 2)
             - COALESCE((SELECT sum(p.amount) FROM public.pay_stub_payments p WHERE p.pay_stub_id = s.id), 0),
             0) AS remaining
    FROM public.pay_stubs s
  ) x
  WHERE x.remaining > 0.005;

  -- Upcoming: mirrors buildUpcomingPayrollSummary (Sunday pay weeks; from the week after each
  -- person's last stub end, stub-less capped 8 weeks back; skip stub-overlapped weeks; count
  -- weeks with > 0.01 summed session hours, open sessions clipped at now; hours × wage).
  current_week := today - EXTRACT(dow FROM today)::int;
  WITH roster AS (
    SELECT DISTINCT ON (btrim(pc.person_name))
           btrim(pc.person_name) AS person_name,
           COALESCE(pc.hourly_wage, 0) AS wage,
           u.id AS user_id
    FROM public.people_pay_config pc
    JOIN public.users u ON btrim(u.name) = btrim(pc.person_name)
    WHERE btrim(pc.person_name) <> ''
    ORDER BY btrim(pc.person_name), u.id
  ),
  last_stub AS (
    SELECT btrim(person_name) AS person_name, max(period_end) AS last_end
    FROM public.pay_stubs GROUP BY btrim(person_name)
  ),
  person_weeks AS (
    -- LEAST(...current_week, scan_start + 103 weeks) mirrors the kernel's MAX_WEEKS_PER_PERSON = 104.
    SELECT r.person_name, r.wage, r.user_id,
           generate_series(s.scan_start, LEAST(current_week, s.scan_start + 721), interval '7 days')::date AS week_start
    FROM roster r
    LEFT JOIN last_stub ls ON ls.person_name = r.person_name
    CROSS JOIN LATERAL (
      SELECT CASE WHEN ls.last_end IS NOT NULL
               THEN (ls.last_end + 1) - EXTRACT(dow FROM (ls.last_end + 1))::int
               ELSE current_week - 56
             END AS scan_start
    ) s
  ),
  eligible_weeks AS (
    SELECT pw.* FROM person_weeks pw
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pay_stubs st
      WHERE btrim(st.person_name) = pw.person_name
        AND st.period_start <= pw.week_start + 6
        AND st.period_end >= pw.week_start
    )
  ),
  week_hours AS (
    SELECT ew.person_name, ew.wage, ew.week_start,
           sum(EXTRACT(epoch FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0) AS hours
    FROM eligible_weeks ew
    JOIN public.clock_sessions cs
      ON cs.user_id = ew.user_id
     AND cs.work_date >= ew.week_start AND cs.work_date <= ew.week_start + 6
     AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
     AND COALESCE(cs.clocked_out_at, now()) > cs.clocked_in_at
    GROUP BY ew.person_name, ew.wage, ew.week_start
    HAVING sum(EXTRACT(epoch FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0) > 0.01
  )
  SELECT COALESCE(sum(hours * wage), 0), count(*)
    INTO upcoming_total, upcoming_count
  FROM week_hours;

  RETURN jsonb_build_object(
    'payroll_due_total', due_total,
    'payroll_due_count', due_count,
    'upcoming_total', upcoming_total,
    'upcoming_person_week_count', upcoming_count
  );
END $$;

COMMENT ON FUNCTION public.get_dashboard_payroll_totals() IS
  'Org-level payroll aggregates for the Dashboard AP card. Assistants may call it (totals only — never per-person rows); math mirrors src/lib payStubDeductions.stubNetPay + dashboardFinancials.buildApBucket + upcomingPayrollSummary.buildUpcomingPayrollSummary.';

-- 7) Man-hours RPC survives the lockdown (hours only — safe as definer) ------------------------

CREATE OR REPLACE FUNCTION public.get_man_hours_by_job()
RETURNS TABLE(job_id text, person_name text, man_hours numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'get_man_hours_by_job: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant')
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
           then case when extract(dow from c.work_date) between 1 and 5 then 8 else 0 end
         else coalesce(ph.hours, 0)
       end) * (coalesce(nullif(c.assignment->>'pct', '')::numeric, 0) / 100.0) as alloc_hours
    from crew c
    left join people_pay_config pc on pc.person_name = c.person_name
    left join people_hours ph
      on ph.person_name = c.person_name
     and ph.work_date = c.work_date
     and ph.work_date >= (current_date - interval '2 years')
    where coalesce(c.assignment->>'job_id', '') <> ''
  )
  select a.jid, a.pname, sum(a.alloc_hours) as man_hours
  from alloc a
  group by a.jid, a.pname
  having sum(a.alloc_hours) > 0;
END $$;

-- 8) Cost-matrix shares: grantees must be dev/master (controller joins in Phase 3) -------------

CREATE OR REPLACE FUNCTION public.cost_matrix_share_grantee_role_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.shared_with_user_id AND u.role IN ('dev','master_technician')
  ) THEN
    RAISE EXCEPTION 'Cost matrix can only be shared with devs or master technicians (the matrix exposes wage-derived numbers)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cost_matrix_share_grantee_role_check ON public.cost_matrix_teams_shares;
CREATE TRIGGER cost_matrix_share_grantee_role_check
  BEFORE INSERT OR UPDATE ON public.cost_matrix_teams_shares
  FOR EACH ROW EXECUTE FUNCTION public.cost_matrix_share_grantee_role_check();
