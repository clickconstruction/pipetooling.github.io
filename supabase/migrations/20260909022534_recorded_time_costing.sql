SET lock_timeout = '3s';

-- Recorded-time costing (v2.3179, owner decision 2026-09-08).
--
-- Job costing counted APPROVED clock time only: clock session → approval →
-- people_hours + people_crew_jobs → teamLabor.ts / get_man_hours_by_job /
-- Job Summary / Cost Timeline. Approval is the PAYROLL gate; using it as the
-- COSTING gate meant every salaried day was invisible on its job until the
-- auto-approve cron ran (2 h after clock-out — 6 PM for an 8–4 day) and every
-- hourly punch waited on a human (14 pending punches / 60.7 h uncounted in the
-- 14 days before this shipped).
--
-- Two definitions from here on:
--   * APPROVED time — people_hours, pay stubs, Draft Payroll, the overhead
--     pool, the week close. Untouched by this migration.
--   * RECORDED time — every session that is not rejected or revoked: closed
--     sessions approved OR awaiting approval, and (for the day split only) the
--     session that is open right now. This is what job cost reads.
--
-- Four pieces:
--   1. people_hours_recorded — a view: people_hours + closed-unapproved session
--      hours per (person, day). Costing readers select from it instead of
--      people_hours; security_invoker so the caller's RLS still applies.
--   2. sync_crew_jobs_from_clock / sync_crew_bids_from_clock count recorded
--      sessions (was: approved only). Open sessions count to now() so a
--      salaried person's flat 8 h lands on the right job at clock-in, not
--      at 6 PM. Bodies otherwise verbatim from 20260903153903 (the shared
--      denominator fix).
--   3. A row trigger on clock_sessions resyncs the person/day on INSERT,
--      DELETE, and any change to the fields the split reads — so the crew
--      rows follow the sessions without every RPC having to remember to
--      call the sync. Replaces clock_sessions_sync_crew_assignments_tr
--      (job/bid change on an approved session only). SECURITY DEFINER: a
--      helper's own clock-in must never fail on people_crew_jobs RLS.
--   4. get_man_hours_by_job (the Pipeline board's man-hours) reads the view.
-- Then a one-off resync of the person-days that currently hold a closed
-- unapproved job/bid session (last 90 days), so the backlog shows at once.
--
-- What does NOT change: people_hours is written only by approve / revoke /
-- auto-approve / the split RPCs as before; the unallocated-time queue and the
-- week close keep reading approved sessions (they are payroll surfaces).

-- ---------------------------------------------------------------------------
-- 1. people_hours_recorded
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.people_hours_recorded
WITH (security_invoker = true)
AS
WITH pending AS (
  SELECT
    trim(u.name) AS person_name,
    cs.work_date,
    SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  WHERE cs.clocked_out_at IS NOT NULL
    AND cs.clocked_out_at > cs.clocked_in_at
    AND cs.approved_at IS NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND trim(u.name) <> ''
  GROUP BY trim(u.name), cs.work_date
)
SELECT
  COALESCE(ph.person_name, p.person_name) AS person_name,
  COALESCE(ph.person_id, pc.person_id)    AS person_id,
  COALESCE(ph.work_date, p.work_date)     AS work_date,
  (COALESCE(ph.hours, 0) + COALESCE(p.hours, 0))::numeric AS hours,
  COALESCE(ph.hours, 0)::numeric          AS approved_hours,
  COALESCE(p.hours, 0)::numeric           AS pending_hours
FROM public.people_hours ph
FULL OUTER JOIN pending p
  ON p.person_name = ph.person_name AND p.work_date = ph.work_date
LEFT JOIN public.people_pay_config pc
  ON pc.person_name = COALESCE(ph.person_name, p.person_name);

COMMENT ON VIEW public.people_hours_recorded IS
  'Recorded time per person/day (v2.3179): people_hours (approved + manual) plus closed clock sessions still awaiting approval. Job COSTING reads this; PAYROLL keeps reading people_hours. security_invoker — the caller''s RLS on people_hours / clock_sessions applies.';

GRANT SELECT ON public.people_hours_recorded TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Crew split from recorded sessions (open sessions count to now())
-- ---------------------------------------------------------------------------
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

  -- Recorded sessions: not rejected, not revoked; approval not required
  -- (v2.3179). An open session runs to now() — floored at one minute so a
  -- fresh clock-in still lands its job at 100% instead of tripping the
  -- "nothing here" delete below.
  SELECT
    COALESCE(SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)), 0),
    COALESCE(SUM(CASE WHEN cs.job_ledger_id IS NOT NULL
                      THEN GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)
                      ELSE 0 END), 0),
    COUNT(DISTINCT cs.job_ledger_id) FILTER (WHERE cs.job_ledger_id IS NOT NULL)
  INTO v_total_hours, v_job_hours, v_cnt
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  WHERE trim(u.name) = p_person_name
    AND cs.work_date = p_work_date
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND (cs.job_ledger_id IS NOT NULL OR cs.bid_id IS NOT NULL);

  IF v_total_hours <= 0 OR v_job_hours <= 0 OR v_cnt = 0 THEN
    DELETE FROM public.people_crew_jobs
    WHERE person_name = p_person_name AND work_date = p_work_date;
    RETURN;
  END IF;

  v_job_share_pct := ROUND((v_job_hours / v_total_hours) * 1000) / 10;

  FOR v_row IN
    SELECT cs.job_ledger_id,
           SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)) AS hours
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE trim(u.name) = p_person_name
      AND cs.work_date = p_work_date
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
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
  'Sync people_crew_jobs for a person/date from RECORDED clock sessions with job_ledger_id (not rejected/revoked; approval not required; open sessions count to now() — v2.3179). pct = share of all recorded job+bid sessions that day (shared denominator with sync_crew_bids_from_clock). Keeps crew_lead_person_name NULL; fills person_id when resolvable.';

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
    COALESCE(SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)), 0),
    COALESCE(SUM(CASE WHEN cs.bid_id IS NOT NULL
                      THEN GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)
                      ELSE 0 END), 0),
    COUNT(DISTINCT cs.bid_id) FILTER (WHERE cs.bid_id IS NOT NULL)
  INTO v_total_hours, v_bid_hours, v_cnt
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  WHERE trim(u.name) = p_person_name
    AND cs.work_date = p_work_date
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND (cs.job_ledger_id IS NOT NULL OR cs.bid_id IS NOT NULL);

  IF v_total_hours <= 0 OR v_bid_hours <= 0 OR v_cnt = 0 THEN
    DELETE FROM public.people_crew_bids
    WHERE person_name = p_person_name AND work_date = p_work_date;
    RETURN;
  END IF;

  v_bid_share_pct := ROUND((v_bid_hours / v_total_hours) * 1000) / 10;

  FOR v_row IN
    SELECT cs.bid_id,
           SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)) AS hours
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE trim(u.name) = p_person_name
      AND cs.work_date = p_work_date
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
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
  'Sync people_crew_bids for a person/date from RECORDED clock sessions with bid_id (not rejected/revoked; approval not required; open sessions count to now() — v2.3179). pct = share of all recorded job+bid sessions that day (shared denominator with sync_crew_jobs_from_clock). Keeps crew_lead_person_name NULL; fills person_id when resolvable.';

-- ---------------------------------------------------------------------------
-- 3. The crew rows follow the sessions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clock_sessions_sync_crew_recorded_tr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_name text;
  v_old_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT trim(u.name) INTO v_old_name FROM public.users u WHERE u.id = OLD.user_id;
    IF v_old_name IS NOT NULL AND v_old_name <> '' THEN
      PERFORM public.sync_crew_jobs_from_clock(v_old_name, OLD.work_date);
      PERFORM public.sync_crew_bids_from_clock(v_old_name, OLD.work_date);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.clocked_in_at IS NOT DISTINCT FROM NEW.clocked_in_at
     AND OLD.clocked_out_at IS NOT DISTINCT FROM NEW.clocked_out_at
     AND OLD.approved_at IS NOT DISTINCT FROM NEW.approved_at
     AND OLD.rejected_at IS NOT DISTINCT FROM NEW.rejected_at
     AND OLD.revoked_at IS NOT DISTINCT FROM NEW.revoked_at
     AND OLD.job_ledger_id IS NOT DISTINCT FROM NEW.job_ledger_id
     AND OLD.bid_id IS NOT DISTINCT FROM NEW.bid_id
     AND OLD.work_date IS NOT DISTINCT FROM NEW.work_date
     AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN
    -- UPDATE OF fires on a SET of the column even when the value is unchanged
    -- (the salary sync's periodic passes); nothing the split reads moved.
    RETURN NEW;
  END IF;

  SELECT trim(u.name) INTO v_new_name FROM public.users u WHERE u.id = NEW.user_id;

  IF TG_OP = 'UPDATE' THEN
    -- A session that moved days or people leaves a stale split behind it.
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      SELECT trim(u.name) INTO v_old_name FROM public.users u WHERE u.id = OLD.user_id;
    ELSE
      v_old_name := v_new_name;
    END IF;
    IF (OLD.work_date IS DISTINCT FROM NEW.work_date OR OLD.user_id IS DISTINCT FROM NEW.user_id)
       AND v_old_name IS NOT NULL AND v_old_name <> '' THEN
      PERFORM public.sync_crew_jobs_from_clock(v_old_name, OLD.work_date);
      PERFORM public.sync_crew_bids_from_clock(v_old_name, OLD.work_date);
    END IF;
  END IF;

  IF v_new_name IS NOT NULL AND v_new_name <> '' THEN
    PERFORM public.sync_crew_jobs_from_clock(v_new_name, NEW.work_date);
    PERFORM public.sync_crew_bids_from_clock(v_new_name, NEW.work_date);
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.clock_sessions_sync_crew_recorded_tr() IS
  'Resync people_crew_jobs / people_crew_bids for the session''s person/day on insert, delete, and any change to the fields the day split reads (v2.3179 recorded-time costing). SECURITY DEFINER so a field user''s own clock-in never fails on crew-table RLS.';

REVOKE ALL ON FUNCTION public.clock_sessions_sync_crew_recorded_tr() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS clock_sessions_sync_crew_assignments_tr ON public.clock_sessions;
DROP TRIGGER IF EXISTS clock_sessions_sync_crew_recorded_tr ON public.clock_sessions;
CREATE TRIGGER clock_sessions_sync_crew_recorded_tr
AFTER INSERT OR DELETE OR UPDATE OF clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at, job_ledger_id, bid_id, work_date, user_id
ON public.clock_sessions
FOR EACH ROW EXECUTE FUNCTION public.clock_sessions_sync_crew_recorded_tr();

-- ---------------------------------------------------------------------------
-- 4. Pipeline man-hours read recorded time
-- ---------------------------------------------------------------------------
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
END $$;

-- ---------------------------------------------------------------------------
-- Backfill: person-days that hold a closed unapproved job/bid session today
-- (last 90 days) get their crew split now, so the pending backlog shows on
-- its jobs the moment the client reads recorded time.
-- ---------------------------------------------------------------------------
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
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND (cs.job_ledger_id IS NOT NULL OR cs.bid_id IS NOT NULL)
      AND cs.work_date >= (public.app_today() - INTERVAL '90 days')::date
      AND trim(u.name) <> ''
    GROUP BY trim(u.name), cs.work_date
    ORDER BY cs.work_date
  LOOP
    PERFORM public.sync_crew_jobs_from_clock(r.person_name, r.work_date);
    PERFORM public.sync_crew_bids_from_clock(r.person_name, r.work_date);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'recorded-time crew resync (pending person-days, last 90 days): % recomputed', n;
END;
$$;
