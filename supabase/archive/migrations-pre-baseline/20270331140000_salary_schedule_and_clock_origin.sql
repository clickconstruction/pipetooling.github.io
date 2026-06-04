-- Salary work schedule templates + day overrides; clock_sessions.origin / salary_segment_index;
-- auto-materialized sessions via SECURITY DEFINER sync RPCs (service_role bulk + authenticated per-user).

-- 1. clock_sessions extensions
ALTER TABLE public.clock_sessions
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'user_punch',
ADD COLUMN IF NOT EXISTS salary_segment_index SMALLINT;

ALTER TABLE public.clock_sessions
DROP CONSTRAINT IF EXISTS clock_sessions_origin_check;

ALTER TABLE public.clock_sessions
ADD CONSTRAINT clock_sessions_origin_check CHECK (origin IN ('user_punch', 'salary_schedule'));

COMMENT ON COLUMN public.clock_sessions.origin IS 'user_punch: normal clock in/out; salary_schedule: system-created from salary_work_schedule_*';
COMMENT ON COLUMN public.clock_sessions.salary_segment_index IS 'For origin=salary_schedule split days: 1 or 2; NULL for continuous single segment.';

-- One salary row per user/day/segment slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_clock_sessions_salary_unique_continuous
ON public.clock_sessions (user_id, work_date)
WHERE origin = 'salary_schedule' AND salary_segment_index IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clock_sessions_salary_unique_split
ON public.clock_sessions (user_id, work_date, salary_segment_index)
WHERE origin = 'salary_schedule' AND salary_segment_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clock_sessions_salary_user_date
ON public.clock_sessions (user_id, work_date)
WHERE origin = 'salary_schedule';

-- Only user_punch rows may be inserted by clients (salary rows come from sync RPC).
DROP POLICY IF EXISTS "Users can insert own clock sessions" ON public.clock_sessions;
CREATE POLICY "Users can insert own clock sessions"
ON public.clock_sessions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND origin = 'user_punch'
);

DROP POLICY IF EXISTS "Pay access can insert clock sessions" ON public.clock_sessions;
CREATE POLICY "Pay access can insert clock sessions"
ON public.clock_sessions
FOR INSERT
WITH CHECK (
  (
    public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  )
  AND origin = 'user_punch'
);

-- 2. Templates
CREATE TABLE public.salary_work_schedule_templates (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  mode TEXT NOT NULL CHECK (mode IN ('continuous', 'split')),
  segment_a_start_local TIME NOT NULL,
  segment_a_duration_minutes INTEGER NOT NULL DEFAULT 480
    CHECK (segment_a_duration_minutes > 0 AND segment_a_duration_minutes % 15 = 0),
  segment_b_start_local TIME,
  segment_b_duration_minutes INTEGER
    CHECK (segment_b_duration_minutes IS NULL OR (segment_b_duration_minutes > 0 AND segment_b_duration_minutes % 15 = 0)),
  use_split_focus BOOLEAN NOT NULL DEFAULT false,
  job_ledger_id UUID REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
  segment_b_job_ledger_id UUID REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  segment_b_bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT salary_template_split_requires_b CHECK (
    mode = 'continuous'
    OR (segment_b_start_local IS NOT NULL AND segment_b_duration_minutes IS NOT NULL)
  ),
  CONSTRAINT salary_template_continuous_duration CHECK (
    mode = 'split' OR segment_a_duration_minutes = 480
  ),
  CONSTRAINT salary_template_split_sum CHECK (
    mode = 'continuous'
    OR segment_a_duration_minutes + segment_b_duration_minutes = 480
  )
);

COMMENT ON TABLE public.salary_work_schedule_templates IS 'Per-user default 8h layout for salaried workers; drives auto clock_sessions when sync runs.';

CREATE TABLE public.salary_work_schedule_day_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  timezone TEXT,
  mode TEXT CHECK (mode IS NULL OR mode IN ('continuous', 'split')),
  segment_a_start_local TIME,
  segment_a_duration_minutes INTEGER
    CHECK (segment_a_duration_minutes IS NULL OR (segment_a_duration_minutes > 0 AND segment_a_duration_minutes % 15 = 0)),
  segment_b_start_local TIME,
  segment_b_duration_minutes INTEGER
    CHECK (segment_b_duration_minutes IS NULL OR (segment_b_duration_minutes > 0 AND segment_b_duration_minutes % 15 = 0)),
  use_split_focus BOOLEAN,
  job_ledger_id UUID REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
  segment_b_job_ledger_id UUID REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  segment_b_bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, work_date),
  CONSTRAINT salary_override_split_requires_b CHECK (
    mode IS NULL
    OR mode = 'continuous'
    OR (segment_b_start_local IS NOT NULL AND segment_b_duration_minutes IS NOT NULL)
  ),
  CONSTRAINT salary_override_continuous_duration CHECK (
    mode IS NULL OR mode = 'split' OR segment_a_duration_minutes IS NULL OR segment_a_duration_minutes = 480
  ),
  CONSTRAINT salary_override_split_sum CHECK (
    mode IS NULL
    OR mode = 'continuous'
    OR segment_a_duration_minutes IS NULL
    OR segment_b_duration_minutes IS NULL
    OR segment_a_duration_minutes + segment_b_duration_minutes = 480
  )
);

COMMENT ON TABLE public.salary_work_schedule_day_overrides IS 'Per-day overrides; NULL field means inherit template. Owners may write today (Denver date) only; pay roles any date.';

ALTER TABLE public.salary_work_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_work_schedule_day_overrides ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.salary_schedule_staff_or_self_target(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target_user_id = auth.uid()
    OR public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant();
$$;

-- Templates: read (self, pay, team lead of member)
CREATE POLICY "salary_template_select"
ON public.salary_work_schedule_templates
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.salary_schedule_staff_or_self_target(user_id)
  OR public.is_team_lead_for_member(auth.uid(), user_id)
);

CREATE POLICY "salary_template_insert"
ON public.salary_work_schedule_templates
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR public.salary_schedule_staff_or_self_target(user_id)
);

CREATE POLICY "salary_template_update"
ON public.salary_work_schedule_templates
FOR UPDATE
USING (
  user_id = auth.uid()
  OR public.salary_schedule_staff_or_self_target(user_id)
)
WITH CHECK (
  user_id = auth.uid()
  OR public.salary_schedule_staff_or_self_target(user_id)
);

CREATE POLICY "salary_template_delete"
ON public.salary_work_schedule_templates
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.salary_schedule_staff_or_self_target(user_id)
);

-- Overrides
CREATE POLICY "salary_override_select"
ON public.salary_work_schedule_day_overrides
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.salary_schedule_staff_or_self_target(user_id)
  OR public.is_team_lead_for_member(auth.uid(), user_id)
);

CREATE POLICY "salary_override_insert"
ON public.salary_work_schedule_day_overrides
FOR INSERT
WITH CHECK (
  (
    user_id = auth.uid()
    AND work_date = (timezone('America/Denver', now()))::date
  )
  OR public.salary_schedule_staff_or_self_target(user_id)
);

CREATE POLICY "salary_override_update"
ON public.salary_work_schedule_day_overrides
FOR UPDATE
USING (
  (
    user_id = auth.uid()
    AND work_date = (timezone('America/Denver', now()))::date
  )
  OR public.salary_schedule_staff_or_self_target(user_id)
)
WITH CHECK (
  (
    user_id = auth.uid()
    AND work_date = (timezone('America/Denver', now()))::date
  )
  OR public.salary_schedule_staff_or_self_target(user_id)
);

CREATE POLICY "salary_override_delete"
ON public.salary_work_schedule_day_overrides
FOR DELETE
USING (
  (
    user_id = auth.uid()
    AND work_date = (timezone('America/Denver', now()))::date
  )
  OR public.salary_schedule_staff_or_self_target(user_id)
);

-- Internal: sync one user for one calendar work_date (Denver boundaries handled by caller p_work_date).
CREATE OR REPLACE FUNCTION public.salary_sync_one_user_clock_sessions(
  p_user_id uuid,
  p_work_date date,
  p_now timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_t record;
  r_o record;
  tz text;
  v_mode text;
  sa_time time;
  sa_dur int;
  sb_time time;
  sb_dur int;
  v_use_split_focus boolean;
  jl_a uuid;
  bid_a uuid;
  jl_b uuid;
  bid_b uuid;
  t_start timestamptz;
  t_end timestamptz;
  t_start2 timestamptz;
  t_end2 timestamptz;
  cs record;
BEGIN
  SELECT * INTO r_t FROM public.salary_work_schedule_templates WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO r_o
  FROM public.salary_work_schedule_day_overrides
  WHERE user_id = p_user_id AND work_date = p_work_date;

  tz := COALESCE(r_o.timezone, r_t.timezone, 'America/Denver');
  v_mode := COALESCE(r_o.mode, r_t.mode);
  sa_time := COALESCE(r_o.segment_a_start_local, r_t.segment_a_start_local);
  sa_dur := COALESCE(r_o.segment_a_duration_minutes, r_t.segment_a_duration_minutes);
  sb_time := COALESCE(r_o.segment_b_start_local, r_t.segment_b_start_local);
  sb_dur := COALESCE(r_o.segment_b_duration_minutes, r_t.segment_b_duration_minutes);
  v_use_split_focus := COALESCE(r_o.use_split_focus, r_t.use_split_focus);
  jl_a := COALESCE(r_o.job_ledger_id, r_t.job_ledger_id);
  bid_a := COALESCE(r_o.bid_id, r_t.bid_id);
  jl_b := COALESCE(r_o.segment_b_job_ledger_id, r_t.segment_b_job_ledger_id);
  bid_b := COALESCE(r_o.segment_b_bid_id, r_t.segment_b_bid_id);

  IF v_mode = 'continuous' THEN
    t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
    t_end := t_start + (sa_dur || ' minutes')::interval;

    SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
    INTO cs
    FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND salary_segment_index IS NULL
    FOR UPDATE;

    IF FOUND THEN
      IF cs.approved_at IS NOT NULL OR cs.rejected_at IS NOT NULL OR cs.revoked_at IS NOT NULL THEN
        RETURN;
      END IF;
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions
        SET clocked_out_at = t_end
        WHERE id = cs.id;
      END IF;
    ELSE
      IF p_now >= t_start AND p_now < t_end THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, NULL, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', NULL
        );
      ELSIF p_now >= t_end THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, t_end, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', NULL
        );
      END IF;
    END IF;
    RETURN;
  END IF;

  -- split
  IF sb_time IS NULL OR sb_dur IS NULL THEN
    RETURN;
  END IF;

  t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
  t_end := t_start + (sa_dur || ' minutes')::interval;
  t_start2 := (p_work_date::timestamp + sb_time) AT TIME ZONE tz;
  t_end2 := t_start2 + (sb_dur || ' minutes')::interval;

  SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
  INTO cs
  FROM public.clock_sessions
  WHERE user_id = p_user_id
    AND work_date = p_work_date
    AND origin = 'salary_schedule'
    AND salary_segment_index = 1
  FOR UPDATE;

  IF FOUND THEN
    IF cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
    IF p_now >= t_start AND p_now < t_end THEN
      INSERT INTO public.clock_sessions (
        user_id, clocked_in_at, clocked_out_at, work_date, notes,
        job_ledger_id, bid_id, origin, salary_segment_index
      ) VALUES (
        p_user_id, t_start, NULL, p_work_date, '',
        jl_a, bid_a, 'salary_schedule', 1
      );
    ELSIF p_now >= t_end THEN
      INSERT INTO public.clock_sessions (
        user_id, clocked_in_at, clocked_out_at, work_date, notes,
        job_ledger_id, bid_id, origin, salary_segment_index
      ) VALUES (
        p_user_id, t_start, t_end, p_work_date, '',
        jl_a, bid_a, 'salary_schedule', 1
      );
    END IF;
  END IF;

  -- Segment 2 (focus: CASE in INSERTs below)
  SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
  INTO cs
  FROM public.clock_sessions
  WHERE user_id = p_user_id
    AND work_date = p_work_date
    AND origin = 'salary_schedule'
    AND salary_segment_index = 2
  FOR UPDATE;

  IF FOUND THEN
    IF cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      IF cs.clocked_out_at IS NULL AND p_now >= t_end2 THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end2 WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
    IF p_now >= t_start2 AND p_now < t_end2 THEN
      INSERT INTO public.clock_sessions (
        user_id, clocked_in_at, clocked_out_at, work_date, notes,
        job_ledger_id, bid_id, origin, salary_segment_index
      ) VALUES (
        p_user_id, t_start2, NULL, p_work_date, '',
        CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
        CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
        'salary_schedule', 2
      );
    ELSIF p_now >= t_end2 THEN
      INSERT INTO public.clock_sessions (
        user_id, clocked_in_at, clocked_out_at, work_date, notes,
        job_ledger_id, bid_id, origin, salary_segment_index
      ) VALUES (
        p_user_id, t_start2, t_end2, p_work_date, '',
        CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
        CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
        'salary_schedule', 2
      );
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) IS 'Definer: create/close salary_schedule clock_sessions for one user/day.';

REVOKE ALL ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_salary_clock_sessions_for_day(p_work_date date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  r_user record;
BEGIN
  d := COALESCE(p_work_date, (timezone('America/Denver', now()))::date);
  FOR r_user IN SELECT user_id FROM public.salary_work_schedule_templates
  LOOP
    PERFORM public.salary_sync_one_user_clock_sessions(r_user.user_id, d, now());
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.sync_salary_clock_sessions_for_day(date) IS 'Service role: sync all salary templates for a calendar date (default Denver today).';

REVOKE ALL ON FUNCTION public.sync_salary_clock_sessions_for_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_salary_clock_sessions_for_day(date) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_salary_clock_sessions_for_user_day(p_user_id uuid, p_work_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.uid() = p_user_id
    OR public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  PERFORM public.salary_sync_one_user_clock_sessions(p_user_id, p_work_date, now());
END;
$$;

COMMENT ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) IS 'Authenticated user (self or pay staff): refresh salary sessions for one user/day.';

REVOKE ALL ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_salary_clock_sessions_for_user_day(uuid, date) TO service_role;
