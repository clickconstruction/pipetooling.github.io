-- people_crew_bids: per-person-per-day bid assignments for team labor on pre-job (bid) work.
-- Mirrors people_crew_jobs; synced from approved clock_sessions with bid_id.

CREATE TABLE IF NOT EXISTS public.people_crew_bids (
  work_date DATE NOT NULL,
  person_name TEXT NOT NULL,
  crew_lead_person_name TEXT,
  bid_assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (work_date, person_name)
);
CREATE INDEX IF NOT EXISTS idx_people_crew_bids_work_date ON public.people_crew_bids(work_date);
CREATE INDEX IF NOT EXISTS idx_people_crew_bids_person ON public.people_crew_bids(person_name);
COMMENT ON TABLE public.people_crew_bids IS 'Crew lead and bid/percentage assignments per person per day. Synced from approved clock sessions with bid_id. Used for Team Labor on Bids.';
COMMENT ON COLUMN public.people_crew_bids.crew_lead_person_name IS 'When set, this person inherits crew lead bid assignments. When null, bid_assignments applies.';
COMMENT ON COLUMN public.people_crew_bids.bid_assignments IS 'JSON array of { bid_id: uuid, pct: number }. Only used when crew_lead_person_name is null. Should sum to 100.';
ALTER TABLE public.people_crew_bids ENABLE ROW LEVEL SECURITY;

-- RLS: same as people_crew_jobs
DROP POLICY IF EXISTS "Pay access and shared users can read people crew bids" ON public.people_crew_bids;
CREATE POLICY "Pay access and shared users can read people crew bids"
ON public.people_crew_bids
FOR SELECT
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
  OR public.is_cost_matrix_shared_with_current_user()
);
DROP POLICY IF EXISTS "Pay access users can insert people crew bids" ON public.people_crew_bids;
CREATE POLICY "Pay access users can insert people crew bids"
ON public.people_crew_bids
FOR INSERT
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
DROP POLICY IF EXISTS "Pay access users can update people crew bids" ON public.people_crew_bids;
CREATE POLICY "Pay access users can update people crew bids"
ON public.people_crew_bids
FOR UPDATE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);
DROP POLICY IF EXISTS "Pay access users can delete people crew bids" ON public.people_crew_bids;
CREATE POLICY "Pay access users can delete people crew bids"
ON public.people_crew_bids
FOR DELETE
USING (
  public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);

-- RPC: get_bids_by_ids - resolve bid details for team labor display
CREATE OR REPLACE FUNCTION public.get_bids_by_ids(p_bid_ids uuid[])
RETURNS TABLE (
  id uuid,
  bid_number text,
  project_name text,
  address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id,
         COALESCE(b.bid_number, '')::text,
         COALESCE(b.project_name, '')::text,
         COALESCE(b.address, '')::text
  FROM public.bids b
  WHERE b.id = ANY(p_bid_ids);
$$;
COMMENT ON FUNCTION public.get_bids_by_ids(uuid[]) IS 'Fetch bid details for team labor display. SECURITY DEFINER bypasses bids RLS.';

-- sync_crew_bids_from_clock: sync people_crew_bids from approved clock sessions with bid_id
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
BEGIN
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

  INSERT INTO public.people_crew_bids (work_date, person_name, crew_lead_person_name, bid_assignments)
  VALUES (p_work_date, p_person_name, NULL, v_bid_assignments)
  ON CONFLICT (work_date, person_name) DO UPDATE SET
    crew_lead_person_name = NULL,
    bid_assignments = EXCLUDED.bid_assignments;
END;
$$;
COMMENT ON FUNCTION public.sync_crew_bids_from_clock(TEXT, DATE) IS
  'Sync people_crew_bids for a person/date from approved clock sessions with bid_id. Skips if crew_lead_person_name is set.';

-- revoke_clock_sessions: add bid_id to SELECT, call sync_crew_bids_from_clock when session had bid_id
CREATE OR REPLACE FUNCTION public.revoke_clock_sessions(p_session_ids UUID[])
RETURNS TABLE(revoked_count int, error_message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_revoked int := 0;
  v_session RECORD;
  v_hours numeric;
  v_new_hours numeric;
BEGIN
  IF NOT (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant()) THEN
    RETURN QUERY SELECT 0, 'Access denied'::text;
    RETURN;
  END IF;

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
  LOOP
    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
    IF v_hours <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.people_hours
    SET hours = hours - v_hours,
        entered_by = auth.uid()
    WHERE person_name = v_session.person_name
      AND work_date = v_session.work_date
    RETURNING hours INTO v_new_hours;

    IF FOUND THEN
      IF v_new_hours <= 0 THEN
        DELETE FROM public.people_hours
        WHERE person_name = v_session.person_name
          AND work_date = v_session.work_date;
      END IF;
    END IF;

    UPDATE public.clock_sessions
    SET approved_at = NULL, approved_by = NULL,
        revoked_at = NOW(), revoked_by = auth.uid()
    WHERE id = v_session.id;

    v_revoked := v_revoked + 1;

    IF v_session.job_ledger_id IS NOT NULL THEN
      PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
    END IF;
    IF v_session.bid_id IS NOT NULL THEN
      PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_revoked, NULL::text;
END;
$$;

-- approve_clock_sessions: add bid_id to SELECT, sync crew bids after job sync
CREATE OR REPLACE FUNCTION public.approve_clock_sessions(p_session_ids UUID[])
RETURNS TABLE(approved_count int, error_message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_approved int := 0;
  v_session RECORD;
  v_hours numeric;
  v_to_sync RECORD;
BEGIN
  IF NOT (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant()) THEN
    RETURN QUERY SELECT 0, 'Access denied'::text;
    RETURN;
  END IF;

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
  LOOP
    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
    IF v_hours <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.people_hours (person_name, work_date, hours, entered_by)
    VALUES (v_session.person_name, v_session.work_date, v_hours, auth.uid())
    ON CONFLICT (person_name, work_date) DO UPDATE SET
      hours = public.people_hours.hours + EXCLUDED.hours,
      entered_by = EXCLUDED.entered_by;

    UPDATE public.clock_sessions
    SET approved_at = NOW(), approved_by = auth.uid(),
        revoked_at = NULL, revoked_by = NULL
    WHERE id = v_session.id;

    v_approved := v_approved + 1;
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.job_ledger_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_jobs_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.bid_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_bids_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  RETURN QUERY SELECT v_approved, NULL::text;
END;
$$;
