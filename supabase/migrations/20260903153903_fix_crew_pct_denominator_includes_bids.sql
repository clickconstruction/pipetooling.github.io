SET lock_timeout = '3s';

-- Crew split denominator includes bid sessions (2026-09-03 Review math audit,
-- finding 1).
--
-- `sync_crew_jobs_from_clock` wrote each job's pct as its share of the day's
-- approved sessions THAT HAD A JOB, and `sync_crew_bids_from_clock` wrote each
-- bid's pct as its share of the day's sessions THAT HAD A BID. `people_hours`
-- (approve_clock_sessions) holds the whole day. Every consumer multiplies
-- pct × day hours ("Convention 1" — share of the total day, v2.539), so a day
-- split 4 h job / 4 h bid credited all 8 h to the job AND 4 h of bid overhead:
-- 12 h of labor for an 8 h day, on People → Review, Jobs → Job Summary team
-- labor, pay-report breakdowns and the unallocated-time queues.
--
-- Fix: both functions share ONE denominator — every approved, closed session
-- that day with a job OR a bid. Job pcts + bid pcts now sum to 100 across the
-- two tables (unassigned sessions stay out, as before). On days with only
-- jobs, or only bids, nothing changes (the remainder trick still lands the
-- bucket on exactly its share). The office job is still a job assignment
-- (consumers skip it), so office time still reduces field pct as before.
--
-- Then a one-off resync of the only rows that change: person-days in the last
-- two years with at least one approved closed JOB session and one BID session.
-- Idempotent: re-running recomputes the same values.

CREATE OR REPLACE FUNCTION public.sync_crew_jobs_from_clock(p_person_name text, p_work_date date)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_total_hours numeric := 0;   -- job + bid sessions (shared denominator)
  v_job_hours numeric := 0;     -- job sessions only (this bucket)
  v_job_share_pct numeric := 0; -- the bucket's share of the day, to 0.1
  v_job_assignments jsonb := '[]'::jsonb;
  v_pct numeric;
  v_sum_pct numeric := 0;
  v_idx int := 0;
  v_cnt int := 0;
  v_person_id uuid;
BEGIN
  v_person_id := public.resolve_pay_person_id_from_clock_user(NULL, p_person_name);

  SELECT
    COALESCE(SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0), 0),
    COALESCE(SUM(CASE WHEN cs.job_ledger_id IS NOT NULL
                      THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0
                      ELSE 0 END), 0),
    COUNT(DISTINCT cs.job_ledger_id) FILTER (WHERE cs.job_ledger_id IS NOT NULL)
  INTO v_total_hours, v_job_hours, v_cnt
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  WHERE trim(u.name) = p_person_name
    AND cs.work_date = p_work_date
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NOT NULL
    AND (cs.job_ledger_id IS NOT NULL OR cs.bid_id IS NOT NULL);

  IF v_total_hours <= 0 OR v_job_hours <= 0 OR v_cnt = 0 THEN
    DELETE FROM public.people_crew_jobs
    WHERE person_name = p_person_name AND work_date = p_work_date;
    RETURN;
  END IF;

  v_job_share_pct := ROUND((v_job_hours / v_total_hours) * 1000) / 10;

  FOR v_row IN
    SELECT cs.job_ledger_id,
           SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE trim(u.name) = p_person_name
      AND cs.work_date = p_work_date
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.job_ledger_id IS NOT NULL
    GROUP BY cs.job_ledger_id
    ORDER BY cs.job_ledger_id
  LOOP
    v_idx := v_idx + 1;
    IF v_idx < v_cnt THEN
      v_pct := ROUND((v_row.hours / v_total_hours) * 1000) / 10;
      v_sum_pct := v_sum_pct + v_pct;
    ELSE
      -- Last job takes the bucket's remainder so the job pcts sum to exactly
      -- the job share (100 on a job-only day, as before).
      v_pct := v_job_share_pct - v_sum_pct;
    END IF;
    v_job_assignments := v_job_assignments || jsonb_build_array(
      jsonb_build_object('job_id', v_row.job_ledger_id, 'pct', v_pct)
    );
  END LOOP;

  INSERT INTO public.people_crew_jobs (work_date, person_name, crew_lead_person_name, job_assignments, person_id)
  VALUES (p_work_date, p_person_name, NULL, v_job_assignments, v_person_id)
  ON CONFLICT (work_date, person_name) DO UPDATE SET
    crew_lead_person_name = NULL,
    job_assignments = EXCLUDED.job_assignments,
    person_id = COALESCE(public.people_crew_jobs.person_id, EXCLUDED.person_id);
END;
$$;

COMMENT ON FUNCTION public.sync_crew_jobs_from_clock(text, date) IS
  'Sync people_crew_jobs for a person/date from approved clock sessions with job_ledger_id. pct = share of ALL approved job+bid sessions that day (shared denominator with sync_crew_bids_from_clock, 2026-09-03). Keeps crew_lead_person_name NULL; fills person_id when resolvable.';

CREATE OR REPLACE FUNCTION public.sync_crew_bids_from_clock(p_person_name text, p_work_date date)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_total_hours numeric := 0;   -- job + bid sessions (shared denominator)
  v_bid_hours numeric := 0;     -- bid sessions only (this bucket)
  v_bid_share_pct numeric := 0;
  v_bid_assignments jsonb := '[]'::jsonb;
  v_pct numeric;
  v_sum_pct numeric := 0;
  v_idx int := 0;
  v_cnt int := 0;
  v_person_id uuid;
BEGIN
  v_person_id := public.resolve_pay_person_id_from_clock_user(NULL, p_person_name);

  SELECT
    COALESCE(SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0), 0),
    COALESCE(SUM(CASE WHEN cs.bid_id IS NOT NULL
                      THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0
                      ELSE 0 END), 0),
    COUNT(DISTINCT cs.bid_id) FILTER (WHERE cs.bid_id IS NOT NULL)
  INTO v_total_hours, v_bid_hours, v_cnt
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  WHERE trim(u.name) = p_person_name
    AND cs.work_date = p_work_date
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NOT NULL
    AND (cs.job_ledger_id IS NOT NULL OR cs.bid_id IS NOT NULL);

  IF v_total_hours <= 0 OR v_bid_hours <= 0 OR v_cnt = 0 THEN
    DELETE FROM public.people_crew_bids
    WHERE person_name = p_person_name AND work_date = p_work_date;
    RETURN;
  END IF;

  v_bid_share_pct := ROUND((v_bid_hours / v_total_hours) * 1000) / 10;

  FOR v_row IN
    SELECT cs.bid_id,
           SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE trim(u.name) = p_person_name
      AND cs.work_date = p_work_date
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.bid_id IS NOT NULL
    GROUP BY cs.bid_id
    ORDER BY cs.bid_id
  LOOP
    v_idx := v_idx + 1;
    IF v_idx < v_cnt THEN
      v_pct := ROUND((v_row.hours / v_total_hours) * 1000) / 10;
      v_sum_pct := v_sum_pct + v_pct;
    ELSE
      v_pct := v_bid_share_pct - v_sum_pct;
    END IF;
    v_bid_assignments := v_bid_assignments || jsonb_build_array(
      jsonb_build_object('bid_id', v_row.bid_id, 'pct', v_pct)
    );
  END LOOP;

  INSERT INTO public.people_crew_bids (work_date, person_name, crew_lead_person_name, bid_assignments, person_id)
  VALUES (p_work_date, p_person_name, NULL, v_bid_assignments, v_person_id)
  ON CONFLICT (work_date, person_name) DO UPDATE SET
    crew_lead_person_name = NULL,
    bid_assignments = EXCLUDED.bid_assignments,
    person_id = COALESCE(public.people_crew_bids.person_id, EXCLUDED.person_id);
END;
$$;

COMMENT ON FUNCTION public.sync_crew_bids_from_clock(text, date) IS
  'Sync people_crew_bids for a person/date from approved clock sessions with bid_id. pct = share of ALL approved job+bid sessions that day (shared denominator with sync_crew_jobs_from_clock, 2026-09-03). Keeps crew_lead_person_name NULL; fills person_id when resolvable.';

-- One-off resync of the rows whose pct actually changes: person-days with
-- both a job session and a bid session. Job-only and bid-only days produce
-- the same values as before, so they are left alone.
DO $$
DECLARE
  r RECORD;
  n int := 0;
BEGIN
  FOR r IN
    SELECT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.work_date >= (CURRENT_DATE - INTERVAL '2 years')::date
      AND trim(u.name) <> ''
    GROUP BY trim(u.name), cs.work_date
    HAVING bool_or(cs.bid_id IS NOT NULL) AND bool_or(cs.job_ledger_id IS NOT NULL)
    ORDER BY cs.work_date
  LOOP
    PERFORM public.sync_crew_jobs_from_clock(r.person_name, r.work_date);
    PERFORM public.sync_crew_bids_from_clock(r.person_name, r.work_date);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'crew pct resync (job+bid days, last 2 years): % person-days recomputed', n;
END;
$$;
