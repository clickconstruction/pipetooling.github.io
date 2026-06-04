-- Crew job/bid rows: optional person_id for stable roster join; sync fills from resolve helper.

ALTER TABLE public.people_crew_jobs
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_people_crew_jobs_person_id ON public.people_crew_jobs (person_id);

UPDATE public.people_crew_jobs t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.people_crew_jobs t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

ALTER TABLE public.people_crew_bids
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_people_crew_bids_person_id ON public.people_crew_bids (person_id);

UPDATE public.people_crew_bids t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.people_crew_bids t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_crew_jobs_from_clock(p_person_name TEXT, p_work_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_total_hours numeric := 0;
  v_job_assignments jsonb := '[]'::jsonb;
  v_pct numeric;
  v_sum_pct numeric := 0;
  v_idx int := 0;
  v_cnt int := 0;
  v_crew_lead text;
  v_person_id uuid;
BEGIN
  v_person_id := public.resolve_pay_person_id_from_clock_user(NULL, p_person_name);

  SELECT crew_lead_person_name INTO v_crew_lead
  FROM public.people_crew_jobs
  WHERE person_name = p_person_name AND work_date = p_work_date;

  IF v_crew_lead IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(h.hrs), 0), COUNT(*)
  INTO v_total_hours, v_cnt
  FROM (
    SELECT SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hrs
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE trim(u.name) = p_person_name
      AND cs.work_date = p_work_date
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.job_ledger_id IS NOT NULL
    GROUP BY cs.job_ledger_id
  ) h;

  IF v_total_hours <= 0 OR v_cnt = 0 THEN
    DELETE FROM public.people_crew_jobs
    WHERE person_name = p_person_name AND work_date = p_work_date;
    RETURN;
  END IF;

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
      v_pct := 100 - v_sum_pct;
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

COMMENT ON FUNCTION public.sync_crew_jobs_from_clock(TEXT, DATE) IS
  'Sync people_crew_jobs for a person/date from approved clock sessions with job_ledger_id. Skips if crew_lead_person_name is set. Fills person_id when resolvable.';

CREATE OR REPLACE FUNCTION public.sync_crew_bids_from_clock(p_person_name TEXT, p_work_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_total_hours numeric := 0;
  v_bid_assignments jsonb := '[]'::jsonb;
  v_pct numeric;
  v_sum_pct numeric := 0;
  v_idx int := 0;
  v_cnt int := 0;
  v_crew_lead text;
  v_person_id uuid;
BEGIN
  v_person_id := public.resolve_pay_person_id_from_clock_user(NULL, p_person_name);

  SELECT crew_lead_person_name INTO v_crew_lead
  FROM public.people_crew_bids
  WHERE person_name = p_person_name AND work_date = p_work_date;

  IF v_crew_lead IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(h.hrs), 0), COUNT(*)
  INTO v_total_hours, v_cnt
  FROM (
    SELECT SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hrs
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE trim(u.name) = p_person_name
      AND cs.work_date = p_work_date
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
      AND cs.bid_id IS NOT NULL
    GROUP BY cs.bid_id
  ) h;

  IF v_total_hours <= 0 OR v_cnt = 0 THEN
    DELETE FROM public.people_crew_bids
    WHERE person_name = p_person_name AND work_date = p_work_date;
    RETURN;
  END IF;

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
      v_pct := 100 - v_sum_pct;
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

COMMENT ON FUNCTION public.sync_crew_bids_from_clock(TEXT, DATE) IS
  'Sync people_crew_bids for a person/date from approved clock sessions with bid_id. Skips if crew_lead_person_name is set. Fills person_id when resolvable.';
