SET lock_timeout = '3s';

-- The expected hours (punch list #242, PR 2). The owner, 2026-11-01: a page where the leader, the superintendents
-- and the office see where every big job stands and adjust its expected hours, "so that teams that are getting lazy
-- can be artificially incentivized". The expected hours are a TARGET set in the open — who set it, when, from what
-- to what and why — read by the superintendent's line as its pace budget while the Costs tab's baseline and #234's
-- bonus ground stay frozen apart from it. One row per change, append-only: the history is the board's Recent
-- changes strip. At most one open row per job (cleared_at IS NULL) is the target the strip and the phone read;
-- setting a new target closes the old row in the same instant, and "back to the budget" closes it with no new row.
-- Who may move the number: the leader (master technician) and the office (dev, assistant, controller). A
-- superintendent reads his own number and its reason. See docs/migrations/20261102041411_job_expected_hours.md.

CREATE TABLE IF NOT EXISTS public.job_expected_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The target: the hours the project is expected to take, inside the labor budget.
  hours numeric(10,1) NOT NULL
    CONSTRAINT job_expected_hours_hours_nonneg CHECK (hours >= 0),
  -- What the line read before: the last target, or the budget's hours when this is the first target. Null when the
  -- client did not know.
  from_hours numeric(10,1),
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The name as it read that day, kept on the ledger so the card says "set by Robert" after any rename.
  set_by_name text NOT NULL DEFAULT '',
  set_at timestamptz NOT NULL DEFAULT now(),
  why text NOT NULL
    CONSTRAINT job_expected_hours_why_length CHECK (length(btrim(why)) BETWEEN 3 AND 240),
  -- Set when a newer target replaced this one (the same instant as the new row's set_at) or when the office went
  -- back to the budget (no new row).
  cleared_at timestamptz,
  cleared_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cleared_by_name text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.job_expected_hours IS
  'Expected hours (#242, 2026-11-02): the leader''s or the office''s target for a project''s hours, set in the open. One row per change, append-only; the row with cleared_at IS NULL is the target the Projects board and the superintendent''s phone read. cleared_at equal to another row''s set_at means that row replaced it; cleared_at with no successor means back to the budget.';

-- One open target per job.
CREATE UNIQUE INDEX IF NOT EXISTS job_expected_hours_one_open ON public.job_expected_hours (job_id) WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS job_expected_hours_job_set_at ON public.job_expected_hours (job_id, set_at DESC);

-- Who may move the number: the leader and the office. is_assistant() names the controller too (ACCESS_CONTROL.md).
CREATE OR REPLACE FUNCTION public.can_set_job_expected_hours()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.is_master_or_dev() OR public.is_assistant();
$$;
REVOKE ALL ON FUNCTION public.can_set_job_expected_hours() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_set_job_expected_hours() TO authenticated;

-- Set the target: close the open row and write the new one in the same instant, so the history reads as one change.
CREATE OR REPLACE FUNCTION public.set_job_expected_hours(p_job_id uuid, p_hours numeric, p_from_hours numeric, p_why text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_name text;
  v_id uuid;
BEGIN
  IF NOT public.can_set_job_expected_hours() THEN
    RAISE EXCEPTION 'Only the leader and the office set the expected hours' USING ERRCODE = '42501';
  END IF;
  IF p_hours IS NULL OR p_hours < 0 THEN
    RAISE EXCEPTION 'The expected hours must be zero or more' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(p_why, ''))) < 3 THEN
    RAISE EXCEPTION 'Say why the number moved' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT u.name INTO v_name FROM public.users u WHERE u.id = (SELECT auth.uid());
  UPDATE public.job_expected_hours
     SET cleared_at = v_now, cleared_by = (SELECT auth.uid()), cleared_by_name = coalesce(v_name, '')
   WHERE job_id = p_job_id AND cleared_at IS NULL;
  INSERT INTO public.job_expected_hours (job_id, hours, from_hours, set_by, set_by_name, set_at, why)
  VALUES (p_job_id, round(p_hours, 1), CASE WHEN p_from_hours IS NULL THEN NULL ELSE round(p_from_hours, 1) END, (SELECT auth.uid()), coalesce(v_name, ''), v_now, left(btrim(p_why), 240))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_job_expected_hours(uuid, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_job_expected_hours(uuid, numeric, numeric, text) TO authenticated;

-- Back to the budget: close the open row; nothing new is written, and the strip reads the Costs baseline again.
CREATE OR REPLACE FUNCTION public.clear_job_expected_hours(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NOT public.can_set_job_expected_hours() THEN
    RAISE EXCEPTION 'Only the leader and the office set the expected hours' USING ERRCODE = '42501';
  END IF;
  SELECT u.name INTO v_name FROM public.users u WHERE u.id = (SELECT auth.uid());
  UPDATE public.job_expected_hours
     SET cleared_at = now(), cleared_by = (SELECT auth.uid()), cleared_by_name = coalesce(v_name, '')
   WHERE job_id = p_job_id AND cleared_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_job_expected_hours(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_job_expected_hours(uuid) TO authenticated;

ALTER TABLE public.job_expected_hours ENABLE ROW LEVEL SECURITY;

-- Read: whoever can see the job in the ledger under their own RLS, as job_budgets reads (the superintendent on his project included).
DROP POLICY IF EXISTS job_expected_hours_select ON public.job_expected_hours;
CREATE POLICY job_expected_hours_select ON public.job_expected_hours
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_expected_hours.job_id));
-- Write: the leader and the office, on a job they can see. Rows change only through the two functions above.
DROP POLICY IF EXISTS job_expected_hours_insert ON public.job_expected_hours;
CREATE POLICY job_expected_hours_insert ON public.job_expected_hours
  FOR INSERT TO authenticated WITH CHECK (public.can_set_job_expected_hours() AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_expected_hours.job_id));
DROP POLICY IF EXISTS job_expected_hours_update ON public.job_expected_hours;
CREATE POLICY job_expected_hours_update ON public.job_expected_hours
  FOR UPDATE TO authenticated
  USING (public.can_set_job_expected_hours() AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_expected_hours.job_id))
  WITH CHECK (public.can_set_job_expected_hours() AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = job_expected_hours.job_id));
-- A ledger row is never deleted by the app; the dev's policy is for a mistake.
DROP POLICY IF EXISTS job_expected_hours_delete ON public.job_expected_hours;
CREATE POLICY job_expected_hours_delete ON public.job_expected_hours
  FOR DELETE TO authenticated USING (public.is_dev());

REVOKE ALL ON TABLE public.job_expected_hours FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_expected_hours TO authenticated;
GRANT ALL ON TABLE public.job_expected_hours TO service_role;

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
