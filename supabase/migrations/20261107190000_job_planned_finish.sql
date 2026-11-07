SET lock_timeout = '3s';

-- The planned finish (punch list #234, PR 2). A project leaves award with a planned start and finish beside
-- its hours baseline, frozen like it, so "ahead" reads in days as well as hours. Three sources, tried in order
-- as the hours are: the GC project's rough schedule when its weeks were kept (the finish as it went with the
-- bid or the award), else the start the bid assumed and the baseline hours at the crew day (assumed, a guess
-- read as one), else a typed day. Six columns on job_budgets (the plan rides the award's row) and two functions.
--
--   job_budgets.planned_start / planned_finish / planned_source ('rough' | 'assumed' | 'typed') /
--     planned_detail jsonb (the rough's weeks and when it was kept, or the assumed math, or the typed note) /
--     planned_set_at / planned_set_by.
--   set_job_planned_finish(job, source, start, finish, detail, replace) — writes the plan on the job's row,
--     once; a later call writes only with p_replace, keeping the one it replaces under planned_detail.previous.
--     The row must exist: the plan rides the baseline, so a project with no baseline gets one first.
--   award_job_baseline(…, p_planned jsonb) — the award press gains the plan: {source, start, finish, detail},
--     written after the award is stamped, when none is set. The seven-argument form is dropped first, since a
--     defaulted eighth argument would otherwise leave two functions a seven-argument call could not choose between.
--
-- Additive, idempotent. docs/migrations/20261107190000_job_planned_finish.md.

ALTER TABLE public.job_budgets
  ADD COLUMN IF NOT EXISTS planned_start date,
  ADD COLUMN IF NOT EXISTS planned_finish date,
  ADD COLUMN IF NOT EXISTS planned_source text,
  ADD COLUMN IF NOT EXISTS planned_detail jsonb,
  ADD COLUMN IF NOT EXISTS planned_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.job_budgets DROP CONSTRAINT IF EXISTS job_budgets_planned_source_check;
ALTER TABLE public.job_budgets ADD CONSTRAINT job_budgets_planned_source_check CHECK (planned_source IS NULL OR planned_source IN ('rough', 'assumed', 'typed'));
ALTER TABLE public.job_budgets DROP CONSTRAINT IF EXISTS job_budgets_planned_order_check;
ALTER TABLE public.job_budgets ADD CONSTRAINT job_budgets_planned_order_check CHECK (planned_start IS NULL OR planned_finish IS NULL OR planned_finish >= planned_start);

COMMENT ON COLUMN public.job_budgets.planned_finish IS 'Punch list #234 PR 2: the day the project was planned to finish, frozen at award beside the hours baseline; the superintendent''s line reads days against it. Source in planned_source.';

CREATE OR REPLACE FUNCTION public.set_job_planned_finish(
  p_job_id uuid,
  p_source text,
  p_start date,
  p_finish date,
  p_detail jsonb DEFAULT '{}'::jsonb,
  p_replace boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.job_budgets;
BEGIN
  IF NOT public.can_write_job_budget(p_job_id) THEN
    RAISE EXCEPTION 'You cannot change this job''s plan' USING ERRCODE = '42501';
  END IF;
  IF p_source NOT IN ('rough', 'assumed', 'typed') THEN
    RAISE EXCEPTION 'The plan''s source must be rough, assumed or typed' USING ERRCODE = '22023';
  END IF;
  IF p_finish IS NULL THEN
    RAISE EXCEPTION 'The plan needs a finish day' USING ERRCODE = '22023';
  END IF;
  IF p_start IS NOT NULL AND p_finish < p_start THEN
    RAISE EXCEPTION 'The finish cannot come before the start' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.job_budgets WHERE job_id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set the hours baseline first; the plan rides it' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.planned_set_at IS NOT NULL AND NOT p_replace THEN
    RETURN to_jsonb(v_row);
  END IF;
  UPDATE public.job_budgets jb
     SET planned_start = p_start,
         planned_finish = p_finish,
         planned_source = p_source,
         planned_detail = COALESCE(p_detail, '{}'::jsonb)
           || CASE WHEN jb.planned_set_at IS NOT NULL THEN jsonb_build_object('previous', jsonb_build_object('start', jb.planned_start, 'finish', jb.planned_finish, 'source', jb.planned_source, 'set_at', jb.planned_set_at)) ELSE '{}'::jsonb END,
         planned_set_at = now(),
         planned_set_by = (SELECT auth.uid()),
         updated_at = now()
   WHERE jb.job_id = p_job_id
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.set_job_planned_finish(uuid, text, date, date, jsonb, boolean) IS
  'Punch list #234 PR 2: the project''s planned start and finish on its job_budgets row — written once at award (rough | assumed | typed), rewritten only with p_replace, which keeps the plan it replaces under planned_detail.previous. SECURITY INVOKER over can_write_job_budget.';

REVOKE ALL ON FUNCTION public.set_job_planned_finish(uuid, text, date, date, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_job_planned_finish(uuid, text, date, date, jsonb, boolean) TO authenticated;

-- The award press gains the plan. The seven-argument form goes first (see the head).
DROP FUNCTION IF EXISTS public.award_job_baseline(uuid, text, uuid, numeric, numeric, jsonb, text);

CREATE OR REPLACE FUNCTION public.award_job_baseline(
  p_job_id uuid,
  p_source text,
  p_bid_id uuid DEFAULT NULL,
  p_labor_hours numeric DEFAULT NULL,
  p_labor_rate numeric DEFAULT NULL,
  p_book jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL,
  p_planned jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bid_id uuid := p_bid_id;
  v_row public.job_budgets;
BEGIN
  IF NOT public.can_write_job_budget(p_job_id) THEN
    RAISE EXCEPTION 'You cannot change this job''s budget' USING ERRCODE = '42501';
  END IF;
  IF p_source NOT IN ('bid', 'book', 'typed') THEN
    RAISE EXCEPTION 'The baseline''s source must be bid, book or typed' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'bid' THEN
    IF v_bid_id IS NULL THEN
      SELECT j.bid_id INTO v_bid_id FROM public.jobs_ledger j WHERE j.id = p_job_id;
    END IF;
    IF v_bid_id IS NULL THEN
      RAISE EXCEPTION 'No bid is linked to this job' USING ERRCODE = '22023';
    END IF;
    PERFORM public.snapshot_job_budget_from_bid(p_job_id, v_bid_id);
  ELSIF p_source = 'book' THEN
    PERFORM public.set_book_job_budget(p_job_id, p_labor_hours, p_labor_rate, p_book);
  ELSE
    PERFORM public.set_typed_job_budget(p_job_id, p_labor_hours, p_labor_rate, 0, 0, 0, p_note);
  END IF;
  -- The award is written once: the first press freezes it, every later press leaves it.
  UPDATE public.job_budgets jb
     SET awarded_at = now(),
         awarded_by = (SELECT auth.uid()),
         awarded_kind = jb.kind,
         awarded_labor_hours = jb.labor_hours,
         awarded_labor_usd = jb.labor_usd,
         awarded_materials_usd = jb.materials_usd,
         awarded_total_direct_usd = jb.total_direct_usd,
         awarded_detail = jb.completeness || jsonb_build_object('note', jb.note, 'bid_id', jb.bid_id),
         updated_at = now()
   WHERE jb.job_id = p_job_id AND jb.awarded_at IS NULL;
  -- The plan rides the award (PR 2): written when given and none is set yet.
  IF p_planned IS NOT NULL AND (p_planned->>'finish') IS NOT NULL THEN
    PERFORM public.set_job_planned_finish(
      p_job_id,
      COALESCE(p_planned->>'source', 'assumed'),
      (p_planned->>'start')::date,
      (p_planned->>'finish')::date,
      COALESCE(p_planned->'detail', '{}'::jsonb),
      false
    );
  END IF;
  SELECT * INTO v_row FROM public.job_budgets WHERE job_id = p_job_id;
  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.award_job_baseline(uuid, text, uuid, numeric, numeric, jsonb, text, jsonb) IS
  'Punch list #234 PR 1a + PR 2: the baseline a project leaves award with — the live job_budgets row written by its source, the awarded_* snapshot stamped once, and (PR 2) the planned start and finish written once from p_planned {source, start, finish, detail}. SECURITY INVOKER over can_write_job_budget.';

REVOKE ALL ON FUNCTION public.award_job_baseline(uuid, text, uuid, numeric, numeric, jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_job_baseline(uuid, text, uuid, numeric, numeric, jsonb, text, jsonb) TO authenticated;
